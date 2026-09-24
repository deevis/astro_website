(() => {
  const KEY = "puzzle-history-v1";
  const MAX = 250;

  const GAMES = {
    "logic-grid": {
      label: "Logic Grid",
      apps: "/apps/logic-grid",
      showcase: "/html_showcase/logic_grid/index.html"
    },
    "knights-journey": {
      label: "Knights Journey",
      apps: "/apps/knights-journey",
      showcase: "/html_showcase/knights_journey/index.html"
    },
    nonogram: {
      label: "Nonogram",
      apps: "/apps/nonogram",
      showcase: "/html_showcase/nonogram/index.html"
    },
    mastermind: {
      label: "Mastermind",
      apps: "/apps/mastermind",
      showcase: "/html_showcase/mastermind/index.html"
    },
    sudoku: {
      label: "Sudoku",
      apps: "/apps/sudoku",
      showcase: "/html_showcase/sudoku/index.html"
    },
    cryptoquote: {
      label: "Cryptoquote",
      apps: "/apps/cryptoquote",
      showcase: "/html_showcase/cryptoquote_generator/index.html"
    }
  };

  function score100(elapsedSec, checks, hints) {
    const elapsed = Math.max(0, Number(elapsedSec) || 0);
    const nChecks = Math.max(0, Math.floor(Number(checks) || 0));
    const nHints = Math.max(0, Math.floor(Number(hints) || 0));
    const timePenalty = Math.max(0, Math.ceil(elapsed / 300) - 1) * 10;
    const checkPenalty = Math.max(0, nChecks - 1) * 10;
    const hintPenalty = nHints * 10;
    return Math.max(0, Math.min(100, 100 - timePenalty - checkPenalty - hintPenalty));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  }

  function localDateKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function playedDays(gameId) {
    const days = new Set();
    for (const row of list(gameId)) {
      const played = localDateKey(row.completedAt);
      if (played) days.add(played);
      if (row.dailyDate) days.add(row.dailyDate);
    }
    return days;
  }

  function dailyKeyFor(row) {
    if (row?.dailyDate) return row.dailyDate;
    if (row?.source === "daily") return localDateKey(row.completedAt);
    return "";
  }

  function findDaily(gameId, day, difficulty) {
    const rows = list(gameId).filter((row) => dailyKeyFor(row) === day);
    if (!rows.length) return null;
    const sameDiff = rows.find((row) => row.difficulty === difficulty);
    return sameDiff || rows[0];
  }

  function record(entry) {
    const rows = load();
    const item = {
      id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      game: entry.game,
      title: entry.title || "",
      difficulty: entry.difficulty || "",
      source: entry.source || "random",
      dailyDate: entry.dailyDate || "",
      completedAt: entry.completedAt || new Date().toISOString(),
      score: Math.round(Number(entry.score) || 0),
      time: Math.round(Number(entry.time) || 0),
      checks: Math.max(0, Math.floor(Number(entry.checks) || 0)),
      hints: Math.max(0, Math.floor(Number(entry.hints) || 0)),
      share: entry.share || null
    };
    rows.unshift(item);
    save(rows);
    return item;
  }

  function list(filterGame) {
    const all = load();
    if (!filterGame || filterGame === "all") return all;
    return all.filter((row) => row.game === filterGame);
  }

  function encodeShare(payload) {
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeShare(raw) {
    try {
      const b64 = String(raw).replace(/-/g, "+").replace(/_/g, "/");
      const pad = "=".repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(decodeURIComponent(escape(atob(b64 + pad))));
    } catch {
      return null;
    }
  }

  function parseHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("p=")) return null;
    return decodeShare(decodeURIComponent(hash.slice(2)));
  }

  function pathFor(gameId) {
    const meta = GAMES[gameId];
    if (!meta) return window.location.pathname;
    return window.location.pathname.includes("/html_showcase/") ? meta.showcase : meta.apps;
  }

  function urlFor(payload, gameId = payload && payload.g) {
    const url = new URL(pathFor(gameId || "logic-grid"), window.location.origin);
    url.hash = `p=${encodeShare(payload)}`;
    return url.toString();
  }

  function setHash(payload) {
    if (!payload) return;
    const next = `#p=${encodeShare(payload)}`;
    if (location.hash === next) return;
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }

  function clearHash() {
    if (!location.hash.startsWith("#p=")) return;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function handoff(currentGame) {
    const payload = parseHash();
    if (!payload?.g || payload.g === currentGame) return false;
    if (!GAMES[payload.g]) return false;
    location.replace(urlFor(payload, payload.g));
    return true;
  }

  function copy(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error("clipboard"));
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function formatWhen(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function gameLabel(id) {
    return GAMES[id]?.label || id;
  }

  function difficultyLabel(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function sourceLabel(value) {
    if (value === "daily") return "Daily";
    if (value === "custom") return "Custom";
    if (value === "shared") return "Shared";
    return "Random";
  }

  function closeOverlay(wrap, onKey) {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  }

  function open(opts) {
    const {
      currentGame = "all",
      host,
      overlayClass = "ph-host-overlay",
      onReplay,
      toast
    } = opts || {};
    const mount = host || document.body;
    mount.querySelector(".ph-overlay")?.remove();

    const wrap = document.createElement("div");
    wrap.className = `${overlayClass} ph-overlay`.trim();
    wrap.innerHTML = `
      <div class="ph-modal" role="dialog" aria-labelledby="ph-title">
        <div class="ph-head">
          <div>
            <h2 id="ph-title">History</h2>
            <p>Scores are out of 100. Five minutes and one Check is a perfect 100 — every extra five minutes, extra Check, or Hint costs 10.</p>
          </div>
          <button type="button" class="ph-close" data-ph="close" aria-label="Close">×</button>
        </div>
        <div class="ph-filters" role="tablist" aria-label="Filter history">
          <button type="button" class="ph-filter" data-filter="all">All</button>
          ${Object.entries(GAMES).map(([id, meta]) =>
            `<button type="button" class="ph-filter" data-filter="${id}">${meta.label}</button>`
          ).join("")}
        </div>
        <div class="ph-list" id="ph-list"></div>
      </div>
    `;
    mount.appendChild(wrap);

    let filter = GAMES[currentGame] ? currentGame : "all";

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay(wrap, onKey);
      }
    };
    document.addEventListener("keydown", onKey);

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-ph='close']")) {
        closeOverlay(wrap, onKey);
      }
    });

    const renderList = () => {
      wrap.querySelectorAll(".ph-filter").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
      });
      const rows = list(filter);
      const box = wrap.querySelector("#ph-list");
      if (!rows.length) {
        const label = filter === "all" ? "puzzles" : `${gameLabel(filter)} puzzles`;
        box.innerHTML = `<p class="ph-empty">No ${label} in this log yet. Finish one and it will show up here.</p>`;
        return;
      }
      box.innerHTML = rows.map((row) => {
        const title = row.title || gameLabel(row.game);
        const meta = [gameLabel(row.game), difficultyLabel(row.difficulty), sourceLabel(row.source)]
          .filter(Boolean)
          .join(" · ");
        const canShare = !!row.share;
        return `
          <article class="ph-row">
            <div class="ph-row-copy">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(meta)}</span>
              <span class="ph-when">${escapeHtml(formatWhen(row.completedAt))}</span>
            </div>
            <div class="ph-row-stats">
              <div><b>${row.score}</b><span>Score</span></div>
              <div><b>${formatTime(row.time)}</b><span>Time</span></div>
              <div><b>${row.checks}</b><span>Check${row.checks === 1 ? "" : "s"}</span></div>
              <div><b>${row.hints || 0}</b><span>Hint${(row.hints || 0) === 1 ? "" : "s"}</span></div>
            </div>
            <div class="ph-row-actions">
              <button type="button" class="ph-btn gold" data-replay="${escapeAttr(row.id)}" ${canShare ? "" : "disabled"}>Replay</button>
              <button type="button" class="ph-btn" data-copy="${escapeAttr(row.id)}" ${canShare ? "" : "disabled"}>Copy link</button>
            </div>
          </article>
        `;
      }).join("");
    };

    wrap.querySelectorAll(".ph-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.getAttribute("data-filter") || "all";
        renderList();
      });
    });

    wrap.querySelector("#ph-list").addEventListener("click", (e) => {
      const replayId = e.target.closest("[data-replay]")?.getAttribute("data-replay");
      const copyId = e.target.closest("[data-copy]")?.getAttribute("data-copy");
      const id = replayId || copyId;
      if (!id) return;
      const row = load().find((item) => item.id === id);
      if (!row?.share) return;
      if (copyId) {
        const url = urlFor(row.share, row.share.g || row.game);
        copy(url).then(
          () => toast?.("Share link copied"),
          () => toast?.(url)
        );
        return;
      }
      closeOverlay(wrap, onKey);
      if (typeof onReplay === "function") onReplay(row.share);
      else location.href = urlFor(row.share, row.share.g || row.game);
    });

    renderList();
  }

  const CAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';

  function chromeBottom() {
    let bottom = 0;
    const header = document.querySelector("body > header, header.fixed");
    if (header) {
      const r = header.getBoundingClientRect();
      if (r.bottom > 0) bottom = Math.max(bottom, r.bottom);
    }
    const ticker = document.getElementById("news-ticker");
    if (ticker && getComputedStyle(ticker).display !== "none") {
      const r = ticker.getBoundingClientRect();
      if (r.bottom > 0) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  }

  function placeByAnchor(modal, anchor) {
    if (!modal) return;
    const pad = 12;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mw = Math.min(modal.offsetWidth || 380, vw - pad * 2);
    const minTop = chromeBottom() + gap;

    if (!anchor || typeof anchor.getBoundingClientRect !== "function") {
      modal.style.top = `${Math.round(minTop)}px`;
      modal.style.left = `${Math.max(pad, Math.round((vw - mw) / 2))}px`;
      modal.style.maxHeight = `${Math.max(200, vh - minTop - pad)}px`;
      return;
    }

    const rect = anchor.getBoundingClientRect();
    let left = rect.right - mw;
    if (left < pad) left = pad;
    if (left + mw > vw - pad) left = Math.max(pad, vw - mw - pad);

    const top = Math.max(minTop, rect.bottom + gap);
    modal.style.maxHeight = `${Math.max(200, vh - top - pad)}px`;
    modal.style.top = `${Math.round(top)}px`;
    modal.style.left = `${Math.round(left)}px`;
  }

  function openCalendar(opts) {
    const {
      game,
      host,
      overlayClass = "ph-host-overlay",
      selected,
      onSelect,
      title = "Daily archive",
      anchor
    } = opts || {};
    const mount = host || document.body;
    mount.querySelector(".ph-overlay")?.remove();
    document.querySelectorAll(".ph-cal-overlay").forEach((el) => el.remove());

    const today = localDateKey();
    const played = playedDays(game);
    let cursor = selected && selected <= today ? selected : today;
    let [year, month] = cursor.split("-").map(Number);
    month -= 1;

    const wrap = document.createElement("div");
    wrap.className = `${overlayClass} ph-overlay ph-cal-overlay`.trim();
    wrap.innerHTML = `
      <div class="ph-modal ph-cal-modal" role="dialog" aria-labelledby="ph-cal-title">
        <div class="ph-head">
          <div>
            <h2 id="ph-cal-title">${escapeHtml(title)}</h2>
            <p>Gold dots are days you’ve already played. Completed dailies open finished.</p>
          </div>
          <button type="button" class="ph-close" data-ph="close" aria-label="Close">×</button>
        </div>
        <div class="ph-cal-nav">
          <button type="button" class="ph-btn" data-cal="prev" aria-label="Previous month">‹</button>
          <div class="ph-cal-label" id="ph-cal-label"></div>
          <button type="button" class="ph-btn" data-cal="next" aria-label="Next month">›</button>
        </div>
        <div class="ph-cal-week" aria-hidden="true">
          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div class="ph-cal-grid" id="ph-cal-grid"></div>
        <p class="ph-cal-legend"><span class="ph-cal-dot"></span> Played</p>
      </div>
    `;
    document.body.appendChild(wrap);
    const modal = wrap.querySelector(".ph-cal-modal");
    const anchorEl = anchor && typeof anchor.getBoundingClientRect === "function" ? anchor : null;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onReposition = () => placeByAnchor(modal, anchorEl);
    const close = () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      closeOverlay(wrap, onKey);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-ph='close']")) close();
    });

    const keyFrom = (y, m, d) =>
      `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const canGoNext = () => {
      const now = new Date();
      return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    };

    const renderMonth = () => {
      wrap.querySelector("#ph-cal-label").textContent =
        new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
      const nextBtn = wrap.querySelector("[data-cal='next']");
      if (nextBtn) nextBtn.disabled = !canGoNext();

      const firstDow = new Date(year, month, 1).getDay();
      const nDays = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < firstDow; i++) cells.push('<span class="ph-cal-pad"></span>');
      for (let d = 1; d <= nDays; d++) {
        const key = keyFrom(year, month, d);
        const future = key > today;
        const cls = ["ph-cal-day"];
        if (key === today) cls.push("today");
        if (played.has(key)) cls.push("played");
        if (future) cls.push("future");
        cells.push(
          `<button type="button" class="${cls.join(" ")}" data-day="${key}" ${future ? "disabled" : ""} aria-label="${key}${played.has(key) ? ", played" : ""}${key === today ? ", today" : ""}">${d}</button>`
        );
      }
      wrap.querySelector("#ph-cal-grid").innerHTML = cells.join("");
    };

    wrap.querySelector("[data-cal='prev']")?.addEventListener("click", () => {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      renderMonth();
      placeByAnchor(modal, anchorEl);
    });
    wrap.querySelector("[data-cal='next']")?.addEventListener("click", () => {
      if (!canGoNext()) return;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      renderMonth();
      placeByAnchor(modal, anchorEl);
    });
    wrap.querySelector("#ph-cal-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-day]");
      if (!btn || btn.disabled) return;
      const day = btn.getAttribute("data-day");
      close();
      if (day && typeof onSelect === "function") onSelect(day);
    });

    renderMonth();
    placeByAnchor(modal, anchorEl);
    requestAnimationFrame(() => placeByAnchor(modal, anchorEl));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function celebrate(cells, onDone) {
    const list = Array.from(cells || []).filter(Boolean);
    const finish = () => {
      if (typeof onDone === "function") onDone();
    };
    if (!list.length) {
      finish();
      return;
    }

    list.forEach((el) => el.classList.remove("ph-win-flash"));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      list.forEach((el) => el.classList.add("ph-win-flash"));
      window.setTimeout(finish, 280);
      return;
    }

    const boxes = list.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const minTop = Math.min(...boxes.map((b) => b.r.top));
    const minLeft = Math.min(...boxes.map((b) => b.r.left));
    const span = Math.max(1, ...boxes.map((b) => (b.r.top - minTop) + (b.r.left - minLeft)));
    const waveMs = 560;
    const flashMs = 720;
    let maxDelay = 0;
    boxes.forEach(({ el, r }) => {
      const delay = Math.round((((r.top - minTop) + (r.left - minLeft)) / span) * waveMs);
      maxDelay = Math.max(maxDelay, delay);
      window.setTimeout(() => el.classList.add("ph-win-flash"), delay);
    });
    window.setTimeout(finish, maxDelay + flashMs);
  }

  window.PuzzleHistory = {
    GAMES,
    CAL_ICON,
    score100,
    record,
    list,
    playedDays,
    findDaily,
    localDateKey,
    encodeShare,
    decodeShare,
    parseHash,
    urlFor,
    setHash,
    clearHash,
    handoff,
    copy,
    formatTime,
    open,
    openCalendar,
    celebrate
  };
})();
