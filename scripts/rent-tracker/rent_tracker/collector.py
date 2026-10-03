"""Bounded, anonymous GET requests to an explicit source registry."""

import json
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser

from .extract import ADAPTERS, extract
from .storage import utc_now

USER_AGENT = "SaltLakeRentResearch/0.1 (public apartment listing research; daily snapshots)"
MAX_BYTES = 8 * 1024 * 1024


def origin(url):
    parsed = urlsplit(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def load_config(path):
    with open(path, encoding="utf-8") as stream:
        config = json.load(stream)
    if config.get("schema_version") != 1 or not config.get("properties"):
        raise ValueError("Expected registry schema_version 1 and a nonempty properties array")
    identities = set()
    for prop in config["properties"]:
        if not re.fullmatch(r"[a-z0-9-]+", prop["id"]) or prop["id"] in identities:
            raise ValueError("Duplicate or invalid property ID")
        identities.add(prop["id"])
        sources = set()
        if not prop.get("sources"):
            raise ValueError("Property has no sources")
        for source in prop["sources"]:
            if source["id"] in sources or source["adapter"] not in {*ADAPTERS, "signals"}:
                raise ValueError("Duplicate source ID or unknown adapter")
            sources.add(source["id"])
            url = urlsplit(source["url"])
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                raise ValueError("Sources must be public HTTPS URLs without credentials")
    return config


class SameOriginRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if origin(req.full_url) != origin(newurl):
            raise HTTPError(req.full_url, code, "Cross-origin redirect needs registry review", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Fetcher:
    def __init__(self, store, delay=2.0, timeout=25.0, user_agent=USER_AGENT):
        self.store, self.delay, self.timeout, self.user_agent = store, max(1.0, delay), timeout, user_agent
        self.opener = build_opener(SameOriginRedirects())
        self.robots_cache, self.last_request, self.blocked = {}, {}, set()

    def request(self, url, delay=None):
        host = origin(url)
        interval = max(self.delay, delay or 0)
        time.sleep(max(0, interval - (time.monotonic() - self.last_request.get(host, 0))))
        self.last_request[host] = time.monotonic()
        request = Request(url, headers={"User-Agent": self.user_agent, "Accept": "text/html,text/plain,application/json;q=0.9"})
        response = None
        try:
            response = self.opener.open(request, timeout=self.timeout)
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                return {"status": "response_too_large", "http_status": response.status, "body": None}
            return {"status": "fetched", "http_status": response.status, "final_url": response.url,
                    "content_type": response.headers.get("Content-Type", ""),
                    "encoding": response.headers.get_content_charset() or "utf-8",
                    "etag": response.headers.get("ETag"), "last_modified": response.headers.get("Last-Modified"), "body": body}
        except HTTPError as exc:
            body = exc.read(MAX_BYTES)
            if exc.code in {401, 403, 429}:
                self.blocked.add(host)
            return {"status": "http_error", "http_status": exc.code, "error": str(exc), "body": body}
        except (URLError, TimeoutError, OSError) as exc:
            return {"status": "network_error", "error": str(exc), "body": None}
        finally:
            if response is not None:
                response.close()

    def robots(self, url):
        host = origin(url)
        if host not in self.robots_cache:
            result = self.request(host + "/robots.txt")
            parser = RobotFileParser()
            evidence = {"url": host + "/robots.txt", "http_status": result.get("http_status")}
            if result.get("body") is not None:
                evidence["raw_sha256"] = self.store.archive(result["body"])
            if result.get("http_status") in {404, 410}:
                parser.parse([])
                evidence["status"] = "not_published"
            elif result["status"] == "fetched" and "<html" not in result["body"][:200].decode("utf-8", "ignore").lower():
                parser.parse(result["body"].decode("utf-8", "replace").splitlines())
                evidence["status"] = "checked"
            else:
                evidence["status"] = "unavailable"
            self.robots_cache[host] = (parser, evidence)
        return self.robots_cache[host]

    def collect(self, source):
        url = source["url"]
        timestamp = utc_now()
        if origin(url) in self.blocked:
            return {"status": "host_backoff", "observed_at": timestamp, "error": "An earlier request to this origin was denied or rate limited; no retry this run."}, None
        parser, evidence = self.robots(url)
        if evidence["status"] == "unavailable":
            return {"status": "robots_unavailable", "observed_at": timestamp, "robots": evidence}, None
        if not parser.can_fetch(self.user_agent, url):
            return {"status": "robots_disallowed", "observed_at": timestamp, "robots": evidence}, None
        delay = parser.crawl_delay(self.user_agent) or parser.crawl_delay("*")
        rate = parser.request_rate(self.user_agent) or parser.request_rate("*")
        if rate:
            delay = max(delay or 0, rate.seconds / rate.requests)
        if delay and delay > 60:
            return {"status": "crawl_delay_exceeds_budget", "observed_at": timestamp, "robots": evidence}, None
        result = self.request(url, delay)
        body = result.pop("body")
        result.update(observed_at=utc_now(), robots=evidence, adapter=source["adapter"],
                      request_context={"url": url, "user_agent": self.user_agent, "selection": "website_default", "cookies": False})
        if result["status"] == "fetched":
            try:
                if "html" not in result.get("content_type", "").lower():
                    raise ValueError("Expected HTML source")
                html = body.decode(result.pop("encoding"), "replace")
                result.update(extract(html, source["adapter"]))
            except (ValueError, KeyError, TypeError, LookupError) as exc:
                result.update(status="parse_error", error=str(exc))
        return result, body
