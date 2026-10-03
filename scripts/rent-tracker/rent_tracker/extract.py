"""Conservative extraction: source prices stay distinct from inferred costs."""

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser

PARSER_VERSION = "2"
MONEY = r"\$\s*([\d,]+(?:\.\d{1,2})?)"
PROMOTION = re.compile(r"\b\d+\s*(?:weeks?|months?)\s+(?:of\s+)?free\b|\$[\d,]+\s*(?:off\b|gift\s*card\b|move.in\s+special\b)|\b(?:move.in|look\s*&\s*lease)\s+special", re.I)


def clean(value):
    return re.sub(r"\s+", " ", str(value)).strip()


def number(value):
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        result = float(Decimal(str(value).replace(",", "").replace("$", "").strip()))
        return result if result >= 0 and result < 1e9 else None
    except (InvalidOperation, ValueError):
        return None


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    parent: object = field(default=None, repr=False)

    def text(self):
        if self.tag in {"script", "style", "svg", "noscript"}:
            return ""
        return clean(" ".join(c.text() if isinstance(c, Node) else c for c in self.children))

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def has_class(self, value):
        return value in self.attrs.get("class", "").split()

    def class_text(self, value):
        return next((n.text() for n in self.walk() if n.has_class(value)), "")


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def observation(scope, key, **values):
    return {
        "scope": scope, "listing_id": str(key), "unit_number": None,
        "floorplan": None, "bedrooms": None, "bathrooms": None, "sqft": None, "sqft_min": None, "sqft_max": None,
        "advertised_rent_min": None, "advertised_rent_max": None,
        "price_basis": "unspecified", "base_rent": None,
        "total_monthly_price": None, "mandatory_monthly_fees": None,
        "lease_months": None, "lease_months_min": None, "lease_months_max": None, "default_lease_months": None, "lease_quotes": [],
        "available_on": None, "availability_text": None, "advertised_available_count": None,
        "requested_move_in": None, "quote_context": "website_default",
        "concession_eligibility": "unverified", "effective_monthly_cost": None,
        "evidence": None, **values,
    }


def embedded_assignment(html, name):
    match = re.search(re.escape(name) + r"\s*=\s*", html)
    if not match:
        raise ValueError(f"Missing {name}; adapter needs review")
    return json.JSONDecoder().raw_decode(html[match.end():])[0]


def spaces_json(html, root):
    data = embedded_assignment(html, "SPACES.initialData")
    units = data["units"]["data"]
    pagination = data["units"].get("pagination", {})
    rows = []
    for unit in units:
        if not unit.get("id") or not unit.get("unit_number"):
            raise ValueError("SPACES unit identity missing")
        quotes = [{"lease_months": number(q.get("lease_term")), "base_rent": number(q.get("price"))}
                  for q in unit.get("lease_terms", [])]
        rows.append(observation("unit", unit["id"], unit_number=str(unit["unit_number"]),
            floorplan=unit.get("plan_name"), bedrooms=number(unit.get("bedroom_count")),
            bathrooms=number(unit.get("bathroom_count")), sqft=number(unit.get("area")),
            advertised_rent_min=number(unit.get("price")), price_basis="base_rent",
            base_rent=number(unit.get("price")), total_monthly_price=number(unit.get("price_with_fees")),
            mandatory_monthly_fees=number(unit.get("unit_fees")),
            lease_months=number(unit.get("price_lease_term")), default_lease_months=number(unit.get("default_lease_term")),
            lease_quotes=quotes, available_on=unit.get("available_on"),
            availability_text=unit.get("available_on_string"),
            is_available=unit.get("is_available"), is_affordable=unit.get("is_affordable"),
            evidence="SPACES.initialData.units.data; source ID " + str(unit["id"])))
    expected = number(pagination.get("total_items"))
    complete = expected is not None and len(rows) == expected and pagination.get("current_page") == 1
    return rows, {"inventory_completeness": "source_reported_complete" if complete else "partial",
                  "source_total": expected, "pagination": pagination}


