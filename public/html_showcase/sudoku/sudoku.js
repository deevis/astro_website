(() => {
  const STATS_KEY = "sudoku-stats-v1";
  const MUTE_KEY = "sudoku-muted";
  const DIFF_KEY = "sudoku-difficulty";
  const PROGRESS_KEY = "sudoku-progress-v1";
  const NOTES_KEY = "sudoku-notes-mode";

  const DIFFS = ["easy", "medium", "hard", "expert"];
  const GIVEN_COUNTS = { easy: 40, medium: 32, hard: 26, expert: 22 };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

  const ICONS = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    random: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6l2 3h8v13H4z"/><path d="m9 14 2 2 4-5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const root = document.getElementById("su-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "medium";
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let notesMode = localStorage.getItem(NOTES_KEY) === "1";
  let overlay = null;
  let timerId = null;
  let toastTimer = null;
  let audioCtx = null;
  let stats = loadStats();

  const PEERS = buildPeers();

  function buildPeers() {
    /** @type {number[][]} */
    const peers = Array.from({ length: 81 }, () => []);
    for (let i = 0; i < 81; i++) {
      const r = (i / 9) | 0;
      const c = i % 9;
      const br = ((r / 3) | 0) * 3;
      const bc = ((c / 3) | 0) * 3;
      const set = new Set();
      for (let k = 0; k < 9; k++) {
        set.add(r * 9 + k);
        set.add(k * 9 + c);
        set.add((br + ((k / 3) | 0)) * 9 + bc + (k % 3));
      }
      set.delete(i);
      peers[i] = [...set];
    }
    return peers;
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

  function fisherYates(arr, rnd) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((parsed.bestScore || 0) > 100) parsed.bestScore = 0;
        return parsed;
      }
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

  function ph() {
    return window.PuzzleHistory || null;
  }

  function sharePayload() {
    if (!game) return null;
    const payload = { g: "sudoku", s: game.seed, d: difficulty, src: game.source || "random" };
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
    if (payload.g && payload.g !== "sudoku") {
      if (api) location.href = api.urlFor(payload);
      return true;
    }
    if (payload.d && DIFFS.includes(payload.d)) {
      difficulty = payload.d;
      localStorage.setItem(DIFF_KEY, difficulty);
    }
    const seed = Number(payload.s);
    if (!Number.isFinite(seed)) return false;
    beginPuzzle(seed, payload.src === "daily" ? "daily" : (payload.src || "shared"), payload.day);
    return true;
  }

  function tryShare() {
    const api = ph();
    if (!api) return false;
    if (api.handoff("sudoku")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "sudoku")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "sudoku",
      host: root.querySelector(".su-app") || root,
      overlayClass: "su-overlay",
      onReplay: applyShare,
      toast
    });
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function prettyDay(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

  function toast(msg) {
    const el = root.querySelector(".su-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function headerHtml(subtitle) {
    return `
      <header class="su-header">
        <div class="su-brand">
          <div class="su-mark" aria-hidden="true">SU</div>
          <div class="su-brand-text">
            <h1>Sudoku</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="su-header-actions">
          <button class="su-icon-btn" id="su-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          ${game ? `<button class="su-icon-btn" id="su-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="su-icon-btn" id="su-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#su-help")?.addEventListener("click", showHelp);
    root.querySelector("#su-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#su-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#su-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  /* ---------- Generator ---------- */
  function bitCount(n) {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }

  function lowestBit(n) {
    return 31 - Math.clz32(n & -n);
  }

  function boxOf(i) {
    const r = (i / 9) | 0;
    const c = i % 9;
    return ((r / 3) | 0) * 3 + ((c / 3) | 0);
  }

  /**
   * Count solutions up to `limit`. Mutates a working copy.
   * Returns 0, 1, or >= limit.
   */
  function countSolutions(puzzle, limit = 2) {
    const grid = puzzle.slice();
    const rows = new Uint16Array(9);
    const cols = new Uint16Array(9);
    const boxes = new Uint16Array(9);
    for (let i = 0; i < 81; i++) {
      const n = grid[i];
      if (!n) continue;
      const bit = 1 << n;
      const r = (i / 9) | 0;
      rows[r] |= bit;
      cols[i % 9] |= bit;
      boxes[boxOf(i)] |= bit;
    }

    let count = 0;

    function solve() {
      if (count >= limit) return;
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (grid[i]) continue;
        const r = (i / 9) | 0;
        const used = rows[r] | cols[i % 9] | boxes[boxOf(i)];
        const mask = (~used) & 0x3fe;
        const n = bitCount(mask);
        if (n === 0) return;
        if (n < bestCount) {
          bestCount = n;
          best = i;
          bestMask = mask;
          if (n === 1) break;
        }
      }
      if (best < 0) {
        count += 1;
        return;
      }
      const r = (best / 9) | 0;
      const c = best % 9;
      const b = boxOf(best);
      let mask = bestMask;
      while (mask) {
        const bit = mask & -mask;
        mask ^= bit;
        const n = lowestBit(bit);
        grid[best] = n;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        solve();
        rows[r] ^= bit;
        cols[c] ^= bit;
        boxes[b] ^= bit;
        grid[best] = 0;
        if (count >= limit) return;
      }
    }

    solve();
    return count;
  }

  function solveGrid(puzzle) {
    const grid = puzzle.slice();
    const rows = new Uint16Array(9);
    const cols = new Uint16Array(9);
    const boxes = new Uint16Array(9);
    for (let i = 0; i < 81; i++) {
      const n = grid[i];
      if (!n) continue;
      const bit = 1 << n;
      rows[(i / 9) | 0] |= bit;
      cols[i % 9] |= bit;
      boxes[boxOf(i)] |= bit;
    }

    function solve() {
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (grid[i]) continue;
        const used = rows[(i / 9) | 0] | cols[i % 9] | boxes[boxOf(i)];
        const mask = (~used) & 0x3fe;
        const n = bitCount(mask);
        if (n === 0) return false;
        if (n < bestCount) {
          bestCount = n;
          best = i;
          bestMask = mask;
          if (n === 1) break;
        }
      }
      if (best < 0) return true;
      const r = (best / 9) | 0;
      const c = best % 9;
      const b = boxOf(best);
      let mask = bestMask;
      while (mask) {
        const bit = mask & -mask;
        mask ^= bit;
        const n = lowestBit(bit);
        grid[best] = n;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        if (solve()) return true;
        rows[r] ^= bit;
        cols[c] ^= bit;
        boxes[b] ^= bit;
        grid[best] = 0;
      }
      return false;
    }

    return solve() ? grid : null;
  }

  function fillComplete(rnd) {
    const grid = Array(81).fill(0);
    for (let band = 0; band < 3; band++) {
      const nums = fisherYates([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
      let k = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          grid[(band * 3 + r) * 9 + band * 3 + c] = nums[k++];
        }
      }
    }
    const solved = solveGrid(grid);
    if (!solved) throw new Error("Failed to complete grid");
    return solved;
  }

  function generatePuzzle(seed, givenTarget) {
    const rnd = mulberry32(seed >>> 0);
    const solution = fillComplete(rnd);
    const puzzle = solution.slice();
    const order = fisherYates([...Array(81).keys()], rnd);

    for (let k = 0; k < 81 - givenTarget; k++) {
      puzzle[order[k]] = 0;
    }

    let restore = 81 - givenTarget - 1;
    while (restore >= 0 && countSolutions(puzzle, 2) !== 1) {
      puzzle[order[restore]] = solution[order[restore]];
      restore -= 1;
    }

    return { puzzle, solution, given: puzzle.filter(Boolean).length };
  }

  function dailySeed(day = dateKey()) {
    return hashString(`su-daily-${day}-${difficulty}`);
  }

  function beginDaily(day = dateKey()) {
    beginPuzzle(dailySeed(day), "daily", day);
  }

  function openDaily(day) {
    const rec = ph()?.findDaily?.("sudoku", day, difficulty);
    if (rec?.difficulty && DIFFS.includes(rec.difficulty)) {
      difficulty = rec.difficulty;
      localStorage.setItem(DIFF_KEY, difficulty);
    }
    const seed = Number(rec?.share?.s);
    const useSeed = Number.isFinite(seed) ? seed : dailySeed(day);
    beginPuzzle(useSeed, "daily", day, rec || null);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "sudoku",
      host: root.querySelector(".su-app") || root,
      overlayClass: "su-overlay",
      title: "Daily Sudoku",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#su-calendar")
    });
  }

  function todaySolved() {
    return stats.lastDailyDate === dateKey() && stats.lastDailySolved;
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return Array.isArray(p?.puzzle) && p.puzzle.length === 81 && !p.solved;
    } catch {
      return false;
    }
  }

  /* ---------- Views ---------- */
  function render() {
    stopTimer();
    if (view === "splash") renderSplash();
    else renderPlay();
  }

  function renderSplash() {
    ph()?.clearHash();
    const solvedToday = todaySolved();
    const given = GIVEN_COUNTS[difficulty];
    root.innerHTML = `
      <div class="su-app">
        ${headerHtml("Classic 9×9 puzzle")}
        <div class="su-view">
          <div class="su-splash">
            <div class="su-hero">
              <h2>Fill the grid.</h2>
              <p>Every row, column, and 3×3 box must contain 1–9 once. Difficulty is how many squares you start with — the rest is pencil, pattern, and patience.</p>
            </div>
            <div class="su-stats-row">
              <div class="su-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="su-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="su-stat"><b>${stats.bestScore || "—"}</b><span>Best /100</span></div>
              <div class="su-stat"><b>${stats.bestTime ? formatTime(stats.bestTime) : "—"}</b><span>Best time</span></div>
            </div>
            <div class="su-play-grid">
              ${hasProgress() ? `
              <button class="su-play-card primary" data-mode="resume">
                <span class="su-play-icon">${ICONS.random}</span>
                <span>
                  <strong>Continue puzzle</strong>
                  <span>Pick up the grid you were filling. Notes and timer stay on this device.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
              <button class="su-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                <span class="su-play-icon">${ICONS.daily}</span>
                <span>
                  <strong>Daily puzzle</strong>
                  <span>One shared board for ${dateKey()} at this difficulty.</span>
                  ${solvedToday ? "<em>Solved today</em>" : ""}
                </span>
              </button>
              <button type="button" class="ph-cal-launch" id="su-calendar" title="Pick another date" aria-label="Pick another day's puzzle">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="su-play-card" data-mode="random">
                <span class="su-play-icon">${ICONS.random}</span>
                <span>
                  <strong>New puzzle</strong>
                  <span>A fresh unique grid with ${given} squares given.</span>
                </span>
              </button>
            </div>
            <div class="su-diff">
              <div class="su-diff-label">Difficulty</div>
              <div class="su-seg" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${GIVEN_COUNTS[d]} given</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="su-splash-links">
              <button class="su-how" id="su-how">How to play</button>
              <button class="su-how" id="su-history">View history</button>
            </div>
          </div>
        </div>
        <div class="su-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#su-how")?.addEventListener("click", showHelp);
    root.querySelector("#su-history")?.addEventListener("click", openHistory);
    root.querySelector("#su-calendar")?.addEventListener("click", openDailyCalendar);
    root.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        difficulty = btn.getAttribute("data-diff") || "medium";
        localStorage.setItem(DIFF_KEY, difficulty);
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
          beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
        }
      });
    });
  }

  function startFromGenerated(seed, source, puzzle, solution, givenCount, dailyDate) {
    const given = new Set();
    const grid = puzzle.slice();
    for (let i = 0; i < 81; i++) {
      if (puzzle[i]) given.add(i);
    }
    game = {
      seed,
      source,
      puzzle,
      solution,
      grid,
      given,
      notes: Array.from({ length: 81 }, () => 0),
      selected: firstOpenIndex(given, grid),
      startedAt: Date.now(),
      elapsed: 0,
      hintsUsed: 0,
      checksUsed: 0,
      wrong: new Set(),
      solved: false,
      givenCount,
      dailyDate: source === "daily" ? (dailyDate || dateKey()) : ""
    };
    view = "play";
    ph()?.setHash(sharePayload());
  }

  function beginPuzzle(seed, source, dailyDate, review) {
    showGenerating();
    const target = GIVEN_COUNTS[difficulty] ?? 32;
    window.setTimeout(() => {
      try {
        const { puzzle, solution, given } = generatePuzzle(seed, target);
        startFromGenerated(seed, source, puzzle, solution, given, dailyDate);
        if (review) applyReview(review);
        else persistProgress();
        renderPlay();
      } catch {
        toast("Could not build a puzzle. Try again.");
        view = "splash";
        renderSplash();
      }
    }, 30);
  }

  function applyReview(review) {
    game.grid = game.solution.slice();
    game.notes = Array.from({ length: 81 }, () => 0);
    game.wrong = new Set();
    game.solved = true;
    game.elapsed = Number(review.time) || 0;
    game.checksUsed = Number(review.checks) || 0;
    game.hintsUsed = 0;
    stopTimer();
  }

  function playAgain() {
    if (!game) return;
    overlay?.remove();
    overlay = null;
    startFromGenerated(game.seed, game.source, game.puzzle, game.solution, game.givenCount, game.dailyDate);
    persistProgress();
    renderPlay();
    toast("Play again.");
  }

  function showGenerating() {
    root.innerHTML = `
      <div class="su-app">
        ${headerHtml("Building a unique grid")}
        <div class="su-view">
          <p class="su-generating">Carving ${GIVEN_COUNTS[difficulty]} given squares…</p>
        </div>
      </div>
    `;
    bindChrome();
  }

  function firstOpenIndex(given, grid) {
    for (let i = 0; i < 81; i++) {
      if (!given.has(i) && !grid[i]) return i;
    }
    return 0;
  }

  function filledCount() {
    return game.grid.filter(Boolean).length;
  }

  function isSolved() {
    return game.grid.every((n, i) => n === game.solution[i]);
  }

  function digitComplete(n) {
    return game.grid.filter((v) => v === n).length === 9;
  }

  function conflictsAt(i) {
    const n = game.grid[i];
    if (!n) return false;
    return PEERS[i].some((j) => game.grid[j] === n);
  }

  function scoreNow() {
    const api = ph();
    if (api) return api.score100(currentElapsed(), game.checksUsed);
    return Math.max(0, 100 - Math.max(0, Math.ceil(currentElapsed() / 300) - 1) * 10 - Math.max(0, game.checksUsed - 1) * 10);
  }

  function currentElapsed() {
    if (!game) return 0;
    if (game.solved) return game.elapsed;
    return game.elapsed + (Date.now() - game.startedAt) / 1000;
  }

  function persistProgress() {
    if (!game || game.solved) {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      seed: game.seed,
      source: game.source,
      difficulty,
      puzzle: game.puzzle,
      solution: game.solution,
      grid: game.grid,
      notes: game.notes,
      given: [...game.given],
      elapsed: currentElapsed(),
      hintsUsed: game.hintsUsed,
      checksUsed: game.checksUsed,
      givenCount: game.givenCount,
      dailyDate: game.dailyDate || ""
    }));
  }

  function resumeProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (!Array.isArray(p?.puzzle) || p.puzzle.length !== 81) return false;
      difficulty = p.difficulty || difficulty;
      startFromGenerated(p.seed, p.source || "random", p.puzzle, p.solution, p.givenCount || p.given?.length || 0, p.dailyDate);
      game.grid = p.grid || game.grid;
      game.notes = p.notes || game.notes;
      game.given = new Set(p.given || [...game.given]);
      game.elapsed = p.elapsed || 0;
      game.startedAt = Date.now();
      game.hintsUsed = p.hintsUsed || 0;
      game.checksUsed = p.checksUsed || 0;
      persistProgress();
      renderPlay();
      return true;
    } catch {
      return false;
    }
  }

  function noteSpans(mask) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      `<span class="${mask & (1 << n) ? "on" : ""}">${mask & (1 << n) ? n : ""}</span>`
    ).join("");
  }

  function cellHtml(i, selected, selectedVal) {
    const n = game.grid[i];
    const cls = ["su-cell"];
    if (i === selected) cls.push("selected");
    else if (selectedVal && n === selectedVal) cls.push("same");
    else if (PEERS[selected]?.includes(i)) cls.push("peer");
    if (game.given.has(i)) cls.push("given");
    if (conflictsAt(i)) cls.push("conflict");
    if (game.wrong.has(i)) cls.push("wrong");
    const r = (i / 9) | 0;
    const c = i % 9;
    const inner = n
      ? String(n)
      : game.notes[i]
        ? `<span class="su-cell-notes">${noteSpans(game.notes[i])}</span>`
        : "";
    return `<button type="button" class="${cls.join(" ")}" data-i="${i}" aria-label="Row ${r + 1} column ${c + 1}${n ? `, ${n}` : ""}">${inner}</button>`;
  }

  function boardHtml(selected, selectedVal) {
    const boxes = [];
    for (let b = 0; b < 9; b++) {
      const br = ((b / 3) | 0) * 3;
      const bc = (b % 3) * 3;
      const cells = [];
      for (let k = 0; k < 9; k++) {
        const i = (br + ((k / 3) | 0)) * 9 + bc + (k % 3);
        cells.push(cellHtml(i, selected, selectedVal));
      }
      boxes.push(`<div class="su-box">${cells.join("")}</div>`);
    }
    return boxes.join("");
  }

  function renderPlay() {
    const selected = game.selected;
    const selectedVal = game.grid[selected] || 0;

    root.innerHTML = `
      <div class="su-app">
        ${headerHtml(game.source === "daily" ? `Daily · ${prettyDay(game.dailyDate || dateKey())} · ${DIFF_LABEL[difficulty]}` : `${DIFF_LABEL[difficulty]} puzzle`)}
        <div class="su-view">
          <div class="su-hud">
            <div class="su-hud-item"><span class="lbl">Time</span><span class="val" id="su-time">${formatTime(currentElapsed())}</span></div>
            <div class="su-hud-item"><span class="lbl">Score</span><span class="val" id="su-score">${scoreNow()}</span></div>
            <div class="su-hud-item"><span class="lbl">Filled</span><span class="val" id="su-filled">${filledCount()}/81</span></div>
            <div class="su-toolbar">
              ${game.solved ? `
              ${game.source === "daily" ? `<button class="su-btn gold" id="su-again">Play again</button>` : `<button class="su-btn gold" id="su-next-bar">Next puzzle</button>`}
              ${game.source === "daily" ? `<button class="su-btn" id="su-next-bar">Next puzzle</button>` : ""}
              <button class="su-btn ghost" id="su-quit">Menu</button>
              ` : `
              <button class="su-btn ${notesMode ? "active" : ""}" id="su-notes">${ICONS.pencil} Notes</button>
              <button class="su-btn" id="su-hint">${ICONS.hint} Hint</button>
              <button class="su-btn" id="su-check">Check</button>
              <button class="su-btn ghost" id="su-quit">Menu</button>
              `}
            </div>
          </div>
          <div class="su-play-layout">
            <div class="su-paper" id="su-board" tabindex="0">
              <div class="su-board" role="grid">${boardHtml(selected, selectedVal)}</div>
            </div>
            <div class="su-helpers">
              <div class="su-panel">
                <h3>Digits</h3>
                <div class="su-pad">
                  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
                    `<button type="button" class="${digitComplete(n) ? "used" : ""} ${selectedVal === n ? "selected" : ""}" data-n="${n}">${n}</button>`
                  ).join("")}
                  <button type="button" class="wide" data-n="0">Erase</button>
                </div>
                <div class="su-hint">${notesMode ? "Notes on — tap a digit to pencil it in." : "Tap a square, then a digit. Shift or Notes for pencil marks."}</div>
              </div>
            </div>
          </div>
          ${game.solved ? `
          <div class="su-solved-bar">
            <div class="su-solved-copy">
              <strong>Solved.</strong>
              <span>${formatTime(Math.round(game.elapsed))} · ${scoreNow()}/100 · ${game.checksUsed} check${game.checksUsed === 1 ? "" : "s"} · ${DIFF_LABEL[difficulty]}</span>
            </div>
            <div class="su-solved-actions">
              ${game.source === "daily" ? `<button class="su-btn gold" id="su-again-bar">Play again</button>` : `<button class="su-btn gold" id="su-next-winbar">Next puzzle</button>`}
              <button class="su-btn" id="su-share-bar">Copy link</button>
              <button class="su-btn ghost" id="su-menu-bar">Menu</button>
            </div>
          </div>` : ""}
        </div>
        <div class="su-toast"></div>
      </div>
    `;
    bindChrome();
    bindPlay();
    if (!game.solved) startTimer();
    root.querySelector("#su-board")?.focus({ preventScroll: true });
  }

  function bindPlay() {
    root.querySelector("#su-quit")?.addEventListener("click", () => {
      persistProgress();
      view = "splash";
      game = null;
      render();
    });
    root.querySelector("#su-hint")?.addEventListener("click", giveHint);
    root.querySelector("#su-check")?.addEventListener("click", checkBoard);
    root.querySelector("#su-again")?.addEventListener("click", playAgain);
    root.querySelector("#su-again-bar")?.addEventListener("click", playAgain);
    root.querySelector("#su-share-bar")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#su-next-bar")?.addEventListener("click", () => {
      beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#su-next-winbar")?.addEventListener("click", () => {
      beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#su-menu-bar")?.addEventListener("click", () => {
      view = "splash";
      game = null;
      render();
    });
    root.querySelector("#su-notes")?.addEventListener("click", () => {
      notesMode = !notesMode;
      localStorage.setItem(NOTES_KEY, notesMode ? "1" : "0");
      renderPlay();
    });
    root.querySelectorAll(".su-cell").forEach((el) => {
      el.addEventListener("click", () => selectIndex(Number(el.getAttribute("data-i"))));
    });
    root.querySelectorAll("[data-n]").forEach((el) => {
      el.addEventListener("click", () => place(Number(el.getAttribute("data-n")), notesMode));
    });
  }

  function selectIndex(i) {
    if (!game || game.solved) return;
    game.selected = i;
    refreshSelection();
    root.querySelector("#su-board")?.focus({ preventScroll: true });
  }

  function refreshSelection() {
    const selected = game.selected;
    const selectedVal = game.grid[selected] || 0;
    root.querySelectorAll(".su-cell").forEach((el) => {
      const i = Number(el.getAttribute("data-i"));
      el.classList.toggle("selected", i === selected);
      el.classList.toggle("same", !!(selectedVal && game.grid[i] === selectedVal && i !== selected));
      el.classList.toggle("peer", PEERS[selected]?.includes(i) && !(selectedVal && game.grid[i] === selectedVal));
    });
    root.querySelectorAll("[data-n]").forEach((el) => {
      const n = Number(el.getAttribute("data-n"));
      el.classList.toggle("selected", n === selectedVal && n !== 0);
    });
  }

  function place(n, asNote) {
    if (!game || game.solved) return;
    const i = game.selected;
    if (game.given.has(i)) {
      toast("That square was given.");
      tone(180, 0.08, "square", 0.04);
      return;
    }
    if (n === 0) {
      game.grid[i] = 0;
      game.notes[i] = 0;
      game.wrong.delete(i);
      tone(240, 0.05, "sine", 0.04);
      persistProgress();
      renderPlay();
      return;
    }

    if (asNote) {
      game.grid[i] = 0;
      game.notes[i] ^= (1 << n);
      game.wrong.delete(i);
      tone(320, 0.04, "sine", 0.04);
      persistProgress();
      renderPlay();
      return;
    }

    game.grid[i] = n;
    game.notes[i] = 0;
    for (const j of PEERS[i]) game.notes[j] &= ~(1 << n);
    tone(520, 0.05, "sine", 0.05);
    game.wrong.delete(i);
    persistProgress();
    if (isSolved()) {
      renderPlay();
      onSolved();
      return;
    }
    renderPlay();
  }

  function giveHint() {
    if (!game || game.solved) return;
    const empties = [];
    for (let i = 0; i < 81; i++) {
      if (!game.given.has(i) && game.grid[i] !== game.solution[i]) empties.push(i);
    }
    if (!empties.length) return;
    empties.sort((a, b) => candidateCount(a) - candidateCount(b));
    const i = empties[0];
    game.hintsUsed += 1;
    game.grid[i] = game.solution[i];
    game.notes[i] = 0;
    game.given.add(i);
    game.wrong.delete(i);
    game.selected = i;
    tone(660, 0.1, "triangle", 0.06);
    persistProgress();
    if (isSolved()) {
      renderPlay();
      onSolved();
    } else {
      renderPlay();
      toast(`Filled r${((i / 9) | 0) + 1}c${(i % 9) + 1} with ${game.solution[i]}`);
    }
  }

  function candidateCount(i) {
    const used = new Set();
    for (const j of PEERS[i]) if (game.grid[j]) used.add(game.grid[j]);
    return 9 - used.size;
  }

  function checkBoard() {
    if (!game || game.solved) return;
    game.checksUsed += 1;
    game.wrong = new Set();
    let mistakes = 0;
    for (let i = 0; i < 81; i++) {
      if (!game.grid[i] || game.given.has(i)) continue;
      if (game.grid[i] !== game.solution[i]) {
        game.wrong.add(i);
        mistakes += 1;
      }
    }
    persistProgress();
    renderPlay();
    if (mistakes === 0) {
      toast(filledCount() === game.given.size ? "No entries to check yet." : "No mistakes so far.");
      tone(500, 0.08);
    } else {
      toast(`${mistakes} square${mistakes === 1 ? " looks" : "s look"} wrong.`);
      tone(170, 0.12, "square", 0.05);
    }
  }

  function onKey(e) {
    if (view !== "play" || !game || root.querySelector(".su-overlay")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    if (/^[1-9]$/.test(key)) {
      e.preventDefault();
      place(Number(key), notesMode || e.shiftKey);
      return;
    }
    if (key === "Backspace" || key === "Delete" || key === "0") {
      e.preventDefault();
      place(0, false);
      return;
    }
    if (key === "n" || key === "N" || key === "p" || key === "P") {
      e.preventDefault();
      notesMode = !notesMode;
      localStorage.setItem(NOTES_KEY, notesMode ? "1" : "0");
      renderPlay();
      return;
    }
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
    if (key in moves) {
      e.preventDefault();
      const next = game.selected + moves[key];
      if (next >= 0 && next < 81) {
        if ((key === "ArrowLeft" || key === "ArrowRight") && ((next / 9) | 0) !== ((game.selected / 9) | 0) && Math.abs(moves[key]) === 1) return;
        selectIndex(next);
      }
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      persistProgress();
      view = "splash";
      game = null;
      render();
    }
  }

  function onSolved() {
    const elapsed = currentElapsed();
    game.solved = true;
    game.elapsed = elapsed;
    stopTimer();
    persistProgress();
    const score = scoreNow();
    const time = Math.round(game.elapsed);
    stats.solvedCount += 1;
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
    stats.bestScore = Math.max(stats.bestScore || 0, score);
    stats.bestTime = stats.bestTime ? Math.min(stats.bestTime, time) : time;
    saveStats();
    ph()?.record({
      game: "sudoku",
      title: game.source === "daily" ? `Daily ${DIFF_LABEL[difficulty]}${game.dailyDate ? ` · ${game.dailyDate}` : ""}` : `${DIFF_LABEL[difficulty]} puzzle`,
      difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      score,
      time,
      checks: game.checksUsed,
      share: sharePayload()
    });
    tone(523, 0.12);
    setTimeout(() => tone(659, 0.12), 90);
    setTimeout(() => tone(784, 0.18), 180);
    showWin(score, time);
  }

  function showWin(score, time) {
    const app = root.querySelector(".su-app");
    overlay = document.createElement("div");
    overlay.className = "su-overlay";
    overlay.innerHTML = `
      <div class="su-modal">
        <h2>Solved.</h2>
        <p style="text-align:center">${DIFF_LABEL[difficulty]} · ${game.givenCount} given</p>
        <div class="su-win-stats">
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${score}/100</b><span>Score</span></div>
          <div><b>${game.checksUsed}</b><span>Checks</span></div>
        </div>
        <div class="su-modal-actions">
          <button class="su-btn gold" id="su-next">Next puzzle</button>
          <button class="su-btn" id="su-again-win">Play again</button>
          <button class="su-btn" id="su-share-win">Copy link</button>
          <button class="su-btn ghost" id="su-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#su-next")?.addEventListener("click", () => {
      overlay = null;
      beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
    });
    overlay.querySelector("#su-share-win")?.addEventListener("click", copyPuzzleLink);
    overlay.querySelector("#su-again-win")?.addEventListener("click", playAgain);
    overlay.querySelector("#su-menu-win")?.addEventListener("click", () => {
      overlay = null;
      view = "splash";
      game = null;
      render();
    });
  }

  function showHelp() {
    const app = root.querySelector(".su-app");
    const wrap = document.createElement("div");
    wrap.className = "su-overlay";
    wrap.innerHTML = `
      <div class="su-modal">
        <h2>How to play</h2>
        <ol>
          <li>Place digits 1–9 so each row, column, and 3×3 box has every digit once.</li>
          <li>Difficulty is the number of starting squares: Easy 40, Medium 32, Hard 26, Expert 22.</li>
          <li>Select a square, then type or tap a digit. Given squares stay locked.</li>
          <li>Notes (or Shift + digit) pencil candidates. Hint fills one correct square.</li>
          <li>Check flags entries that don’t match the unique solution — it doesn’t auto-correct.</li>
          <li>Score is out of 100. Five minutes and one Check (or none) is perfect; every extra five minutes or extra Check costs 10. Copy the share link to send this exact board.</li>
        </ol>
        <div class="su-modal-actions">
          <button class="su-btn gold" id="su-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#su-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const t = root.querySelector("#su-time");
      const s = root.querySelector("#su-score");
      if (t) t.textContent = formatTime(currentElapsed());
      if (s) s.textContent = String(scoreNow());
    }, 250);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (!game || game.solved) return;
    if (document.hidden) persistProgress();
  });

  document.addEventListener("keydown", (e) => {
    if (view !== "play" || !game) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    onKey(e);
  });

  if (!tryShare()) renderSplash();
})();
