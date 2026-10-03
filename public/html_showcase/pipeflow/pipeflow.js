(() => {
  const STATS_KEY = "pipeflow-stats-v1";
  const MUTE_KEY = "pipeflow-muted";
  const DIFF_KEY = "pipeflow-difficulty";
  const PROGRESS_KEY = "pipeflow-progress-v2";
  const CAMPAIGN_KEY = "pipeflow-campaign-v1";
  const SET_KEY = "pipeflow-set-v1";
  const LEVEL_COUNT = 20;

  const DIFFS = ["easy", "medium", "hard", "nightmare"];
  const RULES = {
    easy: { size: 5, colors: 3, minLen: 4 },
    medium: { size: 6, colors: 4, minLen: 4 },
    hard: { size: 7, colors: 4, minLen: 5 },
    nightmare: { size: 8, colors: 5, minLen: 5 }
  };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", nightmare: "Nightmare" };
  const DIFF_BLURB = {
    easy: "5×5 · 3 colors",
    medium: "6×6 · 4 colors",
    hard: "7×7 · 4 colors",
    nightmare: "8×8 · 5 colors"
  };
  const LEVELS = [
    { size: 4, colors: 2, minLen: 3 },
    { size: 4, colors: 2, minLen: 4 },
    { size: 4, colors: 3, minLen: 3 },
    { size: 5, colors: 2, minLen: 4 },
    { size: 5, colors: 3, minLen: 3 },
    { size: 5, colors: 3, minLen: 4 },
    { size: 5, colors: 3, minLen: 4 },
    { size: 5, colors: 4, minLen: 3 },
    { size: 6, colors: 3, minLen: 4 },
    { size: 6, colors: 3, minLen: 4 },
    { size: 6, colors: 4, minLen: 4 },
    { size: 6, colors: 4, minLen: 4 },
    { size: 6, colors: 4, minLen: 5 },
    { size: 7, colors: 4, minLen: 4 },
    { size: 7, colors: 4, minLen: 5 },
    { size: 7, colors: 5, minLen: 4 },
    { size: 7, colors: 5, minLen: 5 },
    { size: 8, colors: 4, minLen: 5 },
    { size: 8, colors: 5, minLen: 5 },
    { size: 8, colors: 5, minLen: 6 }
  ];
  const COLORS = [
    { name: "Blue" },
    { name: "Green" },
    { name: "Gold" },
    { name: "Red" },
    { name: "Violet" }
  ];

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l12-7z"/></svg>',
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  const root = document.getElementById("pf-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let gesture = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "easy";
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let toastTimer = null;
  let timerId = null;
  let audioCtx = null;
  let mapDay = dateKey();
  let stats = loadStats();

  function rulesFor(diff) {
    return RULES[diff] || RULES.easy;
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

  function neighbors(size, i) {
    const x = i % size;
    const y = (i / size) | 0;
    const out = [];
    if (y > 0) out.push(i - size);
    if (x + 1 < size) out.push(i + 1);
    if (y + 1 < size) out.push(i + size);
    if (x > 0) out.push(i - 1);
    return out;
  }

  function adjacent(size, a, b) {
    const ax = a % size;
    const ay = (a / size) | 0;
    const bx = b % size;
    const by = (b / size) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  function hamiltonian(size, rnd) {
    const total = size * size;
    for (let attempt = 0; attempt < 80; attempt++) {
      const visited = new Uint8Array(total);
      const path = [(rnd() * total) | 0];
      visited[path[0]] = 1;
      let stuck = false;
      while (path.length < total) {
        const cur = path[path.length - 1];
        const open = neighbors(size, cur).filter((n) => !visited[n]);
        if (!open.length) {
          stuck = true;
          break;
        }
        for (let i = open.length - 1; i > 0; i--) {
          const j = (rnd() * (i + 1)) | 0;
          const swap = open[i];
          open[i] = open[j];
          open[j] = swap;
        }
        let best = open[0];
        let bestScore = 99;
        for (const next of open) {
          const degree = neighbors(size, next).filter((n) => !visited[n]).length;
          if (degree < bestScore) {
            bestScore = degree;
            best = next;
          }
        }
        visited[best] = 1;
        path.push(best);
      }
      if (!stuck) return path;
    }
    return null;
  }

  function snake(size) {
    const path = [];
    for (let y = 0; y < size; y++) {
      if (y % 2 === 0) {
        for (let x = 0; x < size; x++) path.push(y * size + x);
      } else {
        for (let x = size - 1; x >= 0; x--) path.push(y * size + x);
      }
    }
    return path;
  }

  function splitPath(path, colors, minLen, rnd) {
    const total = path.length;
    let min = minLen;
    if (colors * min > total) min = Math.max(2, Math.floor(total / colors));
    const lengths = Array.from({ length: colors }, () => min);
    let extra = total - colors * min;
    const order = lengths.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const swap = order[i];
      order[i] = order[j];
      order[j] = swap;
    }
    let cursor = 0;
    while (extra > 0) {
      lengths[order[cursor % colors]] += 1;
      extra -= 1;
      cursor += 1;
    }
    const flows = [];
    let at = 0;
    for (let color = 0; color < colors; color++) {
      const solution = path.slice(at, at + lengths[color]);
      at += lengths[color];
      flows.push({
        color,
        a: solution[0],
        b: solution[solution.length - 1],
        solution
      });
    }
    return flows;
  }

  function makePuzzle(rule, seed) {
    const rnd = mulberry32(seed >>> 0);
    for (let attempt = 0; attempt < 60; attempt++) {
      const path = hamiltonian(rule.size, rnd);
      if (path) return splitPath(path, rule.colors, rule.minLen, rnd);
    }
    return splitPath(snake(rule.size), rule.colors, rule.minLen, rnd);
  }

  function connectedPath(size, flow, path) {
    if (!path || path.length < 2) return false;
    if (path[0] === path[path.length - 1]) return false;
    const startOk = path[0] === flow.a || path[0] === flow.b;
    const endOk = path[path.length - 1] === flow.a || path[path.length - 1] === flow.b;
    if (!startOk || !endOk || path[0] === path[path.length - 1]) return false;
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
      if (seen.has(path[i])) return false;
      seen.add(path[i]);
      if (i > 0 && !adjacent(size, path[i - 1], path[i])) return false;
    }
    return true;
  }

  function pipePercent(state) {
    const seen = new Set();
    state.paths.forEach((path) => {
      if (!path || path.length < 2) return;
      path.forEach((cell) => seen.add(cell));
    });
    const total = state.size * state.size;
    return total ? Math.round((seen.size / total) * 100) : 0;
  }

  function isWon(state) {
    const seen = new Set();
    for (const flow of state.flows) {
      const path = state.paths[flow.color];
      if (!connectedPath(state.size, flow, path)) return false;
      path.forEach((cell) => seen.add(cell));
    }
    return seen.size === state.size * state.size;
  }

  function clonePaths(paths) {
    return paths.map((path) => path.slice());
  }

  function emptyPaths(count) {
    return Array.from({ length: count }, () => []);
  }

  function pathLines(size, flows, paths) {
    const strokes = ["#4c8dff", "#3dce57", "#e0b84e", "#e23b42", "#b07cff"];
    return flows.map((flow) => {
      const path = paths[flow.color];
      if (!path || path.length < 2) return "";
      const color = strokes[flow.color];
      let lines = "";
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1];
        const to = path[i];
        const x1 = (from % size) + 0.5;
        const y1 = ((from / size) | 0) + 0.5;
        const x2 = (to % size) + 0.5;
        const y2 = ((to / size) | 0) + 0.5;
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="0.36" stroke-linecap="round"/>`;
      }
      return lines;
    }).join("");
  }

  function endColors(size, flows) {
    const ends = new Array(size * size).fill(-1);
    flows.forEach((flow) => {
      ends[flow.a] = flow.color;
      ends[flow.b] = flow.color;
    });
    return ends;
  }

  function stageMarkup(size, flows, paths, interactive) {
    const ends = endColors(size, flows);
    let cells = "";
    let rings = "";
    for (let i = 0; i < ends.length; i++) {
      const color = ends[i];
      const label = color < 0 ? "Empty square" : `${COLORS[color].name} ring`;
      cells += interactive
        ? `<button type="button" class="pf-cell" data-i="${i}" aria-label="${label}"></button>`
        : `<div class="pf-cell"></div>`;
      rings += color < 0 ? "<span></span>" : `<span class="pf-ring c${color}"></span>`;
    }
    return `
      <div class="pf-board">
        <div class="pf-stage" data-n="${size}" style="--n:${size}">
          <div class="pf-grid" data-n="${size}">${cells}</div>
          <svg class="pf-paths" viewBox="0 0 ${size} ${size}" fill="none" aria-hidden="true">${pathLines(size, flows, paths)}</svg>
          <div class="pf-ends">${rings}</div>
        </div>
      </div>
    `;
  }

  const LESSONS = [
    {
      title: "Drag one ring to the other",
      size: 3,
      flows: [{ color: 0, a: 1, b: 7, solution: [1, 4, 7] }],
      paths: [[1, 4, 7]],
      body: "A new board shows only the rings. Press one blue ring and drag through the empty squares to the other blue ring. That lays the pipe."
    },
    {
      title: "Pipes cannot cross",
      size: 3,
      flows: [
        { color: 0, a: 0, b: 8, solution: [0, 3, 6, 7, 8] },
        { color: 1, a: 2, b: 5, solution: [2, 1, 4, 5] }
      ],
      paths: [[0, 3, 6, 7, 8], [2, 1, 4, 5]],
      body: "Each color has its own pair. A pipe can only travel through empty squares, so two colors never share a square or cross."
    },
    {
      title: "Fill the grid",
      size: 3,
      flows: [
        { color: 3, a: 0, b: 8, solution: [0, 1, 2, 5, 4, 3, 6, 7, 8] }
      ],
      paths: [[0, 1, 2, 5, 4, 3, 6, 7, 8]],
      body: "The meter is how much of the grid the pipes cover. Joining the rings is not enough on its own. The board is done when every pair is joined and every square has pipe."
    }
  ];


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
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function scoreNow() {
    return ph()?.score100(currentElapsed(), 0, game ? game.hints : 0) ?? 0;
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
    const el = root.querySelector(".pf-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function todaySolved() {
    return solvedSet(dateKey()).size >= LEVEL_COUNT;
  }

  function loadCampaign() {
    try {
      const raw = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveCampaign(all) {
    const keys = Object.keys(all).sort();
    while (keys.length > 90) delete all[keys.shift()];
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(all));
  }

  function solvedSet(day) {
    const list = loadCampaign()[day];
    const set = new Set();
    if (!Array.isArray(list)) return set;
    for (const level of list) {
      const n = Number(level);
      if (n >= 1 && n <= LEVEL_COUNT) set.add(n);
    }
    return set;
  }

  function markSolved(day, level) {
    const all = loadCampaign();
    const set = solvedSet(day);
    set.add(level);
    all[day] = [...set].sort((a, b) => a - b);
    saveCampaign(all);
  }

  function emptyRun() {
    return { elapsed: 0, hints: 0, levels: {}, done: false, time: 0, score: 0 };
  }

  function loadRuns() {
    try {
      const raw = JSON.parse(localStorage.getItem(SET_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveRuns(all) {
    const keys = Object.keys(all).sort();
    while (keys.length > 90) delete all[keys.shift()];
    localStorage.setItem(SET_KEY, JSON.stringify(all));
  }

  function runFor(day) {
    const stored = loadRuns()[day];
    if (!stored || typeof stored !== "object") return emptyRun();
    const levels = {};
    if (stored.levels && typeof stored.levels === "object") {
      for (const [key, value] of Object.entries(stored.levels)) {
        const n = Number(key);
        if (n >= 1 && n <= LEVEL_COUNT && value && typeof value === "object") levels[n] = value;
      }
    }
    return {
      elapsed: Number(stored.elapsed) || 0,
      hints: Number(stored.hints) || 0,
      levels,
      done: !!stored.done,
      time: Number(stored.time) || 0,
      score: Number(stored.score) || 0
    };
  }

  function liveSetSeconds(day) {
    const run = runFor(day);
    if (game && game.source === "daily" && game.dailyDate === day && game.phase === "play" && !run.levels[game.level]) {
      return run.elapsed + currentElapsed();
    }
    const saved = readProgress();
    if (saved && saved.source === "daily" && saved.dailyDate === day && !run.levels[Number(saved.level)]) {
      return run.elapsed + (Number(saved.elapsed) || 0);
    }
    return run.done ? (run.time || run.elapsed) : run.elapsed;
  }

  function bankDailyLevel(day, level, time, hints, score) {
    const all = loadRuns();
    const run = runFor(day);
    if (!run.levels[level]) {
      run.levels[level] = { time, hints, score };
      run.elapsed += time;
      run.hints += hints;
    }
    let fresh = false;
    if (!run.done && Object.keys(run.levels).length >= LEVEL_COUNT) {
      const scores = Object.values(run.levels).map((item) => Number(item.score) || 0);
      run.done = true;
      run.time = run.elapsed;
      run.score = Math.round(scores.reduce((sum, value) => sum + value, 0) / LEVEL_COUNT);
      fresh = true;
    }
    all[day] = run;
    saveRuns(all);
    return { run, fresh };
  }

  function isUnlocked(day, level) {
    return level === 1 || solvedSet(day).has(level - 1);
  }

  function nextLevel(day) {
    const solved = solvedSet(day);
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      if (!solved.has(level)) return level;
    }
    return 0;
  }

  function dailyLevelSeed(day, level) {
    return hashString(`pf-daily-${day}-L${level}`);
  }

  function levelRule(level) {
    const index = Math.min(LEVEL_COUNT, Math.max(1, Number(level) || 1)) - 1;
    return LEVELS[index];
  }

  function describeRule(rule) {
    return `${rule.size}×${rule.size} · ${rule.colors} color${rule.colors === 1 ? "" : "s"}`;
  }

  function ruleBlurb(diff = difficulty) {
    if (diff && typeof diff === "object" && diff.size) return describeRule(diff);
    const level = /^level (\d+)$/.exec(String(diff || ""));
    if (level) return describeRule(levelRule(level[1]));
    return describeRule(rulesFor(diff));
  }

  function sharePayload() {
    if (!game) return null;
    const payload = {
      g: "pipeflow",
      s: game.seed,
      d: game.level ? `level ${game.level}` : game.difficulty,
      src: game.source || "random"
    };
    if (game.level) payload.lv = game.level;
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
    if (payload.g && payload.g !== "pipeflow") {
      if (api) location.href = api.urlFor(payload);
      return true;
    }
    const seed = Number(payload.s);
    const level = Number(payload.lv);
    if (level >= 1 && level <= LEVEL_COUNT) {
      const day = payload.day || dateKey();
      mapDay = day;
      beginLevel(level, day, Number.isFinite(seed) ? seed : null);
      return true;
    }
    if (payload.d && DIFFS.includes(payload.d)) setDifficulty(payload.d);
    if (!Number.isFinite(seed)) return false;
    const source = payload.src === "daily" ? "daily" : (payload.src || "shared");
    beginPuzzle(seed, source, payload.day || (source === "daily" ? dateKey() : ""));
    return true;
  }

  function tryShare() {
    const api = ph();
    if (!api) return false;
    if (api.handoff("pipeflow")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "pipeflow")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "pipeflow",
      host: root.querySelector(".pf-app") || root,
      overlayClass: "pf-overlay",
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
    if (game.phase !== "play") return game.elapsed;
    return game.elapsed + (Date.now() - game.tick) / 1000;
  }

  function stampElapsed() {
    if (!game || game.phase !== "play") return;
    game.elapsed = currentElapsed();
    game.tick = Date.now();
  }

  function persistProgress() {
    if (!game || game.phase !== "play") {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    stampElapsed();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      seed: game.seed,
      difficulty: game.level ? `level ${game.level}` : game.difficulty,
      level: game.level || 0,
      size: game.size,
      source: game.source,
      dailyDate: game.dailyDate || "",
      paths: clonePaths(game.paths),
      undo: game.undo,
      elapsed: game.elapsed,
      hints: game.hints
    }));
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      return Number.isFinite(saved?.seed) && Array.isArray(saved.paths) && (
        (saved.level >= 1 && saved.level <= LEVEL_COUNT) || DIFFS.includes(saved.difficulty)
      );
    } catch {
      return false;
    }
  }

  function headerHtml(subtitle) {
    return `
      <header class="pf-header">
        <div class="pf-brand">
          <div class="pf-mark" aria-hidden="true">${ICONS.mark}</div>
          <div>
            <h1>Pipeflow</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="pf-header-actions">
          <button class="pf-icon-btn" id="pf-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          ${game ? `<button class="pf-icon-btn" id="pf-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="pf-icon-btn" id="pf-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#pf-help")?.addEventListener("click", showHelp);
    root.querySelector("#pf-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#pf-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#pf-mute");
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

  function shownSeconds() {
    if (!game) return 0;
    if (game.source === "daily" && game.dailyDate) return liveSetSeconds(game.dailyDate);
    return currentElapsed();
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const el = root.querySelector("#pf-time");
      if (el) el.textContent = formatTime(shownSeconds());
    }, 250);
  }

  function render() {
    stopTimer();
    if (view === "splash") renderSplash();
    else renderPlay();
  }

  function renderSplash() {
    ph()?.clearHash();
    const bestSetTime = stats.bestSetTime ? formatTime(stats.bestSetTime) : "—";
    const saved = readProgress();
    const continueTitle = saved?.level ? `Continue level ${saved.level}` : "Continue board";
    const continueNote = saved?.level
      ? `Level ${saved.level} is still open. The timer stays with it.`
      : "Pick up the pipes on this device. The timer stays with them.";
    const solved = solvedSet(mapDay);
    const upcoming = nextLevel(mapDay);
    const setSeconds = liveSetSeconds(mapDay);
    const clock = setSeconds > 0 ? ` · ${formatTime(setSeconds)}` : "";
    const dayLabel = mapDay === dateKey() ? "Today" : "Earlier set";
    root.innerHTML = `
      <div class="pf-app">
        ${headerHtml("Connect the flow")}
        <div class="pf-view">
          <div class="pf-splash">
            <div class="pf-hero">
              <h2>Lay the pipes.</h2>
              <p>Each day is twenty boards. Clear one to open the next. The grid grows, and more colors join, as you go on. The board starts with a pair of rings for every color. Drag from one ring to its match to lay that pipe.</p>
            </div>
            <div class="pf-stats-row">
              <div class="pf-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="pf-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="pf-stat"><b>${stats.bestSetScore || "—"}</b><span>Best set</span></div>
              <div class="pf-stat"><b>${bestSetTime}</b><span>Best time</span></div>
            </div>
            ${hasProgress() ? `
            <div class="pf-play-grid">
              <button class="pf-play-card primary" data-mode="resume">
                <span class="pf-play-icon">${ICONS.play}</span>
                <span>
                  <strong>${continueTitle}</strong>
                  <span>${continueNote}</span>
                </span>
              </button>
            </div>` : ""}
            <section class="pf-map" aria-label="Daily boards">
              <div class="pf-map-head">
                <div>
                  <div class="pf-diff-label">${dayLabel}</div>
                  <strong>${prettyDay(mapDay)}</strong>
                  <span>${solved.size} of ${LEVEL_COUNT}${clock}${upcoming ? ` · next is ${describeRule(levelRule(upcoming))}` : " · set complete"}</span>
                </div>
                <button type="button" class="ph-cal-launch" id="pf-calendar" title="Pick another date" aria-label="Pick another day's set">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <div class="pf-levels">
                ${LEVELS.map((_, index) => levelButtonHtml(index + 1, solved, upcoming)).join("")}
              </div>
              <div class="pf-map-actions">
                ${mapDay !== dateKey() ? `<button class="pf-how" id="pf-today">Back to today</button>` : ""}
                <button class="pf-btn gold" id="pf-next-level" ${upcoming ? "" : "disabled"}>${upcoming ? "Next" : "Done"}</button>
              </div>
            </section>
            <div class="pf-play-grid">
              <button class="pf-play-card" data-mode="new">
                <span class="pf-play-icon">${ICONS.play}</span>
                <span>
                  <strong>Practice board</strong>
                  <span>${DIFF_LABEL[difficulty]} · ${ruleBlurb()}.</span>
                </span>
              </button>
            </div>
            <div class="pf-diff">
              <div class="pf-diff-label">Practice</div>
              <div class="pf-seg" role="group" aria-label="Practice difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${DIFF_BLURB[d]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="pf-splash-links">
              <button class="pf-how" id="pf-examples">Solved examples</button>
              <button class="pf-how" id="pf-how">How to play</button>
              <button class="pf-how" id="pf-history">View history</button>
            </div>
          </div>
        </div>
        <div class="pf-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#pf-how")?.addEventListener("click", showHelp);
    root.querySelector("#pf-examples")?.addEventListener("click", openExamples);
    root.querySelector("#pf-history")?.addEventListener("click", openHistory);
    root.querySelector("#pf-calendar")?.addEventListener("click", openDailyCalendar);
    root.querySelector("#pf-today")?.addEventListener("click", () => {
      mapDay = dateKey();
      renderSplash();
    });
    root.querySelector("#pf-next-level")?.addEventListener("click", () => {
      const level = nextLevel(mapDay);
      if (level) beginLevel(level, mapDay);
    });
    root.querySelectorAll("[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = Number(btn.getAttribute("data-level"));
        if (!isUnlocked(mapDay, level)) return;
        beginLevel(level, mapDay);
      });
    });
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
          if (!resumeProgress()) toast("No saved board found.");
        } else {
          beginPuzzle(hashString(`pf-${Date.now()}-${Math.random()}`), "random", "");
        }
      });
    });
  }

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    } catch {
      return null;
    }
  }

  function levelButtonHtml(level, solved, upcoming) {
    const done = solved.has(level);
    const unlocked = level === 1 || solved.has(level - 1);
    const current = level === upcoming;
    const cls = ["pf-level", done ? "is-done" : "", current ? "is-current" : "", unlocked ? "" : "is-locked"].filter(Boolean).join(" ");
    const blurb = describeRule(levelRule(level));
    if (!unlocked) {
      return `<button type="button" class="${cls}" disabled aria-label="Level ${level}, locked. ${blurb}">${ICONS.lock}</button>`;
    }
    return `<button type="button" class="${cls}" data-level="${level}" aria-current="${current ? "true" : "false"}" aria-label="Level ${level}${done ? ", cleared" : ""}. ${blurb}"><b>${level}</b>${done ? '<i class="pf-level-check" aria-hidden="true">✓</i>' : ""}</button>`;
  }

  function openDaily(day) {
    mapDay = day;
    view = "splash";
    if (game && game.phase !== "play") game = null;
    render();
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "pipeflow",
      host: root.querySelector(".pf-app") || root,
      overlayClass: "pf-overlay",
      title: "Daily Pipeflow",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#pf-calendar")
    });
  }

  function pathsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every((path, i) => path.length === b[i].length && path.every((cell, j) => cell === b[i][j]));
  }

  function sanitizePaths(flows, size, saved) {
    const total = size * size;
    return flows.map((flow) => {
      const raw = saved?.paths?.[flow.color];
      if (!Array.isArray(raw)) return [];
      const path = [];
      for (const cell of raw) {
        const n = Number(cell);
        if (!Number.isInteger(n) || n < 0 || n >= total) return [];
        path.push(n);
      }
      return path;
    });
  }

  function sanitizeUndo(undo, colorCount, size) {
    if (!Array.isArray(undo)) return [];
    const total = size * size;
    const out = [];
    for (const snap of undo) {
      if (!Array.isArray(snap) || snap.length !== colorCount) continue;
      out.push(snap.map((path) => {
        if (!Array.isArray(path)) return [];
        const clean = [];
        for (const cell of path) {
          const n = Number(cell);
          if (!Number.isInteger(n) || n < 0 || n >= total) return [];
          clean.push(n);
        }
        return clean;
      }));
    }
    return out;
  }

  function beginLevel(level, day, seedOverride) {
    const rule = levelRule(level);
    const seed = Number.isFinite(seedOverride) ? seedOverride : dailyLevelSeed(day, level);
    const flows = makePuzzle(rule, seed);
    startGame({
      seed: seed >>> 0,
      difficulty: `level ${level}`,
      flows,
      size: rule.size,
      level,
      source: "daily",
      dailyDate: day
    }, null);
  }

  function beginPuzzle(seed, source) {
    const rule = rulesFor(difficulty);
    const flows = makePuzzle(rule, seed);
    startGame({
      seed: seed >>> 0,
      difficulty,
      flows,
      size: rule.size,
      level: 0,
      source: source || "random",
      dailyDate: ""
    }, null);
  }

  function resumeProgress() {
    try {
      const saved = readProgress();
      if (!saved || !Array.isArray(saved.paths)) return false;
      const level = Number(saved.level) || 0;
      const daily = level >= 1 && level <= LEVEL_COUNT;
      if (!daily && !DIFFS.includes(saved.difficulty)) return false;
      if (!daily) setDifficulty(saved.difficulty);
      const rule = daily ? levelRule(level) : rulesFor(saved.difficulty);
      const flows = makePuzzle(rule, saved.seed);
      if (saved.paths.length !== flows.length) return false;
      startGame({
        seed: saved.seed >>> 0,
        difficulty: daily ? `level ${level}` : saved.difficulty,
        flows,
        size: rule.size,
        level: daily ? level : 0,
        source: saved.source || (daily ? "daily" : "random"),
        dailyDate: daily ? (saved.dailyDate || mapDay) : ""
      }, saved);
      return true;
    } catch {
      return false;
    }
  }

  function startGame(built, saved) {
    overlay?.remove();
    overlay = null;
    gesture = null;
    const flows = built.flows;
    game = {
      seed: built.seed >>> 0,
      difficulty: built.difficulty,
      size: built.size,
      level: built.level || 0,
      flows,
      paths: sanitizePaths(flows, built.size, saved),
      source: built.source || "random",
      dailyDate: built.dailyDate || "",
      undo: sanitizeUndo(saved?.undo, flows.length, built.size),
      hints: saved?.hints || 0,
      elapsed: saved?.elapsed || 0,
      phase: "play",
      tick: Date.now()
    };
    view = "play";
    if (isWon(game)) {
      onSolved();
      return;
    }
    persistProgress();
    render();
  }

  function linkedCount() {
    if (!game) return 0;
    return game.flows.filter((flow) => connectedPath(game.size, flow, game.paths[flow.color])).length;
  }

  function cellIndexFromTarget(target) {
    const cell = target && target.closest ? target.closest("[data-i]") : null;
    if (!cell || !root.contains(cell)) return null;
    const index = Number(cell.getAttribute("data-i"));
    return Number.isInteger(index) ? index : null;
  }

  function cellFromPoint(event) {
    return cellIndexFromTarget(document.elementFromPoint(event.clientX, event.clientY));
  }

  function armGesture() {
    if (!gesture || gesture.armed) return;
    const color = gesture.color;
    const index = gesture.start;
    const flow = game.flows[color];
    if (index === flow.a || index === flow.b) game.paths[color] = [index];
    else {
      const at = game.paths[color].indexOf(index);
      if (at < 0) return;
      game.paths[color] = game.paths[color].slice(0, at + 1);
    }
    gesture.armed = true;
    paintLive();
  }

  function extendPath(color, index) {
    const path = game.paths[color];
    const head = path[path.length - 1];
    if (index === head) return;
    const back = path.indexOf(index);
    if (back >= 0) {
      game.paths[color] = path.slice(0, back + 1);
      gesture.moved = true;
      paintLive();
      return;
    }
    if (!adjacent(game.size, head, index)) return;
    const flow = game.flows[color];
    if (path.includes(flow.a) && path.includes(flow.b)) return;
    const other = path[0] === flow.a ? flow.b : flow.a;
    if (index !== other) {
      if (game.flows.some((item) => item.color !== color && (item.a === index || item.b === index))) return;
      if (game.paths.some((item, idx) => idx !== color && item.includes(index))) return;
    }
    path.push(index);
    gesture.moved = true;
    paintLive();
  }

  function onPointerDown(event) {
    if (!game || game.phase !== "play" || gesture) return;
    if (event.button != null && event.button !== 0) return;
    const index = cellIndexFromTarget(event.target);
    if (index == null) return;
    const flow = game.flows.find((item) => item.a === index || item.b === index);
    const onPath = game.paths.findIndex((path) => path.includes(index));
    const color = flow ? flow.color : onPath;
    if (color < 0) return;
    event.preventDefault();
    const before = clonePaths(game.paths);
    const restart = !!(flow && game.paths[color].length >= 2);
    if (restart) {
      game.paths[color] = [index];
      paintLive();
    }
    gesture = {
      pointerId: event.pointerId,
      color,
      before,
      start: index,
      armed: restart,
      moved: false,
      restart
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  }

  function onPointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const index = cellFromPoint(event);
    if (index == null) return;
    if (!gesture.armed) {
      if (index === gesture.start) return;
      armGesture();
    }
    if (!gesture.armed) return;
    extendPath(gesture.color, index);
  }

  function finishGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const before = gesture.before;
    const armed = gesture.armed;
    const restart = gesture.restart;
    const color = gesture.color;
    gesture = null;
    if (!armed && !restart) return;
    if (game.paths[color].length < 2) game.paths[color] = [];
    if (!pathsEqual(game.paths, before)) {
      game.undo.push(before);
      if (game.undo.length > 80) game.undo.shift();
    }
    if (isWon(game)) onSolved();
    else {
      persistProgress();
      renderPlay();
    }
  }

  function paintLive() {
    const svg = root.querySelector(".pf-paths");
    if (svg) svg.innerHTML = pathLines(game.size, game.flows, game.paths);
    const pct = pipePercent(game);
    const label = root.querySelector("#pf-flow");
    const fill = root.querySelector(".pf-meter-fill");
    const meter = root.querySelector(".pf-meter");
    if (label) label.textContent = `${pct}%`;
    if (fill) fill.style.width = `${pct}%`;
    if (meter) meter.setAttribute("aria-label", `Pipe ${pct} percent`);
    const status = root.querySelector("#pf-status");
    if (status) status.textContent = statusText();
    const links = root.querySelector("#pf-links");
    if (links) links.textContent = `${linkedCount()}/${game.flows.length}`;
  }

  function bindBoard() {
    const grid = root.querySelector(".pf-grid");
    if (!grid || game?.phase !== "play") return;
    grid.addEventListener("pointerdown", onPointerDown);
    grid.addEventListener("pointermove", onPointerMove);
    grid.addEventListener("pointerup", finishGesture);
    grid.addEventListener("pointercancel", finishGesture);
  }

  function undoTurn() {
    if (!game || game.phase !== "play" || !game.undo.length) return;
    gesture = null;
    game.paths = clonePaths(game.undo.pop());
    tone(360, 0.04, "square", 0.03);
    if (isWon(game)) onSolved();
    else {
      persistProgress();
      renderPlay();
    }
  }

  function giveHint() {
    if (!game || game.phase !== "play" || isWon(game)) return;
    const pending = game.flows.filter((flow) => !connectedPath(game.size, flow, game.paths[flow.color]));
    const pool = pending.length ? pending : game.flows;
    const target = pool[(Math.random() * pool.length) | 0];
    const before = clonePaths(game.paths);
    game.paths[target.color] = target.solution.slice();
    game.flows.forEach((flow) => {
      if (flow.color === target.color) return;
      if (game.paths[flow.color].some((cell) => target.solution.includes(cell))) game.paths[flow.color] = [];
    });
    game.undo.push(before);
    if (game.undo.length > 80) game.undo.shift();
    game.hints += 1;
    tone(660, 0.07, "sine", 0.04);
    if (isWon(game)) onSolved();
    else {
      persistProgress();
      renderPlay();
      toast(`${COLORS[target.color].name} pipe laid.`);
    }
  }

  function joinNames(names) {
    if (names.length <= 1) return names[0] || "";
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  function statusText() {
    const through = [];
    const open = [];
    for (const flow of game.flows) {
      if (connectedPath(game.size, flow, game.paths[flow.color])) through.push(COLORS[flow.color].name);
      else open.push(COLORS[flow.color].name);
    }
    if (!open.length && !isWon(game)) return "Every color is linked. Fill the open squares.";
    if (!open.length) return "Every color is linked.";
    if (!through.length) return "Drag from one ring to the matching ring.";
    const verb = through.length === 1 ? "is" : "are";
    return `${joinNames(through)} ${verb} linked. ${joinNames(open)} still open.`;
  }

  function onSolved() {
    if (!game || game.phase !== "play") return;
    stampElapsed();
    game.phase = "won";
    stopTimer();
    const time = Math.round(game.elapsed);
    const score = scoreNow();
    stats.solvedCount += 1;
    if (game.source === "daily" && game.level) {
      const day = game.dailyDate || dateKey();
      markSolved(day, game.level);
      const banked = bankDailyLevel(day, game.level, time, game.hints, score);
      game.setRun = banked.run;
      if (banked.fresh) {
        const prevTime = stats.bestSetTime || 0;
        const prevScore = stats.bestSetScore || 0;
        game.setFinish = {
          betterTime: !prevTime || banked.run.time < prevTime,
          betterScore: !prevScore || banked.run.score > prevScore
        };
        if (game.setFinish.betterTime) stats.bestSetTime = banked.run.time;
        if (game.setFinish.betterScore) stats.bestSetScore = banked.run.score;
      }
    }
    if (game.source === "daily" && game.level === LEVEL_COUNT && (game.dailyDate || dateKey()) === dateKey()) {
      if (!(stats.lastDailyDate === dateKey() && stats.lastDailySolved)) {
        stats.currentStreak = stats.lastDailyDate === yesterdayKey() ? stats.currentStreak + 1 : 1;
        stats.lastDailyDate = dateKey();
        stats.lastDailySolved = true;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      }
    }
    saveStats();
    localStorage.removeItem(PROGRESS_KEY);
    const label = game.level ? `Level ${game.level}` : DIFF_LABEL[game.difficulty];
    ph()?.record({
      game: "pipeflow",
      title: game.source === "daily"
        ? `Daily ${label}${game.setFinish ? ` · set ${formatTime(game.setRun.time)}` : ""}${game.dailyDate ? ` · ${game.dailyDate}` : ""}`
        : label,
      difficulty: game.level ? `level ${game.level}` : game.difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      score,
      time,
      checks: 0,
      hints: game.hints,
      share: sharePayload()
    });
    tone(523, 0.1);
    setTimeout(() => tone(659, 0.1), 90);
    setTimeout(() => tone(784, 0.18), 180);
    renderPlay();
    const cells = root.querySelectorAll(".pf-ring");
    const show = () => showEnd(score, time);
    if (ph()?.celebrate) ph().celebrate(cells, show);
    else show();
  }

  function showEnd(score, time) {
    const app = root.querySelector(".pf-app");
    if (!app || !game) return;
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "pf-overlay";
    const daily = game.source === "daily" && game.level;
    const setDone = daily && game.level === LEVEL_COUNT && game.setRun?.done;
    const more = daily && game.level < LEVEL_COUNT;
    const note = daily
      ? `Level ${game.level} of ${LEVEL_COUNT} · ${describeRule(levelRule(game.level))}`
      : `${DIFF_LABEL[game.difficulty]} · ${ruleBlurb()}`;
    const nextLabel = more ? "Next" : (daily ? "Back to set" : "Next board");
    const finish = game.setFinish;
    const statsHtml = setDone ? `
          <div><b>${formatTime(game.setRun.time)}</b><span>Set time</span></div>
          <div><b>${formatTime(stats.bestSetTime || game.setRun.time)}</b><span>${finish?.betterTime ? "New best" : "Best time"}</span></div>
          <div><b>${game.setRun.score}/100</b><span>Set score</span></div>
          <div><b>${stats.bestSetScore || game.setRun.score}</b><span>${finish?.betterScore ? "New best" : "Best score"}</span></div>
    ` : `
          <div><b>${game.flows.length}</b><span>Colors</span></div>
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${score}/100</b><span>Score</span></div>
          <div><b>${game.hints}</b><span>Hints</span></div>
    `;
    const foot = setDone
      ? `The set score is the average of the twenty boards. This run used ${game.setRun.hints} hint${game.setRun.hints === 1 ? "" : "s"}.`
      : (daily && game.setRun
        ? `Set so far ${formatTime(game.setRun.elapsed)}. Laying a pipe is free. Each hint costs 10 on the score.`
        : "Laying a pipe is free. Each hint costs 10 on the score.");
    overlay.innerHTML = `
      <div class="pf-modal">
        <h2>${setDone ? "The set is through." : "The flow is through."}</h2>
        <p class="pf-end-note">${note}</p>
        <div class="pf-win-stats">
          ${statsHtml}
        </div>
        <p class="pf-end-note">${foot}</p>
        <div class="pf-modal-actions">
          <button class="pf-btn gold" id="pf-next">${nextLabel}</button>
          <button class="pf-btn" id="pf-share-win">Copy link</button>
          <button class="pf-btn ghost" id="pf-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#pf-next")?.addEventListener("click", () => {
      if (daily && game.level < LEVEL_COUNT) beginLevel(game.level + 1, game.dailyDate || mapDay);
      else if (daily) {
        mapDay = game.dailyDate || mapDay;
        quitToMenu();
      } else beginPuzzle(hashString(`pf-${Date.now()}-${Math.random()}`), "random");
    });
    overlay.querySelector("#pf-share-win")?.addEventListener("click", copyPuzzleLink);
    overlay.querySelector("#pf-menu-win")?.addEventListener("click", quitToMenu);
  }

  function quitToMenu() {
    overlay?.remove();
    overlay = null;
    gesture = null;
    if (game?.dailyDate) mapDay = game.dailyDate;
    if (game && game.phase === "play") persistProgress();
    game = null;
    view = "splash";
    render();
  }

  function renderPlay() {
    if (!game) return;
    const pct = pipePercent(game);
    const subtitle = game.level
      ? `Level ${game.level} of ${LEVEL_COUNT} · ${prettyDay(game.dailyDate || dateKey())} · ${describeRule(levelRule(game.level))}`
      : `${DIFF_LABEL[game.difficulty] || "Practice"} · ${ruleBlurb(game.difficulty)}`;
    const playing = game.phase === "play";
    const clockLabel = game.source === "daily" && game.level ? "Set" : "Time";
    root.innerHTML = `
      <div class="pf-app">
        ${headerHtml(subtitle)}
        <div class="pf-view">
          <div class="pf-play">
            <div class="pf-hud">
              <div class="pf-hud-item"><span class="lbl">Linked</span><span class="val" id="pf-links">${linkedCount()}/${game.flows.length}</span></div>
              <div class="pf-hud-item"><span class="lbl">${clockLabel}</span><span class="val" id="pf-time">${formatTime(shownSeconds())}</span></div>
              <div class="pf-toolbar">
                <button class="pf-btn" id="pf-hint" ${playing && !isWon(game) ? "" : "disabled"} title="Lay one color along a solution. Costs 10 on the score.">${ICONS.hint} Hint</button>
                <button class="pf-btn" id="pf-undo" ${playing && game.undo.length ? "" : "disabled"}>Undo</button>
                <button class="pf-btn ghost" id="pf-menu">Menu</button>
              </div>
            </div>
            <div class="pf-meter" aria-label="Pipe ${pct} percent">
              <span class="lbl">Pipe</span>
              <div class="pf-meter-track"><div class="pf-meter-fill" style="width:${pct}%"></div></div>
              <b id="pf-flow">${pct}%</b>
            </div>
            ${stageMarkup(game.size, game.flows, game.paths, playing)}
            <p class="pf-legend"><span>Drag from one ring to the ring of the same color.</span></p>
            <p class="pf-status" id="pf-status">${statusText()}</p>
          </div>
        </div>
        <div class="pf-toast"></div>
      </div>
    `;
    bindChrome();
    if (playing) startTimer();
    root.querySelector("#pf-hint")?.addEventListener("click", giveHint);
    root.querySelector("#pf-undo")?.addEventListener("click", undoTurn);
    root.querySelector("#pf-menu")?.addEventListener("click", quitToMenu);
    bindBoard();
  }

  function lessonBoardHtml(lesson) {
    return stageMarkup(lesson.size, lesson.flows, lesson.paths, false).replace('class="pf-board"', 'class="pf-board pf-lesson"');
  }

  function openExamples() {
    const app = root.querySelector(".pf-app");
    if (!app) return;
    root.querySelector(".pf-overlay:not(.ph-overlay)")?.remove();
    let step = 0;
    const wrap = document.createElement("div");
    wrap.className = "pf-overlay";

    function paint() {
      const lesson = LESSONS[step];
      const last = step === LESSONS.length - 1;
      wrap.innerHTML = `
        <div class="pf-modal" role="dialog" aria-labelledby="pf-lesson-title">
          <p class="pf-lesson-kicker">Solved example ${step + 1} of ${LESSONS.length}</p>
          <h2 id="pf-lesson-title">${lesson.title}</h2>
          ${lessonBoardHtml(lesson)}
          <p class="pf-lesson-copy">${lesson.body}</p>
          <div class="pf-modal-actions">
            <button class="pf-btn" id="pf-lesson-back" ${step === 0 ? "disabled" : ""}>Back</button>
            <button class="pf-btn gold" id="pf-lesson-next">${last ? "Done" : "Next"}</button>
          </div>
        </div>
      `;
      wrap.querySelector("#pf-lesson-back")?.addEventListener("click", () => {
        if (step > 0) {
          step -= 1;
          paint();
        }
      });
      wrap.querySelector("#pf-lesson-next")?.addEventListener("click", () => {
        if (last) wrap.remove();
        else {
          step += 1;
          paint();
        }
      });
    }

    paint();
    wrap.addEventListener("click", (event) => { if (event.target === wrap) wrap.remove(); });
    app.appendChild(wrap);
  }

  function showHelp() {
    const app = root.querySelector(".pf-app");
    if (!app) return;
    const wrap = document.createElement("div");
    wrap.className = "pf-overlay";
    wrap.innerHTML = `
      <div class="pf-modal">
        <h2>How to play</h2>
        <ol>
          <li>The board starts with a pair of rings for every color, and nothing else.</li>
          <li>Press one ring and drag through empty squares to the matching ring. That lays the pipe. Press a ring that already has a pipe to clear it and start again. Drag back along your own pipe to pull it up.</li>
          <li>A pipe can only cross empty squares. Two colors never share a square.</li>
          <li>The meter is how much of the grid the pipes cover. Finish when every pair is joined and every square has pipe.</li>
          <li>Each day is twenty boards. Clear one to open the next. Later boards use a larger grid and more colors.</li>
          <li>Undo takes back the last pipe you laid. A hint lays one color and costs 10 on the score. Laying pipes is free.</li>
          <li>The set clock runs across all twenty boards and pauses when you leave a puzzle. Clearing level 20 records that time and the average score against your best. The daily streak counts on that same clear.</li>
        </ol>
        <div class="pf-modal-actions">
          <button class="pf-btn gold" id="pf-help-examples">Solved examples</button>
          <button class="pf-btn" id="pf-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#pf-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.querySelector("#pf-help-examples")?.addEventListener("click", () => {
      wrap.remove();
      openExamples();
    });
    wrap.addEventListener("click", (event) => { if (event.target === wrap) wrap.remove(); });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const local = root.querySelector(".pf-overlay:not(.ph-overlay)");
      if (local) local.remove();
      return;
    }
    if (view !== "play" || !game || game.phase !== "play") return;
    if (root.querySelector(".pf-overlay")) return;
    if (event.target instanceof Element && event.target.closest("input, textarea")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoTurn();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      undoTurn();
    }
  });

  if (!tryShare()) render();
})();