def price_fields(text):
    """Only explicitly labeled base/total prices receive those interpretations."""
    result = {}
    base = re.search(r"base\s+rent\s*" + MONEY, text, re.I) or re.search(MONEY + r"\s*base\s+rent", text, re.I)
    if base:
        result["base_rent"] = number(base[1])
    term_range = re.search(r"\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:month|mo)", text, re.I)
    term = re.search(r"\b(\d{1,2})\s*(?:-\s*)?(?:month|mo)\s*(?:term|lease)", text, re.I)
    if term_range:
        result.update(lease_months_min=number(term_range[1]), lease_months_max=number(term_range[2]))
    elif term:
        result["lease_months"] = number(term[1])
    # Require a pricing label; do not mistake deposits or gift cards for rent.
    price = re.search(r"(?:Starting\s+(?:at|from)|From|Total Monthly (?:Leasing )?Price)\s*" + MONEY, text, re.I)
    if not price:
        price = re.search(MONEY + r"\s*(?:(?:to\s*-?|[-–—])\s*" + MONEY + r")?\s*/\s*(?:month|mo)\b", text, re.I)
    if price:
        result["advertised_rent_min"] = number(price[1])
        if price.lastindex and price.lastindex > 1:
            result["advertised_rent_max"] = number(price[2])
        prefix = text[max(0, price.start() - 70):price.end()]
        if re.search(r"Total Monthly (?:Leasing )?Price", prefix, re.I):
            result["price_basis"] = "total_monthly_price"
            result["total_monthly_price"] = number(price[1])
    return result


def spaces_html(html, root):
    rows = []
    for node in root.walk():
        if node.attrs.get("data-spaces-obj") != "plan":
            continue
        attrs = node.attrs
        text = node.text()
        price = node.class_text("spaces-plan-overview-pricing")
        fields = price_fields(price or text)
        total = re.search(MONEY, price)
        # This adapter's reviewed pages label their primary price as total monthly price.
        if "TOTAL MONTHLY PRICE" in root.text().upper() and total and fields.get("base_rent") is not None:
            fields.update(total_monthly_price=number(total[1]), price_basis="total_monthly_price", advertised_rent_min=number(total[1]))
        key = attrs.get("data-spaces-plan")
        if not key:
            raise ValueError("SPACES floorplan ID missing")
        rows.append(observation("floorplan", key, floorplan=attrs.get("title") or attrs.get("data-spaces-sort-plan-name"),
            bedrooms=number(attrs.get("data-spaces-sort-bed")), bathrooms=number(attrs.get("data-spaces-bath-count")),
            sqft=number(attrs.get("data-spaces-sort-area")), available_on=attrs.get("data-spaces-soonest"),
            advertised_available_count=number(node.class_text("spaces-plan-overview-available-unit-count-number")),
            evidence=text[:1000], **fields))
    return rows, {"inventory_completeness": "floorplans_only", "source_total": None}


def heading_sections(root):
    sections, current = [], None
    def visit(node):
        nonlocal current
        if isinstance(node, str):
            if current is not None:
                current[1].append(node)
            return
        if node.tag in {"script", "style", "svg", "noscript"}:
            return
        if node.tag == "h2":
            current = [node.text(), []]
            sections.append(current)
            return
        for child in node.children:
            visit(child)
    visit(root)
    return [(name, clean(" ".join(parts))) for name, parts in sections]


def floorplan_headings(html, root):
    rows = {}
    for name, text in heading_sections(root):
        if not name or len(name) > 100:
            continue
        bed = re.search(r"\b(\d+)\s*(?:Beds?|Bedrooms?)\b|\b(Studio)\b", text, re.I)
        bath = re.search(r"\b(\d+(?:\.\d+)?)\s*Bath(?:room)?s?\b", text, re.I)
        sqft = re.search(r"([\d,]+)(?:\s*(?:-to|to|[-–])\s*([\d,]+))?\s*Sq\.?\s*Ft\.?", text, re.I)
        if not (bed and bath and sqft):
            continue
        fields = price_fields(text)
        # Never use marketing prose as a listing without a recognizable pricing state.
        if not fields and not re.search(r"call for details|contact us|waitlist", text, re.I):
            continue
        count = re.search(r"\b(\d+)\s+(?:Units?\s+)?Available\b", text, re.I)
        available = re.search(r"Available On:\s*(Available Now|\d{1,2}/\d{1,2}/\d{4})", text, re.I)
        row = observation("floorplan", name.casefold(), floorplan=name,
            bedrooms=0 if bed[2] else number(bed[1]), bathrooms=number(bath[1]),
            sqft=None if sqft[2] else number(sqft[1]), sqft_min=number(sqft[1]), sqft_max=number(sqft[2] or sqft[1]),
            advertised_available_count=number(count[1]) if count else None,
            availability_text=available[1] if available else None, evidence=text[:1000], **fields)
        # RentCafe repeats cards in dialogs; prefer the version with a full price range.
        old = rows.get(row["listing_id"])
        if old is None:
            rows[row["listing_id"]] = row
        else:
            if (old.get("advertised_rent_min") is not None and row.get("advertised_rent_min") is not None
                    and old["advertised_rent_min"] != row["advertised_rent_min"]):
                raise ValueError(f"Duplicate floorplan cards disagree on price for {name}; source-specific review needed")
            for key, value in row.items():
                if old.get(key) is None and value is not None:
                    old[key] = value
            if row.get("advertised_rent_max") is not None:
                old["advertised_rent_max"] = row["advertised_rent_max"]
    return list(rows.values()), {"inventory_completeness": "floorplans_only", "source_total": None}


