(() => {
  const STATS_KEY = "knights-journey-stats-v1";
  const MUTE_KEY = "knights-journey-muted";
  const THEME_KEY = "knights-journey-theme";
  const START_KEY = "knights-journey-start";
  const DIFF_KEY = "knights-journey-difficulty";
  const PATH_KEY = "knights-journey-show-path";
  const NUMBERS_KEY = "knights-journey-show-numbers";
  const PROGRESS_KEY = "knights-journey-progress-v1";

  const FILES = "abcdefgh";
  const CLASSIC_START = 1; // b1 — queen's knight
  const THEMES = ["stones", "garden"];
  const THEME_LABEL = { stones: "Stones", garden: "Garden" };
  const THEME_BLURB = {
    stones: "Pebbles on every square. Each hop gobbles one.",
    garden: "Green squares turn red once they’re eaten."
  };
  const DIFFS = ["easy", "normal"];
  const DIFF_LABEL = { easy: "Easy", normal: "Normal" };
  const DIFF_BLURB = {
    easy: "Legal hops are marked on the board.",
    normal: "No markers — read the L yourself."
  };
  const DELTAS = [
    [1, 2], [1, -2], [-1, 2], [-1, -2],
    [2, 1], [2, -1], [-2, 1], [-2, -1]
  ];

  /* Cburnett chess knight — the Wikipedia / Lichess standard piece. */
  const KNIGHT_SVG = `<svg class="kj-knight" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-hidden="true"><g fill="none" fill-rule="evenodd" stroke="#111" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path fill="#f7f3ea" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path fill="#f7f3ea" d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/><path fill="#111" d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5"/></g></svg>`;
  const MARK_SVG = KNIGHT_SVG;

  const ICONS = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    random: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6l2 3h8v13H4z"/><path d="m9 14 2 2 4-5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a6.5 6.5 0 1 1 0 13H11"/></svg>',
    path: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18h4l3-8 3 12 3-6h3"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/><circle cx="20" cy="16" r="1.4" fill="currentColor"/></svg>',
    numbers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7h8M8 12h8M8 17h5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const MOVES = buildMoves();

  const root = document.getElementById("kj-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let theme = THEMES.includes(localStorage.getItem(THEME_KEY) || "") ? localStorage.getItem(THEME_KEY) : "stones";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "easy";
  let showPath = localStorage.getItem(PATH_KEY) === "1";
  let showNumbers = localStorage.getItem(NUMBERS_KEY) === "1";
  let chosenStart = parseStart(localStorage.getItem(START_KEY));
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let timerId = null;
  let toastTimer = null;
  let stuckTimer = null;
  let audioCtx = null;
  let stats = loadStats();
  let pickingStart = false;
  let editingStart = false;
  let autoTutorialArmed = true;

  function buildMoves() {
    /** @type {number[][]} */
    const map = Array.from({ length: 64 }, () => []);
    for (let i = 0; i < 64; i++) {
      const f = i % 8;
      const r = (i / 8) | 0;
      for (const [df, dr] of DELTAS) {
        const nf = f + df;
        const nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) map[i].push(nf + nr * 8);
      }
    }
    return map;
  }

  function alg(i) {
    return FILES[i % 8] + String(((i / 8) | 0) + 1);
  }

  function parseAlg(value) {
    const m = /^([a-h])([1-8])$/i.exec(String(value || "").trim());
    if (!m) return null;
    return (m[1].toLowerCase().charCodeAt(0) - 97) + (Number(m[2]) - 1) * 8;
  }

  function parseStart(value) {
    if (value == null || value === "") return CLASSIC_START;
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 64) return value;
    const fromAlg = parseAlg(value);
    if (fromAlg != null) return fromAlg;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < 64 ? n : CLASSIC_START;
  }

  function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }

  function prettyDay(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dailyParams(day = dateKey()) {
    const seed = hashString(`kj-daily-${day}`);
    const rnd = mulberry32(seed);
    return {
      seed,
      start: Math.floor(rnd() * 64)
    };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      playedCount: 0,
      perfectCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastDailyDate: "",
      lastDailySolved: false,
      bestLeft: null,
      bestVisited: 0,
      bestTime: 0
    };
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function ph() {
    return window.PuzzleHistory || null;
  }

  function pt() {
    return window.PuzzleTutorial || null;
  }

  function sharePayload() {
    if (!game) return null;
    const payload = {
      g: "knights-journey",
      sq: alg(game.start),
      th: game.theme,
      d: difficulty,
      src: game.source || "random"
    };
    if (game.source === "daily" && game.dailyDate) payload.day = game.dailyDate;
    return payload;
  }

  function copyPuzzleLink() {
    const api = ph();
    const payload = sharePayload();
    if (!api || !payload) {
      toast("Nothing to share yet.");
      return;
    }
    const url = api.urlFor(payload);
    api.copy(url).then(
      () => toast("Share link copied"),
      () => toast(url)
    );
  }

  function applyShare(payload) {
    if (!payload) return false;
    const api = ph();
    if (payload.g && payload.g !== "knights-journey") {
      if (api) location.href = api.urlFor(payload);
      return true;
    }
    const source = payload.src === "daily" ? "daily" : (payload.src || "shared");
    const day = payload.day || (source === "daily" ? dateKey() : "");
    let start;
    let nextTheme;
    if (source === "daily" && day && payload.sq == null && payload.th == null) {
      start = dailyParams(day).start;
      nextTheme = theme;
    } else {
      start = parseStart(payload.sq != null ? payload.sq : payload.s);
      nextTheme = THEMES.includes(payload.th) ? payload.th : theme;
    }
    if (payload.d && DIFFS.includes(payload.d)) setDifficulty(payload.d);
    beginJourney({ start, theme: nextTheme, source, dailyDate: day });
    return true;
  }

  function tryShare() {
    const api = ph();
    if (!api) return false;
    if (api.handoff("knights-journey")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "knights-journey")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "knights-journey",
      host: root.querySelector(".kj-app") || root,
      overlayClass: "kj-overlay",
      onReplay: applyShare,
      toast
    });
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type = "sine", vol = 0.08) {
    if (muted) return;
    try {
      const ctx = ac();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  function playHop() {
    tone(392, 0.07, "triangle", 0.05);
    setTimeout(() => tone(523, 0.08, "sine", 0.05), 40);
  }

  function playStuck() {
    tone(220, 0.14, "square", 0.04);
    setTimeout(() => tone(174, 0.2, "sine", 0.05), 90);
  }

  function playVictory() {
    tone(523, 0.12);
    setTimeout(() => tone(659, 0.12), 90);
    setTimeout(() => tone(784, 0.18), 180);
    setTimeout(() => tone(1046, 0.22), 280);
  }

  function toast(msg) {
    const el = root.querySelector(".kj-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function headerHtml(subtitle) {
    return `
      <header class="kj-header">
        <div class="kj-brand">
          <div class="kj-mark" aria-hidden="true">${MARK_SVG}</div>
          <div class="kj-brand-text">
            <h1>Knights Journey</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="kj-header-actions">
          <button class="kj-icon-btn" id="kj-help" title="Tutorial" aria-label="Open tutorial">${ICONS.help}</button>
          ${game && !isTutorial() ? `<button class="kj-icon-btn" id="kj-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="kj-icon-btn" id="kj-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#kj-help")?.addEventListener("click", startTutorial);
    root.querySelector("#kj-tutorial")?.addEventListener("click", startTutorial);
    root.querySelector("#kj-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#kj-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#kj-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  function current() {
    return game.path[game.path.length - 1];
  }

  function leftover() {
    return 64 - game.path.length;
  }

  function legalTargets(from = current(), visited = game.visited) {
    return MOVES[from].filter((i) => !visited.has(i));
  }

  function warnsdorffMove() {
    const options = legalTargets();
    if (!options.length) return null;
    let best = options[0];
    let bestN = Infinity;
    for (const i of options) {
      const onward = MOVES[i].filter((j) => !game.visited.has(j)).length;
      if (onward < bestN || (onward === bestN && i < best)) {
        bestN = onward;
        best = i;
      }
    }
    return best;
  }

  function currentElapsed() {
    if (!game) return 0;
    if (game.over) return game.elapsed;
    return game.elapsed + (Date.now() - game.startedAt) / 1000;
  }

  function persistProgress() {
    if (!game || isTutorial()) return;
    if (game.over) {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      start: game.start,
      theme: game.theme,
      source: game.source,
      dailyDate: game.dailyDate || "",
      path: game.path,
      elapsed: currentElapsed(),
      hintsUsed: game.hintsUsed
    }));
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return Array.isArray(p?.path) && p.path.length >= 1 && !p.over;
    } catch {
      return false;
    }
  }

  function resumeProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (!Array.isArray(p?.path) || !p.path.length) return false;
      beginJourney({
        start: parseStart(p.start),
        theme: THEMES.includes(p.theme) ? p.theme : theme,
        source: p.source || "random",
        dailyDate: p.dailyDate || "",
        path: p.path,
        elapsed: p.elapsed || 0,
        hintsUsed: p.hintsUsed || 0
      });
      return true;
    } catch {
      return false;
    }
  }

  function todaySolved() {
    return stats.lastDailyDate === dateKey() && stats.lastDailySolved;
  }

  function setTheme(next) {
    if (!THEMES.includes(next)) return;
    theme = next;
    localStorage.setItem(THEME_KEY, theme);
  }

  function setDifficulty(next) {
    if (!DIFFS.includes(next)) return;
    difficulty = next;
    localStorage.setItem(DIFF_KEY, difficulty);
  }

  function setShowPath(on) {
    showPath = !!on;
    localStorage.setItem(PATH_KEY, showPath ? "1" : "0");
  }

  function setShowNumbers(on) {
    showNumbers = !!on;
    localStorage.setItem(NUMBERS_KEY, showNumbers ? "1" : "0");
  }

  function setChosenStart(next) {
    chosenStart = parseStart(next);
    localStorage.setItem(START_KEY, String(chosenStart));
  }

  function miniBoardHtml(selected) {
    const cells = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const i = file + rank * 8;
        const light = (file + rank) % 2 === 1;
        cells.push(
          `<button type="button" class="kj-mini-sq ${light ? "light" : "dark"}${i === selected ? " chosen" : ""}" data-start="${i}" aria-label="${alg(i)}${i === selected ? ", selected" : ""}${i === CLASSIC_START ? ", classic" : ""}">${i === selected ? KNIGHT_SVG : ""}</button>`
        );
      }
    }
    return `
      <div class="kj-mini-wrap">
        <div class="kj-mini-ranks" aria-hidden="true">${[8, 7, 6, 5, 4, 3, 2, 1].map((n) => `<span>${n}</span>`).join("")}</div>
        <div class="kj-mini-board">${cells.join("")}</div>
      </div>
      <div class="kj-mini-files" aria-hidden="true"><span></span>${[...FILES].map((ch) => `<span>${ch}</span>`).join("")}</div>
    `;
  }

  function render() {
    stopTimer();
    if (view === "splash") renderSplash();
    else renderPlay();
  }

  function renderSplash() {
    ph()?.clearHash();
    pickingStart = false;
    const solvedToday = todaySolved();
    const daily = dailyParams();
    const bestLeft = stats.bestLeft == null ? "—" : String(stats.bestLeft);
    root.innerHTML = `
      <div class="kj-app">
        ${headerHtml("Gobble the board. Leave nothing behind.")}
        <div class="kj-view">
          <div class="kj-splash">
            <div class="kj-hero">
              <div class="kj-hero-head">
                <h2>One knight. Sixty-four squares.</h2>
                <button type="button" class="kj-tut-btn" id="kj-tutorial" title="Tutorial" aria-label="Open tutorial">?</button>
              </div>
              <p>Hop like a knight, but never land twice. When you can’t move, your score is the squares you didn’t visit. Perfect is 0.</p>
            </div>
            <div class="kj-stats-row">
              <div class="kj-stat"><b>${stats.playedCount}</b><span>Played</span></div>
              <div class="kj-stat"><b>${stats.perfectCount}</b><span>Perfect</span></div>
              <div class="kj-stat"><b>${bestLeft}</b><span>Best left</span></div>
              <div class="kj-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
            </div>
            <div class="kj-play-grid">
              ${hasProgress() ? `
              <button class="kj-play-card primary" data-mode="resume">
                <span class="kj-play-icon">${ICONS.random}</span>
                <span>
                  <strong>Continue journey</strong>
                  <span>Pick up the path you were riding. Timer stays on this device.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
              <button class="kj-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                <span class="kj-play-icon">${ICONS.daily}</span>
                <span>
                  <strong>Daily journey</strong>
                  <span>Today’s start is ${alg(daily.start)} · ${THEME_LABEL[theme]}.</span>
                  ${solvedToday ? "<em>Played today</em>" : ""}
                </span>
              </button>
              <button type="button" class="ph-cal-launch" id="kj-calendar" title="Pick another date" aria-label="Pick another day's puzzle">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="kj-play-card" data-mode="new">
                <span class="kj-play-icon">${ICONS.random}</span>
                <span>
                  <strong>New journey</strong>
                  <span>Start on ${alg(chosenStart)}${chosenStart === CLASSIC_START ? " (classic)" : ""} · ${DIFF_LABEL[difficulty]} · ${THEME_LABEL[theme]}.</span>
                </span>
              </button>
            </div>
            <div class="kj-diff">
              <div class="kj-diff-label">Difficulty</div>
              <div class="kj-seg" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${DIFF_BLURB[d]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="kj-diff">
              <div class="kj-diff-label">Theme</div>
              <div class="kj-seg" role="group" aria-label="Theme">
                ${THEMES.map((t) => `
                  <button data-theme="${t}" class="${theme === t ? "active" : ""}">
                    ${THEME_LABEL[t]}<small>${THEME_BLURB[t]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="kj-start-setup${editingStart ? " is-open" : ""}">
              <button type="button" class="kj-start-toggle" id="kj-start-toggle" aria-expanded="${editingStart ? "true" : "false"}">
                <strong>Starting Position</strong>
                <span>${alg(chosenStart)}${chosenStart === CLASSIC_START ? " · classic" : ""}</span>
              </button>
              ${editingStart ? `
                <div class="kj-start-picker">
                  ${miniBoardHtml(chosenStart)}
                  ${chosenStart !== CLASSIC_START ? `<button type="button" class="kj-start-reset" id="kj-classic">Reset to classic b1</button>` : ""}
                </div>
              ` : ""}
            </div>
            <div class="kj-splash-links">
              <button class="kj-how" id="kj-how">How to play</button>
              <button class="kj-how" id="kj-history">View history</button>
            </div>
          </div>
        </div>
        <div class="kj-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#kj-how")?.addEventListener("click", startTutorial);
    root.querySelector("#kj-history")?.addEventListener("click", openHistory);
    root.querySelector("#kj-calendar")?.addEventListener("click", openDailyCalendar);
    root.querySelector("#kj-start-toggle")?.addEventListener("click", () => {
      editingStart = !editingStart;
      renderSplash();
    });
    root.querySelector("#kj-classic")?.addEventListener("click", () => {
      setChosenStart(CLASSIC_START);
      renderSplash();
    });
    root.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTheme(btn.getAttribute("data-theme"));
        renderSplash();
      });
    });
    root.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setDifficulty(btn.getAttribute("data-diff"));
        renderSplash();
      });
    });
    root.querySelectorAll("[data-start]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setChosenStart(Number(btn.getAttribute("data-start")));
        renderSplash();
      });
    });
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode === "resume") {
          if (!resumeProgress()) toast("No saved journey found.");
        } else if (mode === "daily") {
          beginDaily();
        } else {
          const source = chosenStart === CLASSIC_START ? "random" : "custom";
          beginJourney({ start: chosenStart, theme, source });
        }
      });
    });
  }

  function beginDaily(day = dateKey()) {
    const daily = dailyParams(day);
    beginJourney({
      start: daily.start,
      theme,
      source: "daily",
      dailyDate: day
    });
  }

  function openDaily(day) {
    beginDaily(day);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "knights-journey",
      host: root.querySelector(".kj-app") || root,
      overlayClass: "kj-overlay",
      title: "Daily Knights Journey",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#kj-calendar")
    });
  }

  function beginJourney(opts) {
    editingStart = false;
    if (stuckTimer) {
      clearTimeout(stuckTimer);
      stuckTimer = null;
    }
    overlay?.remove();
    overlay = null;
    const start = parseStart(opts.start);
    const nextTheme = THEMES.includes(opts.theme) ? opts.theme : "stones";
    const path = Array.isArray(opts.path) && opts.path.length ? opts.path.map(Number).filter((n) => n >= 0 && n < 64) : [start];
    if (!path.length) path.push(start);
    game = {
      start: path[0],
      theme: nextTheme,
      source: opts.source || "random",
      dailyDate: opts.source === "daily" ? (opts.dailyDate || dateKey()) : "",
      path,
      visited: new Set(path),
      startedAt: Date.now(),
      elapsed: opts.elapsed || 0,
      hintsUsed: opts.hintsUsed || 0,
      over: false,
      tutorial: opts.source === "tutorial"
    };
    view = "play";
    pickingStart = false;
    if (game.source === "tutorial") ph()?.clearHash();
    else ph()?.setHash(sharePayload());
    persistProgress();
    renderPlay();
  }

  function playAgain() {
    if (!game) return;
    overlay?.remove();
    overlay = null;
    beginJourney({
      start: game.start,
      theme: game.theme,
      source: game.source,
      dailyDate: game.dailyDate
    });
    toast("Play again.");
  }

  function squareHtml(i) {
    const file = i % 8;
    const rank = (i / 8) | 0;
    const light = (file + rank) % 2 === 1;
    const vis = game.visited.has(i);
    const cur = i === current();
    const legal = !game.over && legalTargets().includes(i);
    const step = game.path.indexOf(i);
    const cls = ["kj-sq", light ? "light" : "dark"];
    if (vis) cls.push("visited");
    if (cur) cls.push("current");
    if (legal) cls.push("legal");
    return `<button type="button" class="${cls.join(" ")}" data-i="${i}" aria-label="${alg(i)}${cur ? ", knight" : vis ? ", visited" : legal ? ", legal move" : ""}">
      <span class="kj-stone-wrap" aria-hidden="true"><span class="kj-stone"></span></span>
      <span class="kj-step">${step >= 0 ? step + 1 : ""}</span>
      <span class="kj-legal-dot" aria-hidden="true"></span>
      ${cur ? KNIGHT_SVG : ""}
    </button>`;
  }

  function boardHtml() {
    const cells = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        cells.push(squareHtml(file + rank * 8));
      }
    }
    return cells.join("");
  }

  function pathPoints() {
    return game.path.map((i) => {
      const file = i % 8;
      const rank = (i / 8) | 0;
      return `${file + 0.5},${7.5 - rank}`;
    }).join(" ");
  }

  function pathSvg() {
    if (game.path.length < 2) return `<polyline points="" fill="none" />`;
    return `<polyline points="${pathPoints()}" fill="none" stroke="rgba(196,146,42,0.85)" stroke-width="0.09" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  function subtitle() {
    if (isTutorial()) return "Guided tutorial";
    const th = THEME_LABEL[game.theme] || game.theme;
    if (game.source === "daily") return `Daily · ${prettyDay(game.dailyDate || dateKey())} · ${alg(game.start)} · ${th}`;
    return `${th} · start ${alg(game.start)}${game.start === CLASSIC_START ? " · classic" : ""}`;
  }

  function renderPlay() {
    const left = leftover();
    const over = game.over;
    const perfect = over && left === 0;
    root.innerHTML = `
      <div class="kj-app">
        ${headerHtml(subtitle())}
        <div class="kj-view">
          <div class="kj-hud">
            <div class="kj-hud-item score"><span class="lbl">Left</span><span class="val" id="kj-left">${left}</span></div>
            <div class="kj-hud-item"><span class="lbl">Visited</span><span class="val" id="kj-visited">${game.path.length}/64</span></div>
            <div class="kj-hud-item"><span class="lbl">Time</span><span class="val" id="kj-time">${formatTime(currentElapsed())}</span></div>
            <div class="kj-toolbar">
              ${over ? `
              <button class="kj-btn gold" id="kj-again">Play again</button>
              <button class="kj-btn ghost" id="kj-quit">Menu</button>
              ` : `
              <button class="kj-btn${pickingStart ? " active" : ""}" id="kj-relocate"${game.path.length === 1 ? "" : " disabled"}>Move start</button>
              <button class="kj-btn" id="kj-undo"${game.path.length > 1 ? "" : " disabled"}>${ICONS.undo} Undo</button>
              <button class="kj-btn" id="kj-hint">${ICONS.hint} Hint</button>
              <button class="kj-btn ghost" id="kj-quit">Menu</button>
              `}
            </div>
          </div>
          <div class="kj-play-layout">
            <div class="kj-paper" id="kj-board" data-theme="${game.theme}" data-difficulty="${isTutorial() ? "easy" : difficulty}" data-path="${showPath ? "on" : "off"}" data-numbers="${showNumbers ? "on" : "off"}" tabindex="0">
              <div class="kj-board-frame">
                <div class="kj-ranks" aria-hidden="true">${[8, 7, 6, 5, 4, 3, 2, 1].map((n) => `<span>${n}</span>`).join("")}</div>
                <div class="kj-board-wrap">
                  <svg class="kj-path" viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden="true">${pathSvg()}</svg>
                  <div class="kj-board" role="grid">${boardHtml()}</div>
                </div>
              </div>
              <div class="kj-files" aria-hidden="true"><span></span>${[...FILES].map((ch) => `<span>${ch}</span>`).join("")}</div>
              <div class="kj-hint" id="kj-hint-copy">${hintCopy()}</div>
              <div class="kj-board-tools">
                <button type="button" class="kj-btn${showPath ? " active" : ""}" id="kj-path" title="Show the path you’ve ridden">${ICONS.path} Path</button>
                <button type="button" class="kj-btn${showNumbers ? " active" : ""}" id="kj-numbers" title="Number visited squares">${ICONS.numbers} Numbers</button>
              </div>
            </div>
          </div>
          ${over ? `
          <div class="kj-solved-bar ${perfect ? "" : "imperfect"}">
            <div class="kj-solved-copy">
              <strong>${perfect ? "Perfect tour." : "Journey’s end."}</strong>
              <span>${left} left · ${game.path.length}/64 · ${formatTime(Math.round(game.elapsed))} · ${THEME_LABEL[game.theme]} · ${alg(game.start)}</span>
            </div>
            <div class="kj-solved-actions">
              <button class="kj-btn gold" id="kj-again-bar">Play again</button>
              <button class="kj-btn" id="kj-share-bar">Copy link</button>
              <button class="kj-btn ghost" id="kj-menu-bar">Menu</button>
            </div>
          </div>` : ""}
        </div>
        <div class="kj-toast"></div>
      </div>
    `;
    bindChrome();
    bindPlay();
    if (!over) startTimer();
    root.querySelector("#kj-board")?.focus({ preventScroll: true });
    pt()?.refresh?.();
  }

  function hintCopy() {
    if (game.over) return leftover() === 0 ? "Every square visited. A true knight’s tour." : "No legal hops remain.";
    if (pickingStart) return "Tap any square to place the knight. Classic start is b1.";
    if (isTutorial() || difficulty === "easy") {
      if (game.path.length === 1) return "Gold rings are legal knight hops. Move start to pick a different square.";
      return "Gold rings mark unused knight hops. Undo if you paint yourself into a corner.";
    }
    if (game.path.length === 1) return "Hop in an L. Move start to pick a different square.";
    return "Hop in an L onto unused squares. Undo if you paint yourself into a corner.";
  }

  function bindPlay() {
    root.querySelector("#kj-quit")?.addEventListener("click", quitToMenu);
    root.querySelector("#kj-menu-bar")?.addEventListener("click", quitToMenu);
    root.querySelector("#kj-again")?.addEventListener("click", playAgain);
    root.querySelector("#kj-again-bar")?.addEventListener("click", playAgain);
    root.querySelector("#kj-share-bar")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#kj-undo")?.addEventListener("click", undoMove);
    root.querySelector("#kj-hint")?.addEventListener("click", giveHint);
    root.querySelector("#kj-relocate")?.addEventListener("click", () => {
      if (game.path.length !== 1 || game.over) return;
      pickingStart = !pickingStart;
      renderPlay();
    });
    root.querySelector("#kj-path")?.addEventListener("click", () => {
      setShowPath(!showPath);
      renderPlay();
    });
    root.querySelector("#kj-numbers")?.addEventListener("click", () => {
      setShowNumbers(!showNumbers);
      renderPlay();
    });
    root.querySelectorAll(".kj-sq").forEach((el) => {
      el.addEventListener("click", () => onSquare(Number(el.getAttribute("data-i"))));
    });
  }

  function quitToMenu() {
    if (isTutorial()) {
      leaveTutorial();
      return;
    }
    persistProgress();
    editingStart = false;
    view = "splash";
    game = null;
    render();
  }

  function onSquare(i) {
    if (!game || game.over) return;
    if (pickingStart && game.path.length === 1) {
      relocateStart(i);
      return;
    }
    if (!legalTargets().includes(i)) {
      if (i === current()) return;
      toast("Not a legal knight hop.");
      tone(180, 0.08, "square", 0.04);
      return;
    }
    hopTo(i);
  }

  function relocateStart(i) {
    if (i === current()) {
      pickingStart = false;
      renderPlay();
      return;
    }
    game.start = i;
    game.path = [i];
    game.visited = new Set([i]);
    pickingStart = false;
    if (game.source === "daily") game.source = "custom";
    ph()?.setHash(sharePayload());
    persistProgress();
    playHop();
    renderPlay();
    toast(`Start moved to ${alg(i)}.`);
  }

  function hopTo(i, fromHint = false) {
    game.path.push(i);
    game.visited.add(i);
    pickingStart = false;
    playHop();
    persistProgress();
    const stuck = legalTargets().length === 0;
    renderPlay();
    if (fromHint) {
      root.querySelector(`.kj-sq[data-i="${i}"]`)?.classList.add("hinting");
    }
    if (stuck) {
      stuckTimer = window.setTimeout(() => onStuck(), 280);
    }
  }

  function undoMove() {
    if (stuckTimer) {
      clearTimeout(stuckTimer);
      stuckTimer = null;
    }
    if (!game || game.over || game.path.length < 2) return;
    const last = game.path.pop();
    game.visited.delete(last);
    pickingStart = false;
    tone(280, 0.06, "sine", 0.04);
    persistProgress();
    renderPlay();
  }

  function giveHint() {
    if (!game || game.over) return;
    const next = warnsdorffMove();
    if (next == null) return;
    game.hintsUsed += 1;
    hopTo(next, true);
    toast(`Hint: hop to ${alg(next)}.`);
  }

  function onStuck() {
    stuckTimer = null;
    if (!game || game.over || legalTargets().length > 0) return;
    if (isTutorial()) {
      game.over = true;
      game.elapsed = currentElapsed();
      stopTimer();
      pt()?.stop("finished");
      const left = leftover();
      toast(left === 0 ? "Perfect practice tour." : "That’s a full stop — leftover squares are the score.");
      celebrateEnd();
      renderPlay();
      return;
    }
    const elapsed = currentElapsed();
    game.over = true;
    game.elapsed = elapsed;
    stopTimer();
    persistProgress();
    const left = leftover();
    const time = Math.round(game.elapsed);
    stats.playedCount += 1;
    if (left === 0) stats.perfectCount += 1;
    if (game.source === "daily" && (game.dailyDate || dateKey()) === dateKey()) {
      if (stats.lastDailyDate === dateKey() && stats.lastDailySolved) {
        /* already counted streak */
      } else if (stats.lastDailyDate === yesterdayKey()) {
        stats.currentStreak += 1;
      } else {
        stats.currentStreak = 1;
      }
      stats.lastDailyDate = dateKey();
      stats.lastDailySolved = true;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    }
    stats.bestLeft = stats.bestLeft == null ? left : Math.min(stats.bestLeft, left);
    stats.bestVisited = Math.max(stats.bestVisited || 0, game.path.length);
    stats.bestTime = stats.bestTime ? Math.min(stats.bestTime, time) : time;
    saveStats();
    ph()?.record({
      game: "knights-journey",
      title: `${left} left · ${alg(game.start)} · ${THEME_LABEL[game.theme]}${game.source === "daily" && game.dailyDate ? ` · ${game.dailyDate}` : ""}`,
      difficulty: DIFF_LABEL[difficulty],
      source: game.source,
      dailyDate: game.dailyDate || "",
      score: left,
      time,
      checks: 0,
      hints: game.hintsUsed,
      share: sharePayload()
    });
    renderPlay();
    celebrateEnd();
    showWin(left, time);
  }

  function celebrateEnd() {
    const cells = root.querySelectorAll(".kj-sq.visited");
    if (leftover() === 0) playVictory();
    else playStuck();
    const api = ph();
    if (api?.celebrate) api.celebrate(cells);
  }

  function showWin(left, time) {
    const app = root.querySelector(".kj-app");
    overlay = document.createElement("div");
    overlay.className = "kj-overlay";
    const perfect = left === 0;
    overlay.innerHTML = `
      <div class="kj-modal">
        <h2>${perfect ? "Perfect tour." : "No more hops."}</h2>
        <p style="text-align:center">${perfect ? "Every square visited." : `Score is leftover squares — ${left} left.`}</p>
        <div class="kj-win-stats">
          <div><b>${left}</b><span>Left</span></div>
          <div><b>${game.path.length}/64</b><span>Visited</span></div>
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${game.hintsUsed}</b><span>Hints</span></div>
        </div>
        <div class="kj-modal-actions">
          <button class="kj-btn gold" id="kj-again-win">Play again</button>
          <button class="kj-btn" id="kj-share-win">Copy link</button>
          <button class="kj-btn ghost" id="kj-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#kj-share-win")?.addEventListener("click", copyPuzzleLink);
    overlay.querySelector("#kj-again-win")?.addEventListener("click", playAgain);
    overlay.querySelector("#kj-menu-win")?.addEventListener("click", () => {
      overlay = null;
      quitToMenu();
    });
  }

  function isTutorial() {
    return !!(game && (game.tutorial || game.source === "tutorial"));
  }

  function leaveTutorial() {
    overlay?.remove();
    overlay = null;
    stopTimer();
    game = null;
    view = "splash";
    if (pt()?.isActive()) {
      pt().stop("skip");
      return;
    }
    renderSplash();
  }

  function beginTutorialPuzzle() {
    overlay?.remove();
    overlay = null;
    beginJourney({ start: CLASSIC_START, theme: "stones", source: "tutorial" });
  }

  function startTutorial() {
    const api = pt();
    if (!api) {
      showHelp();
      return;
    }
    if (game && !isTutorial()) persistProgress();
    overlay?.remove();
    overlay = null;
    stopTimer();
    if (!(view === "splash" && !game)) {
      game = null;
      view = "splash";
      renderSplash();
    }
    const host = root.querySelector(".kj-app");
    if (!host) return;
    api.start({
      host,
      getHost: () => root.querySelector(".kj-app") || root,
      gameId: "knights-journey",
      onDone: (reason) => {
        if (reason === "finished") return;
        overlay?.remove();
        overlay = null;
        stopTimer();
        game = null;
        view = "splash";
        renderSplash();
      },
      steps: [
        {
          title: "A knight’s tour",
          body: "The knight hops in an L: two squares one way and one square perpendicular. Visit every square at most once. When you cannot hop, leftover squares are your score — 0 is perfect.",
          placement: "center",
          nextLabel: "Start"
        },
        {
          title: "The board",
          body: "Classic start is b1, the queen’s knight. Stones sit on every square; landing gobbles the stone. Garden theme paints unused squares green and eaten ones red.",
          selector: "#kj-board",
          onEnter: () => beginTutorialPuzzle()
        },
        {
          title: "Legal hops",
          body: "On Easy, gold rings mark squares the knight can reach that still have a stone. From b1 that’s a3, c3, and d2. Normal hides the rings.",
          selector: ".kj-sq.legal"
        },
        {
          title: "Make a hop",
          body: "Tap a3. The knight jumps, the stone disappears, and that square is closed for the rest of the tour.",
          selector: '.kj-sq[data-i="16"]',
          advanceOn: "target"
        },
        {
          title: "Undo, hint, and overlays",
          body: "Undo backs up one hop. Hint follows Warnsdorff’s rule. Path and Numbers stay off unless you turn them on — they show the trail and visit order.",
          selector: "#kj-undo, #kj-hint, #kj-path, #kj-numbers",
          nextLabel: "Got it"
        }
      ]
    });
  }

  function maybeAutoTutorial() {
    if (!autoTutorialArmed) return;
    autoTutorialArmed = false;
    const api = pt();
    if (!api || api.seen("knights-journey")) return;
    window.setTimeout(() => {
      if (view === "splash" && !game) startTutorial();
    }, 450);
  }

  function showHelp() {
    const app = root.querySelector(".kj-app");
    const wrap = document.createElement("div");
    wrap.className = "kj-overlay";
    wrap.innerHTML = `
      <div class="kj-modal">
        <h2>How to play</h2>
        <ol>
          <li>The knight moves in an L: two squares, then one at a right angle.</li>
          <li>Every square starts available. Landing on it gobbles it — you cannot visit it again.</li>
          <li>Classic start is b1. Daily puzzles pick a start square from that day’s hash and use the theme you chose on the menu. Open Starting Position if you want a different square for a new journey.</li>
          <li>Easy marks legal hops. Normal does not. Path and Numbers overlays stay off until you turn them on.</li>
          <li>When there are no legal hops left, your score is the number of unvisited squares. Perfect is 0 — a full knight’s tour.</li>
          <li>Stones theme eats pebbles. Garden theme turns green squares red. Copy the share link to send this start and theme.</li>
        </ol>
        <div class="kj-modal-actions">
          <button class="kj-btn gold" id="kj-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#kj-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const t = root.querySelector("#kj-time");
      if (t) t.textContent = formatTime(currentElapsed());
    }, 250);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (!game || game.over) return;
    if (document.hidden) persistProgress();
  });

  document.addEventListener("keydown", (e) => {
    if (view !== "play" || !game) return;
    if (pt()?.isActive() && e.key === "Escape") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    if (e.key === "Escape") {
      e.preventDefault();
      quitToMenu();
      return;
    }
    if (game.over) return;
    if (e.key === "u" || e.key === "U" || ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      undoMove();
      return;
    }
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      giveHint();
    }
  });

  if (!tryShare()) {
    renderSplash();
    maybeAutoTutorial();
  }
})();
