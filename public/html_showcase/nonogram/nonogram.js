(() => {
  const STATS_KEY = "nonogram-stats-v1";
  const MUTE_KEY = "nonogram-muted";
  const DIFF_KEY = "nonogram-difficulty";
  const PROGRESS_KEY = "nonogram-progress-v1";

  const EMPTY = 0;
  const FILL = 1;
  const MARK = 2;

  const DIFFS = ["easy", "medium", "hard", "nightmare"];
  const SIZE = { easy: 5, medium: 10, hard: 15, nightmare: 20 };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", nightmare: "Nightmare" };
  const DIFF_BLURB = {
    easy: "5×5. A few bold shapes.",
    medium: "10×10. Room to hide a figure.",
    hard: "15×15. Longer runs, tighter gaps.",
    nightmare: "20×20. A full picture."
  };

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/><path d="M13 4h7v7M4 13h7v7"/></svg>',
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a6.5 6.5 0 1 1 0 13H11"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const root = document.getElementById("ng-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "easy";
  let toolMode = FILL;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let toastTimer = null;
  let timerId = null;
  let audioCtx = null;
  let stroke = null;
  let stats = loadStats();

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

  function lineClues(line) {
    const runs = [];
    let n = 0;
    for (const cell of line) {
      if (cell) n++;
      else if (n) {
        runs.push(n);
        n = 0;
      }
    }
    if (n) runs.push(n);
    return runs;
  }

  function stamp(grid, cx, cy, rx, ry, mirror, fill) {
    const n = grid.length;
    const rxs = Math.max(0.6, rx);
    const rys = Math.max(0.6, ry);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x - cx) / rxs;
        const dy = (y - cy) / rys;
        if (dx * dx + dy * dy <= 1) {
          grid[y][x] = fill;
          if (mirror) grid[y][n - 1 - x] = fill;
        }
      }
    }
  }

  function paint(size, rnd) {
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    const mirror = rnd() < 0.78;
    const half = mirror ? Math.ceil(size / 2) : size;
    const blobs = 2 + Math.floor(rnd() * (size <= 5 ? 2 : size <= 10 ? 4 : 6));
    for (let i = 0; i < blobs; i++) {
      const cx = Math.floor(rnd() * half);
      const cy = Math.floor(rnd() * size);
      const rx = 0.8 + rnd() * Math.max(1, size / (size <= 5 ? 2.4 : 5));
      const ry = 0.8 + rnd() * Math.max(1, size / (size <= 5 ? 2.2 : 4.2));
      stamp(grid, cx, cy, rx, ry, mirror, 1);
    }
    if (size >= 8 && rnd() < 0.55) {
      const cx = Math.floor(rnd() * Math.max(1, half - 1));
      const cy = 1 + Math.floor(rnd() * Math.floor(size / 3));
      stamp(grid, cx, cy, 0.6, 0.6, mirror, 0);
    }
    return grid;
  }

  function densityOk(grid) {
    const n = grid.length;
    let filled = 0;
    let emptyRows = 0;
    let fullRows = 0;
    for (const row of grid) {
      const c = row.reduce((sum, bit) => sum + bit, 0);
      filled += c;
      if (!c) emptyRows++;
      if (c === n) fullRows++;
    }
    const ratio = filled / (n * n);
    if (ratio < 0.18 || ratio > 0.64) return false;
    if (emptyRows > Math.floor(n * 0.4)) return false;
    if (fullRows > (n <= 5 ? 1 : 0)) return false;
    return true;
  }

  function makePuzzle(size, seed) {
    const rnd = mulberry32(seed >>> 0);
    let grid = paint(size, rnd);
    for (let i = 0; i < 20 && !densityOk(grid); i++) grid = paint(size, rnd);
    const solution = [];
    const rows = [];
    for (let y = 0; y < size; y++) {
      rows.push(lineClues(grid[y]));
      for (let x = 0; x < size; x++) solution.push(grid[y][x]);
    }
    const cols = [];
    for (let x = 0; x < size; x++) {
      const line = [];
      for (let y = 0; y < size; y++) line.push(grid[y][x]);
      cols.push(lineClues(line));
    }
    return { size, seed: seed >>> 0, solution, rows, cols };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      solvedCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastDailyDate: "",
      lastDailySolved: false,
      bestScore: 0,
      bestTime: 0
    };
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function ph() {
    return window.PuzzleHistory || null;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function scoreNow() {
    return ph()?.score100(currentElapsed(), game.checks, game.hints) ?? 0;
  }

  function tone(freq, dur, type = "sine", vol = 0.06) {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch { /* ignore */ }
  }

  function toast(msg) {
    const el = root.querySelector(".ng-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function todaySolved() {
    return stats.lastDailyDate === dateKey() && stats.lastDailySolved;
  }

  function dailySeed(day = dateKey()) {
    return hashString(`ng-daily-${day}-${difficulty}`);
  }

  function sharePayload() {
    if (!game) return null;
    const payload = { g: "nonogram", s: game.seed, d: game.difficulty, src: game.source || "random" };
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
    api.copy(url).then(() => toast("Share link copied"), () => toast(url));
  }

  function applyShare(payload) {
    if (!payload) return false;
    const api = ph();
    if (payload.g && payload.g !== "nonogram") {
      if (api) location.href = api.urlFor(payload);
      return true;
    }
    if (payload.d && DIFFS.includes(payload.d)) setDifficulty(payload.d);
    const seed = Number(payload.s);
    if (!Number.isFinite(seed)) return false;
    const source = payload.src === "daily" ? "daily" : (payload.src || "shared");
    beginPuzzle(seed, source, payload.day || (source === "daily" ? dateKey() : ""));
    return true;
  }

  function tryShare() {
    const api = ph();
    if (!api) return false;
    if (api.handoff("nonogram")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "nonogram")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "nonogram",
      host: root.querySelector(".ng-app") || root,
      overlayClass: "ng-overlay",
      onReplay: applyShare,
      toast
    });
  }

  function setDifficulty(next) {
    if (!DIFFS.includes(next)) return;
    difficulty = next;
    localStorage.setItem(DIFF_KEY, difficulty);
  }

  function currentElapsed() {
    if (!game) return 0;
    if (game.solved) return game.elapsed;
    return game.elapsed + (Date.now() - game.tick) / 1000;
  }

  function stampElapsed() {
    if (!game || game.solved) return;
    game.elapsed = currentElapsed();
    game.tick = Date.now();
  }

  function persistProgress() {
    if (!game || game.solved) {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    stampElapsed();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      seed: game.seed,
      difficulty: game.difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      marks: Array.from(game.marks),
      undo: game.undo,
      elapsed: game.elapsed,
      checks: game.checks,
      hints: game.hints
    }));
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return Number.isFinite(p?.seed) && DIFFS.includes(p.difficulty) && Array.isArray(p.marks);
    } catch {
      return false;
    }
  }

  function resumeProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "");
      if (!p) return false;
      setDifficulty(p.difficulty);
      const built = makePuzzle(SIZE[p.difficulty], p.seed);
      if (p.marks.length !== built.solution.length) return false;
      startGame(built, p.source || "random", p.dailyDate || "", {
        marks: p.marks,
        undo: Array.isArray(p.undo) ? p.undo : [],
        elapsed: Number(p.elapsed) || 0,
        checks: Number(p.checks) || 0,
        hints: Number(p.hints) || 0
      });
      return true;
    } catch {
      return false;
    }
  }

  function headerHtml(subtitle) {
    return `
      <header class="ng-header">
        <div class="ng-brand">
          <div class="ng-mark" aria-hidden="true"><b></b><b></b><b></b><b></b></div>
          <div>
            <h1>Nonogram</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="ng-header-actions">
          <button class="ng-icon-btn" id="ng-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          ${game ? `<button class="ng-icon-btn" id="ng-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="ng-icon-btn" id="ng-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#ng-help")?.addEventListener("click", showHelp);
    root.querySelector("#ng-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#ng-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#ng-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const el = root.querySelector("#ng-time");
      if (el) el.textContent = formatTime(currentElapsed());
    }, 250);
  }

  function render() {
    stopTimer();
    if (view === "splash") renderSplash();
    else renderPlay();
  }

  function renderSplash() {
    ph()?.clearHash();
    const solvedToday = todaySolved();
    const bestTime = stats.bestTime ? formatTime(stats.bestTime) : "—";
    root.innerHTML = `
      <div class="ng-app">
        ${headerHtml("Picture logic")}
        <div class="ng-view">
          <div class="ng-splash">
            <div class="ng-hero">
              <h2>Paint the picture.</h2>
              <p>Each number is a run of filled cells, in order, with at least one gap between runs. Finish every row and column and the picture appears.</p>
            </div>
            <div class="ng-stats-row">
              <div class="ng-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="ng-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="ng-stat"><b>${stats.bestScore || "—"}</b><span>Best /100</span></div>
              <div class="ng-stat"><b>${bestTime}</b><span>Best time</span></div>
            </div>
            <div class="ng-play-grid">
              ${hasProgress() ? `
              <button class="ng-play-card primary" data-mode="resume">
                <span class="ng-play-icon">${ICONS.play}</span>
                <span>
                  <strong>Continue puzzle</strong>
                  <span>Pick up the grid on this device. The timer stays with it.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
                <button class="ng-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                  <span class="ng-play-icon">${ICONS.daily}</span>
                  <span>
                    <strong>Daily puzzle</strong>
                    <span>Today’s grid is ${SIZE[difficulty]}×${SIZE[difficulty]}.</span>
                    ${solvedToday ? "<em>Played today</em>" : ""}
                  </span>
                </button>
                <button type="button" class="ph-cal-launch" id="ng-calendar" title="Pick another date" aria-label="Pick another day's puzzle">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="ng-play-card" data-mode="new">
                <span class="ng-play-icon">${ICONS.play}</span>
                <span>
                  <strong>New puzzle</strong>
                  <span>${DIFF_LABEL[difficulty]} · ${SIZE[difficulty]}×${SIZE[difficulty]}.</span>
                </span>
              </button>
            </div>
            <div class="ng-diff">
              <div class="ng-diff-label">Size</div>
              <div class="ng-seg" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${DIFF_BLURB[d]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="ng-splash-links">
              <button class="ng-how" id="ng-examples">Solved examples</button>
              <button class="ng-how" id="ng-how">How to play</button>
              <button class="ng-how" id="ng-history">View history</button>
            </div>
          </div>
        </div>
        <div class="ng-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#ng-how")?.addEventListener("click", showHelp);
    root.querySelector("#ng-examples")?.addEventListener("click", openExamples);
    root.querySelector("#ng-history")?.addEventListener("click", openHistory);
    root.querySelector("#ng-calendar")?.addEventListener("click", openDailyCalendar);
    root.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setDifficulty(btn.getAttribute("data-diff"));
        renderSplash();
      });
    });
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode === "resume") {
          if (!resumeProgress()) toast("No saved puzzle found.");
        } else if (mode === "daily") {
          beginDaily();
        } else {
          beginPuzzle(hashString(`ng-${Date.now()}-${Math.random()}`), "random", "");
        }
      });
    });
  }

  function beginDaily(day = dateKey()) {
    beginPuzzle(dailySeed(day), "daily", day);
  }

  function openDaily(day) {
    const rec = ph()?.findDaily?.("nonogram", day, difficulty);
    if (rec?.difficulty && DIFFS.includes(rec.difficulty)) setDifficulty(rec.difficulty);
    const seed = Number(rec?.share?.s);
    beginPuzzle(Number.isFinite(seed) ? seed : dailySeed(day), "daily", day);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "nonogram",
      host: root.querySelector(".ng-app") || root,
      overlayClass: "ng-overlay",
      title: "Daily Nonogram",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#ng-calendar")
    });
  }

  function beginPuzzle(seed, source, dailyDate) {
    const built = makePuzzle(SIZE[difficulty], seed);
    startGame(built, source, source === "daily" ? (dailyDate || dateKey()) : "", null);
  }

  function startGame(built, source, dailyDate, saved) {
    overlay?.remove();
    overlay = null;
    game = {
      ...built,
      difficulty,
      source: source || "random",
      dailyDate: dailyDate || "",
      marks: Uint8Array.from(saved?.marks || new Array(built.solution.length).fill(EMPTY)),
      undo: saved?.undo || [],
      elapsed: saved?.elapsed || 0,
      checks: saved?.checks || 0,
      hints: saved?.hints || 0,
      solved: false,
      bad: new Set(),
      tick: Date.now()
    };
    toolMode = FILL;
    view = "play";
    persistProgress();
    renderPlay();
  }

  function clueHtml(runs) {
    if (!runs.length) return "<span>0</span>";
    return runs.map((n) => `<span>${n}</span>`).join("");
  }

  function maxRuns(lines) {
    return lines.reduce((max, line) => Math.max(max, line.length || 1), 1);
  }

  function rowStates(y) {
    const line = [];
    for (let x = 0; x < game.size; x++) line.push(game.marks[y * game.size + x] === FILL ? 1 : 0);
    return line;
  }

  function colStates(x) {
    const line = [];
    for (let y = 0; y < game.size; y++) line.push(game.marks[y * game.size + x] === FILL ? 1 : 0);
    return line;
  }

  function runsMatch(line, clues) {
    const runs = lineClues(line);
    if (runs.length !== clues.length) return false;
    for (let i = 0; i < runs.length; i++) if (runs[i] !== clues[i]) return false;
    return true;
  }

  function inkCount() {
    let have = 0;
    let need = 0;
    for (let i = 0; i < game.solution.length; i++) {
      if (game.solution[i]) need++;
      if (game.marks[i] === FILL) have++;
    }
    return { have, need };
  }

  function renderPlay() {
    if (!game) return;
    const n = game.size;
    const clueW = `calc(${maxRuns(game.rows)} * 1.15em + 10px)`;
    const clueH = `calc(${maxRuns(game.cols)} * 1.15em + 8px)`;
    const cellMax = n <= 5 ? 54 : n <= 10 ? 36 : n <= 15 ? 28 : 22;
    const cols = game.cols.map((runs, x) => `<div class="ng-col-clue" data-col="${x}">${clueHtml(runs)}</div>`).join("");
    const lines = [];
    for (let y = 0; y < n; y++) {
      const cells = [];
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const shade = ((x / 5) | 0) % 2 !== ((y / 5) | 0) % 2 ? " shade" : "";
        const edge = `${x % 5 === 4 && x !== n - 1 ? " b-right" : ""}${y % 5 === 4 && y !== n - 1 ? " b-bottom" : ""}`;
        const state = game.marks[i] === FILL ? " filled" : game.marks[i] === MARK ? " marked" : "";
        const bad = game.bad.has(i) ? " bad" : "";
        cells.push(`<button type="button" class="ng-cell${shade}${edge}${state}${bad}" data-i="${i}" aria-label="Row ${y + 1}, column ${x + 1}"></button>`);
      }
      lines.push(`
        <div class="ng-line">
          <div class="ng-row-clue" data-row="${y}">${clueHtml(game.rows[y])}</div>
          ${cells.join("")}
        </div>
      `);
    }
    const ink = inkCount();
    const subtitle = game.source === "daily"
      ? `Daily · ${prettyDay(game.dailyDate || dateKey())} · ${n}×${n}`
      : `${DIFF_LABEL[game.difficulty]} · ${n}×${n}`;
    root.innerHTML = `
      <div class="ng-app">
        ${headerHtml(subtitle)}
        <div class="ng-view">
          <div class="ng-play">
            <div class="ng-hud">
              <div class="ng-hud-item"><span class="lbl">Ink</span><span class="val" id="ng-ink">${ink.have}/${ink.need}</span></div>
              <div class="ng-hud-item"><span class="lbl">Time</span><span class="val" id="ng-time">${formatTime(currentElapsed())}</span></div>
              <div class="ng-toolbar">
                <button class="ng-btn ${toolMode === FILL ? "active" : ""}" id="ng-fill">Fill</button>
                <button class="ng-btn ${toolMode === MARK ? "active" : ""}" id="ng-mark">Mark</button>
                <button class="ng-btn" id="ng-undo" ${game.undo.length ? "" : "disabled"}>${ICONS.undo} Undo</button>
                <button class="ng-btn" id="ng-hint">${ICONS.hint} Hint</button>
                <button class="ng-btn" id="ng-check">${ICONS.check} Check</button>
                <button class="ng-btn ghost" id="ng-menu">Menu</button>
              </div>
            </div>
            <div class="ng-paper">
              <div class="ng-sheet" id="ng-board" style="--n:${n};--clue-w:${clueW};--clue-h:${clueH};--cell-max:${cellMax}px">
                <div class="ng-colhead"><div class="ng-corner"></div>${cols}</div>
                ${lines.join("")}
              </div>
              <div class="ng-status" id="ng-status">Fill the runs. Mark the gaps.</div>
            </div>
          </div>
        </div>
        <div class="ng-toast"></div>
      </div>
    `;
    bindChrome();
    bindBoard();
    syncLines();
    root.querySelector("#ng-fill")?.addEventListener("click", () => setTool(FILL));
    root.querySelector("#ng-mark")?.addEventListener("click", () => setTool(MARK));
    root.querySelector("#ng-undo")?.addEventListener("click", undo);
    root.querySelector("#ng-hint")?.addEventListener("click", hint);
    root.querySelector("#ng-check")?.addEventListener("click", checkBoard);
    root.querySelector("#ng-menu")?.addEventListener("click", quitToMenu);
    startTimer();
  }

  function setTool(next) {
    toolMode = next;
    root.querySelector("#ng-fill")?.classList.toggle("active", next === FILL);
    root.querySelector("#ng-mark")?.classList.toggle("active", next === MARK);
  }

  function bindBoard() {
    const board = root.querySelector("#ng-board");
    if (!board) return;
    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("pointermove", onPointerMove);
    board.addEventListener("pointerup", onPointerUp);
    board.addEventListener("pointercancel", onPointerUp);
    board.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function onPointerDown(e) {
    if (!game || game.solved) return;
    const cell = e.target.closest("[data-i]");
    if (!cell) return;
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const i = Number(cell.getAttribute("data-i"));
    const tool = e.button === 2 ? MARK : toolMode;
    const next = game.marks[i] === tool ? EMPTY : tool;
    stroke = { next, id: e.pointerId, batch: [] };
    paintStroke(i);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    tone(tool === FILL ? 520 : 340, 0.04, "triangle", 0.03);
  }

  function onPointerMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit && hit.closest ? hit.closest("[data-i]") : null;
    if (!cell || !e.currentTarget.contains(cell)) return;
    paintStroke(Number(cell.getAttribute("data-i")));
  }

  function onPointerUp(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    if (stroke.batch.length) game.undo.push(stroke.batch);
    stroke = null;
    const undoBtn = root.querySelector("#ng-undo");
    if (undoBtn) undoBtn.disabled = !game.undo.length;
    if (isSolved()) onSolved();
    else persistProgress();
  }

  function paintStroke(i) {
    if (game.marks[i] === stroke.next) return;
    stroke.batch.push([i, game.marks[i]]);
    game.marks[i] = stroke.next;
    game.bad.delete(i);
    syncCell(i);
    syncLines();
    syncHud();
  }

  function syncCell(i) {
    const el = root.querySelector(`[data-i="${i}"]`);
    if (!el) return;
    el.classList.toggle("filled", game.marks[i] === FILL);
    el.classList.toggle("marked", game.marks[i] === MARK);
    el.classList.toggle("bad", game.bad.has(i));
  }

  function syncLines() {
    for (let y = 0; y < game.size; y++) {
      root.querySelector(`[data-row="${y}"]`)?.classList.toggle("done", runsMatch(rowStates(y), game.rows[y]));
    }
    for (let x = 0; x < game.size; x++) {
      root.querySelector(`[data-col="${x}"]`)?.classList.toggle("done", runsMatch(colStates(x), game.cols[x]));
    }
  }

  function syncHud() {
    const ink = inkCount();
    const el = root.querySelector("#ng-ink");
    if (el) el.textContent = `${ink.have}/${ink.need}`;
  }

  function isSolved() {
    for (let i = 0; i < game.solution.length; i++) {
      if ((game.marks[i] === FILL) !== !!game.solution[i]) return false;
    }
    return true;
  }

  function undo() {
    if (!game || game.solved || !game.undo.length || stroke) return;
    const batch = game.undo.pop();
    for (const [i, prev] of batch) {
      game.marks[i] = prev;
      game.bad.delete(i);
      syncCell(i);
    }
    syncLines();
    syncHud();
    const undoBtn = root.querySelector("#ng-undo");
    if (undoBtn) undoBtn.disabled = !game.undo.length;
    persistProgress();
  }

  function hint() {
    if (!game || game.solved) return;
    const unknown = [];
    for (let i = 0; i < game.solution.length; i++) {
      const want = game.solution[i] ? FILL : MARK;
      if (game.marks[i] !== want && !(want === MARK && game.marks[i] === EMPTY)) {
        if (game.solution[i] && game.marks[i] !== FILL) unknown.push(i);
        else if (!game.solution[i] && game.marks[i] === FILL) unknown.push(i);
      }
    }
    const pool = unknown.length ? unknown : [];
    if (!pool.length) {
      toast("Nothing left to reveal.");
      return;
    }
    const i = pool[(Math.random() * pool.length) | 0];
    const next = game.solution[i] ? FILL : EMPTY;
    game.undo.push([[i, game.marks[i]]]);
    game.marks[i] = next;
    game.bad.delete(i);
    game.hints += 1;
    tone(660, 0.07, "sine", 0.04);
    syncCell(i);
    syncLines();
    syncHud();
    const undoBtn = root.querySelector("#ng-undo");
    if (undoBtn) undoBtn.disabled = false;
    if (isSolved()) onSolved();
    else {
      persistProgress();
      toast(next === FILL ? "Filled one cell." : "Cleared one cell.");
    }
  }

  function checkBoard() {
    if (!game || game.solved) return;
    game.checks += 1;
    game.bad = new Set();
    for (let i = 0; i < game.solution.length; i++) {
      if (game.marks[i] === FILL && !game.solution[i]) game.bad.add(i);
      if (game.marks[i] === MARK && game.solution[i]) game.bad.add(i);
    }
    root.querySelectorAll(".ng-cell").forEach((el) => {
      const i = Number(el.getAttribute("data-i"));
      el.classList.toggle("bad", game.bad.has(i));
    });
    persistProgress();
    if (!game.bad.size) toast(isSolved() ? "Solved." : "No mistakes so far.");
    else toast(`${game.bad.size} cell${game.bad.size === 1 ? "" : "s"} to reconsider.`);
    if (isSolved()) onSolved();
  }

  function onSolved() {
    if (!game || game.solved) return;
    stampElapsed();
    game.solved = true;
    stopTimer();
    const time = Math.round(game.elapsed);
    const score = scoreNow();
    stats.solvedCount += 1;
    if (game.source === "daily" && (game.dailyDate || dateKey()) === dateKey()) {
      if (!(stats.lastDailyDate === dateKey() && stats.lastDailySolved)) {
        stats.currentStreak = stats.lastDailyDate === yesterdayKey() ? stats.currentStreak + 1 : 1;
        stats.lastDailyDate = dateKey();
        stats.lastDailySolved = true;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      }
    }
    stats.bestScore = Math.max(stats.bestScore || 0, score);
    stats.bestTime = stats.bestTime ? Math.min(stats.bestTime, time) : time;
    saveStats();
    localStorage.removeItem(PROGRESS_KEY);
    ph()?.record({
      game: "nonogram",
      title: game.source === "daily"
        ? `Daily ${DIFF_LABEL[game.difficulty]}${game.dailyDate ? ` · ${game.dailyDate}` : ""}`
        : `${DIFF_LABEL[game.difficulty]} · ${game.size}×${game.size}`,
      difficulty: game.difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      score,
      time,
      checks: game.checks,
      hints: game.hints,
      share: sharePayload()
    });
    tone(523, 0.1);
    setTimeout(() => tone(659, 0.1), 90);
    setTimeout(() => tone(784, 0.18), 180);
    const cells = root.querySelectorAll(".ng-cell.filled");
    const show = () => showWin(score, time);
    if (ph()?.celebrate) ph().celebrate(cells, show);
    else show();
  }

  function showWin(score, time) {
    const app = root.querySelector(".ng-app");
    if (!app) return;
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "ng-overlay";
    overlay.innerHTML = `
      <div class="ng-modal">
        <h2>Picture complete.</h2>
        <p style="text-align:center">${DIFF_LABEL[game.difficulty]} · ${game.size}×${game.size}</p>
        <div class="ng-win-stats">
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${score}/100</b><span>Score</span></div>
          <div><b>${game.checks}</b><span>Checks</span></div>
          <div><b>${game.hints}</b><span>Hints</span></div>
        </div>
        <div class="ng-modal-actions">
          <button class="ng-btn gold" id="ng-next">Next puzzle</button>
          <button class="ng-btn" id="ng-share-win">Copy link</button>
          <button class="ng-btn ghost" id="ng-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#ng-next")?.addEventListener("click", () => {
      if (game.source === "daily") beginPuzzle(hashString(`ng-${Date.now()}`), "random", "");
      else beginPuzzle(hashString(`ng-${Date.now()}-${Math.random()}`), "random", "");
    });
    overlay.querySelector("#ng-share-win")?.addEventListener("click", copyPuzzleLink);
    overlay.querySelector("#ng-menu-win")?.addEventListener("click", quitToMenu);
  }

  function quitToMenu() {
    overlay?.remove();
    overlay = null;
    if (game && !game.solved) persistProgress();
    game = null;
    view = "splash";
    render();
  }

  const LESSONS = [
    {
      title: "A number is one run",
      grid: ["00100", "01110", "11111", "01110", "00100"],
      line: "row",
      index: 0,
      body: "The highlighted row is clued 1. That means one filled cell, and no second run. The empty cells beside it are padding — the number says how long the run is, not which column it sits in."
    },
    {
      title: "Touching cells are one number",
      grid: ["00100", "01110", "11111", "01110", "00100"],
      line: "row",
      index: 1,
      body: "This row is clued 3: three filled cells in a row. They have to touch. Split them apart and the clue would change — for example to 1 1, or 2 1."
    },
    {
      title: "A full line is a single number",
      grid: ["00100", "01110", "11111", "01110", "00100"],
      line: "row",
      index: 2,
      body: "Every cell in this row is filled, so there is no gap. The clue is one 5, not 1 1 1 1 1. A new number starts only after an empty cell."
    },
    {
      title: "Two numbers need a gap",
      grid: ["10001", "10001", "11111", "10001", "10001"],
      line: "row",
      index: 0,
      body: "The clue 1 1 is two runs, read left to right. First one filled cell, then at least one empty cell, then one more. The × marks are that required gap. If those filled cells touched, the clue would be 2."
    },
    {
      title: "Columns read the same picture",
      grid: ["10001", "10001", "11111", "10001", "10001"],
      line: "col",
      index: 0,
      body: "Column clues run top to bottom across the same cells. This column is filled from top to bottom with no gap, so its clue is 5. A solved board has to satisfy the rows and the columns at once."
    },
    {
      title: "Zero means none",
      grid: ["00000", "11100", "10100", "10100", "11100"],
      line: "row",
      index: 0,
      body: "A 0 means the line has no filled cells. Every square in the highlighted row stays empty. You can mark them with × so you don’t try to paint them later."
    },
    {
      title: "Both directions agree",
      grid: ["00000", "11100", "10100", "10100", "11100"],
      line: "",
      index: -1,
      body: "Every row clue and every column clue matches these cells, so the picture is a valid solution. The top row is 0. The third row is 1 1, because one empty cell splits two filled cells. The first column is 4: four filled cells under that empty top cell."
    }
  ];

  function parseLessonGrid(rows) {
    return rows.map((row) => [...row].map((ch) => (ch === "1" ? 1 : 0)));
  }

  function lessonHasGap(lesson) {
    if (lesson.line !== "row" && lesson.line !== "col") return false;
    const grid = parseLessonGrid(lesson.grid);
    const bits = lesson.line === "row" ? grid[lesson.index] : grid.map((row) => row[lesson.index]);
    let runs = 0;
    let i = 0;
    while (i < bits.length) {
      if (!bits[i]) {
        i++;
        continue;
      }
      runs += 1;
      while (i < bits.length && bits[i]) i++;
    }
    return runs > 1;
  }

  function lessonSheetHtml(lesson) {
    const grid = parseLessonGrid(lesson.grid);
    const n = grid.length;
    const rowClues = grid.map((row) => lineClues(row));
    const colClues = [];
    for (let x = 0; x < n; x++) {
      const line = [];
      for (let y = 0; y < n; y++) line.push(grid[y][x]);
      colClues.push(lineClues(line));
    }
    const focused = lesson.line === "row" || lesson.line === "col";
    const gaps = new Set();
    if (focused) {
      const bits = lesson.line === "row"
        ? grid[lesson.index]
        : grid.map((row) => row[lesson.index]);
      let previousEnd = -1;
      let i = 0;
      while (i < n) {
        if (!bits[i]) {
          i++;
          continue;
        }
        if (previousEnd >= 0) {
          for (let g = previousEnd + 1; g < i; g++) gaps.add(g);
        }
        while (i < n && bits[i]) i++;
        previousEnd = i - 1;
      }
    }
    const clueW = `calc(${maxRuns(rowClues)} * 1.15em + 10px)`;
    const clueH = `calc(${maxRuns(colClues)} * 1.15em + 8px)`;
    const cols = colClues.map((runs, x) => {
      const hot = lesson.line === "col" && x === lesson.index;
      return `<div class="ng-col-clue${hot ? " is-hot" : ""}${lesson.line ? "" : " done"}" data-col="${x}">${clueHtml(runs)}</div>`;
    }).join("");
    const lines = [];
    for (let y = 0; y < n; y++) {
      const cells = [];
      for (let x = 0; x < n; x++) {
        const onLine = lesson.line === "row" ? y === lesson.index : lesson.line === "col" ? x === lesson.index : false;
        const along = lesson.line === "row" ? x : y;
        const filled = grid[y][x] ? " filled" : "";
        const cls = [
          "ng-cell",
          onLine ? "is-line" : "",
          onLine && grid[y][x] ? "is-run" : "",
          onLine && gaps.has(along) ? "is-gap" : "",
          filled
        ].filter(Boolean).join(" ");
        cells.push(`<div class="${cls}"></div>`);
      }
      const hot = lesson.line === "row" && y === lesson.index;
      lines.push(`
        <div class="ng-line">
          <div class="ng-row-clue${hot ? " is-hot" : ""}${lesson.line ? "" : " done"}">${clueHtml(rowClues[y])}</div>
          ${cells.join("")}
        </div>
      `);
    }
    return `
      <div class="ng-sheet${focused ? " is-focused" : " is-complete"}" style="--n:${n};--clue-w:${clueW};--clue-h:${clueH};--cell-max:34px">
        <div class="ng-colhead"><div class="ng-corner"></div>${cols}</div>
        ${lines.join("")}
      </div>
    `;
  }

  function openExamples() {
    const app = root.querySelector(".ng-app");
    if (!app) return;
    root.querySelector(".ng-overlay")?.remove();
    let step = 0;
    const wrap = document.createElement("div");
    wrap.className = "ng-overlay";

    function paint() {
      const lesson = LESSONS[step];
      const last = step === LESSONS.length - 1;
      wrap.innerHTML = `
        <div class="ng-modal ng-lesson-modal" role="dialog" aria-labelledby="ng-lesson-title">
          <p class="ng-lesson-kicker">Solved example ${step + 1} of ${LESSONS.length}</p>
          <h2 id="ng-lesson-title">${lesson.title}</h2>
          <div class="ng-lesson-board">${lessonSheetHtml(lesson)}</div>
          ${lesson.line ? `
            <p class="ng-lesson-key"><span><i class="swatch run"></i>Filled run</span>${lessonHasGap(lesson) ? `<span><i class="swatch gap">×</i>Gap between runs</span>` : ""}</p>
          ` : `<p class="ng-lesson-key">Every row and column matches.</p>`}
          <p class="ng-lesson-copy">${lesson.body}</p>
          <div class="ng-modal-actions">
            <button class="ng-btn" id="ng-lesson-back" ${step === 0 ? "disabled" : ""}>Back</button>
            <button class="ng-btn gold" id="ng-lesson-next">${last ? "Done" : "Next"}</button>
          </div>
        </div>
      `;
      wrap.querySelector("#ng-lesson-back")?.addEventListener("click", () => {
        if (step > 0) {
          step -= 1;
          paint();
        }
      });
      wrap.querySelector("#ng-lesson-next")?.addEventListener("click", () => {
        if (last) wrap.remove();
        else {
          step += 1;
          paint();
        }
      });
    }

    paint();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
    app.appendChild(wrap);
  }

  function showHelp() {
    const app = root.querySelector(".ng-app");
    if (!app) return;
    const wrap = document.createElement("div");
    wrap.className = "ng-overlay";
    wrap.innerHTML = `
      <div class="ng-modal">
        <h2>How to play</h2>
        <ol>
          <li>Each number is a run of filled cells in that row or column, read in order.</li>
          <li>Runs are separated by at least one empty cell. A 0 means the whole line stays empty.</li>
          <li>Fill a cell, or mark it with an × when you know it is a gap. Click again to clear it. Drag to paint.</li>
          <li>A line turns green when the cells you have filled already match its numbers.</li>
          <li>The picture is done when every row and every column matches at the same time.</li>
        </ol>
        <div class="ng-modal-actions">
          <button class="ng-btn gold" id="ng-help-examples">Solved examples</button>
          <button class="ng-btn" id="ng-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#ng-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.querySelector("#ng-help-examples")?.addEventListener("click", () => {
      wrap.remove();
      openExamples();
    });
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  if (!tryShare()) render();
})();