def unit_table(html, root):
    rows = []
    for table in root.walk():
        if table.tag != "table":
            continue
        headers = [n.text().lower() for n in table.walk() if n.tag == "th"]
        if not any("apartment" in h for h in headers) or not any("rent" in h for h in headers):
            continue
        context = table.parent
        while context and not context.has_class("floorplan-section"):
            context = context.parent
        plan = next((n.text() for n in context.walk() if n.tag == "h2"), None) if context else None
        heading = context.text()[:180] if context else ""
        bed = re.search(r"(\d+)\s*Bedrooms?", heading, re.I)
        bath = re.search(r"(\d+(?:\.\d+)?)\s*Bathrooms?", heading, re.I)
        for tr in table.walk():
            cells = [n.text() for n in tr.children if isinstance(n, Node) and n.tag == "td"]
            if len(cells) < len(headers):
                continue
            fields = dict(zip(headers, cells))
            unit = next((v for k, v in fields.items() if "apartment" in k), "")
            identity = re.search(r"#\s*([\w-]+)", unit)
            if not identity:
                continue
            rent = next(v for k, v in fields.items() if "rent" in k)
            prices = re.findall(MONEY, rent)
            size = next((v for k, v in fields.items() if "sq" in k), "")
            size_match = re.search(r"[\d,]+", size)
            date = next((v for k, v in fields.items() if "date" in k), None)
            rows.append(observation("unit", identity[1], unit_number=identity[1],
                floorplan=plan, bedrooms=number(bed[1]) if bed else None, bathrooms=number(bath[1]) if bath else None,
                advertised_rent_min=number(prices[0]) if prices else None,
                advertised_rent_max=number(prices[1]) if len(prices) > 1 else None,
                sqft=number(size_match[0]) if size_match else None,
                availability_text=date, evidence=clean(heading[:120] + " | " + " | ".join(cells))[:1000]))
    return rows, {"inventory_completeness": "unknown", "source_total": None}


def promotions(root):
    found = set()
    for node in root.walk():
        if node.tag not in {"p", "h1", "h2", "h3", "h4", "li", "div", "span"}:
            continue
        text = node.text()
        if 8 <= len(text) <= 650 and PROMOTION.search(text):
            found.add(text)
    # Keep the larger nearby context when the same offer is nested in several tags.
    return [{"kind": "promotion_text", "text": text, "eligibility": "unverified"}
            for text in sorted(found) if not any(text != other and text in other for other in found)]


ADAPTERS = {"spaces_json": spaces_json, "spaces_html": spaces_html,
            "floorplan_headings": floorplan_headings, "unit_table": unit_table}


def extract(html, adapter):
    root = Document(html).root
    title = next((n.text() for n in root.walk() if n.tag == "title"), "")
    if re.search(r"just a moment|access denied|verify you are human|attention required", title, re.I):
        raise ValueError("Challenge page; collection needs attention")
    signals = promotions(root)
    if adapter == "signals":
        if len(root.text()) < 200:
            raise ValueError("Unexpectedly short page")
        return {"status": "signals_only", "observations": [], "signals": signals,
                "inventory_completeness": "not_collected", "source_total": None}
    rows, metadata = ADAPTERS[adapter](html, root)
    if not rows:
        raise ValueError("No recognizable listings; this is not evidence of zero availability")
    identities = [(r["scope"], r["listing_id"]) for r in rows]
    if len(identities) != len(set(identities)):
        raise ValueError("Duplicate identities; adapter needs review")
    return {"status": "parsed", "observations": rows, "signals": signals, **metadata}
