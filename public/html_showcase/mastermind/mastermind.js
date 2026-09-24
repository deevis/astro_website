(() => {
  const STATS_KEY = "mastermind-stats-v1";
  const MUTE_KEY = "mastermind-muted";
  const DIFF_KEY = "mastermind-difficulty";
  const PROGRESS_KEY = "mastermind-progress-v1";

  const DIFFS = ["easy", "medium", "hard", "nightmare"];
  const RULES = {
    easy: { pegs: 4, colors: 6, repeats: false, guesses: 10 },
    medium: { pegs: 4, colors: 6, repeats: true, guesses: 10 },
    hard: { pegs: 5, colors: 8, repeats: false, guesses: 12 },
    nightmare: { pegs: 5, colors: 8, repeats: true, guesses: 12 }
  };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", nightmare: "Nightmare" };
  const DIFF_BLURB = {
    easy: "4 pegs, 6 colors, no repeats.",
    medium: "Classic. Repeats allowed.",
    hard: "5 pegs, 8 colors, no repeats.",
    nightmare: "5 pegs, 8 colors, repeats."
  };
  const COLOR_NAMES = ["Red", "Orange", "Gold", "Green", "Blue", "Violet", "Teal", "Rose"];
  const SHAPES = [
    '<circle cx="12" cy="12" r="4.2" fill="currentColor"/>',
    '<path fill="currentColor" d="M12 6.2 17.4 16.8H6.6Z"/>',
    '<path fill="currentColor" d="M12 5.2 17.2 12 12 18.8 6.8 12Z"/>',
    '<rect fill="currentColor" x="7" y="7" width="10" height="10" rx="1.2"/>',
    '<circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="2.3"/>',
    '<path fill="currentColor" d="m12 4.8 1.7 5.1h5.3l-4.3 3.2 1.7 5.1L12 15.2 7.6 18.2l1.7-5.1L5 9.9h5.3Z"/>',
    '<path fill="currentColor" d="M10.1 5h3.8v5.1H19v3.8h-5.1V19h-3.8v-5.1H5V10.1h5.1Z"/>',
    '<path fill="none" stroke="currentColor" stroke-width="2" d="m12 5 4.4 2.5v5L12 15l-4.4-2.5v-5Z"/>'
  ];

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/><circle cx="16" cy="16" r="2.2"/></svg>',
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a6.5 6.5 0 1 1 0 13H11"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const root = document.getElementById("mm-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "easy";
  let activeSlot = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let toastTimer = null;
  let timerId = null;
  let audioCtx = null;
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

  function scoreGuess(secret, guess) {
    let exact = 0;
    const secretLeft = [];
    const guessLeft = [];
    for (let i = 0; i < secret.length; i++) {
      if (secret[i] === guess[i]) exact++;
      else {
        secretLeft.push(secret[i]);
        guessLeft.push(guess[i]);
      }
    }
    const counts = new Map();
    for (const color of secretLeft) counts.set(color, (counts.get(color) || 0) + 1);
    let color = 0;
    for (const peg of guessLeft) {
      const n = counts.get(peg) || 0;
      if (n) {
        color++;
        counts.set(peg, n - 1);
      }
    }
    return { exact, color };
  }

  function makeCode(rule, seed) {
    const rnd = mulberry32(seed >>> 0);
    const code = [];
    const bag = Array.from({ length: rule.colors }, (_, i) => i);
    for (let i = 0; i < rule.pegs; i++) {
      if (rule.repeats) code.push((rnd() * rule.colors) | 0);
      else code.push(bag.splice((rnd() * bag.length) | 0, 1)[0]);
    }
    return code;
  }

  function sameCode(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function countPossible(state) {
    const rule = rulesFor(state.difficulty);
    let left = 0;
    const cur = [];
    function walk(i) {
      if (i === rule.pegs) {
        for (const row of state.guesses) {
          const scored = scoreGuess(cur, row.pegs);
          if (scored.exact !== row.exact || scored.color !== row.color) return;
        }
        left++;
        return;
      }
      for (let color = 0; color < rule.colors; color++) {
        if (!rule.repeats && cur.includes(color)) continue;
        if (state.known[i] != null && state.known[i] !== color) continue;
        cur.push(color);
        walk(i + 1);
        cur.pop();
      }
    }
    walk(0);
    return left;
  }

  function pegSvg(color) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${SHAPES[color] || ""}</svg>`;
  }

  function pegHtml(color, exact) {
    if (color == null || color < 0) return "";
    return `<span class="mm-peg c${color}${exact ? " is-exact" : ""}">${pegSvg(color)}</span>`;
  }

  function keysHtml(exact, color, slots) {
    const bits = [];
    for (let i = 0; i < slots; i++) {
      const kind = i < exact ? " exact" : i < exact + color ? " color" : "";
      bits.push(`<i class="mm-key${kind}"></i>`);
    }
    return `<div class="mm-keys${slots > 4 ? " is-5" : ""}" aria-label="${exact} in the right place, ${color} right color elsewhere">${bits.join("")}</div>`;
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
    return ph()?.score100(currentElapsed(), game.guesses.length, game.hints) ?? 0;
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
    const el = root.querySelector(".mm-toast");
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
    return hashString(`mm-daily-${day}-${difficulty}`);
  }

  function ruleBlurb(diff = difficulty) {
    const rule = rulesFor(diff);
    return `${rule.pegs} pegs · ${rule.colors} colors${rule.repeats ? "" : " · no repeats"}`;
  }

  function sharePayload() {
    if (!game) return null;
    const payload = { g: "mastermind", s: game.seed, d: game.difficulty, src: game.source || "random" };
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
    if (payload.g && payload.g !== "mastermind") {
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
    if (api.handoff("mastermind")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "mastermind")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "mastermind",
      host: root.querySelector(".mm-app") || root,
      overlayClass: "mm-overlay",
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
      difficulty: game.difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      guesses: game.guesses,
      draft: game.draft,
      known: game.known,
      elapsed: game.elapsed,
      hints: game.hints
    }));
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      return Number.isFinite(saved?.seed) && DIFFS.includes(saved.difficulty) && Array.isArray(saved.guesses);
    } catch {
      return false;
    }
  }

  function headerHtml(subtitle) {
    return `
      <header class="mm-header">
        <div class="mm-brand">
          <div class="mm-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div>
            <h1>Mastermind</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="mm-header-actions">
          <button class="mm-icon-btn" id="mm-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          ${game ? `<button class="mm-icon-btn" id="mm-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="mm-icon-btn" id="mm-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#mm-help")?.addEventListener("click", showHelp);
    root.querySelector("#mm-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#mm-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#mm-mute");
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
      const el = root.querySelector("#mm-time");
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
    const rule = rulesFor(difficulty);
    root.innerHTML = `
      <div class="mm-app">
        ${headerHtml("Color logic")}
        <div class="mm-view">
          <div class="mm-splash">
            <div class="mm-hero">
              <h2>Break the code.</h2>
              <p>Guess the hidden pegs. The first hole is ready — click colors to fill the row. Click a hole only when you want to change that one. A red key means the right color in the right hole. A white key means the right color somewhere else. The keys are counts — they do not point at a hole.</p>
            </div>
            <div class="mm-stats-row">
              <div class="mm-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="mm-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="mm-stat"><b>${stats.bestScore || "—"}</b><span>Best /100</span></div>
              <div class="mm-stat"><b>${bestTime}</b><span>Best time</span></div>
            </div>
            <div class="mm-play-grid">
              ${hasProgress() ? `
              <button class="mm-play-card primary" data-mode="resume">
                <span class="mm-play-icon">${ICONS.play}</span>
                <span>
                  <strong>Continue code</strong>
                  <span>Pick up the guesses on this device. The timer stays with them.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
                <button class="mm-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                  <span class="mm-play-icon">${ICONS.daily}</span>
                  <span>
                    <strong>Daily code</strong>
                    <span>Today’s code is ${ruleBlurb()}.</span>
                    ${solvedToday ? "<em>Played today</em>" : ""}
                  </span>
                </button>
                <button type="button" class="ph-cal-launch" id="mm-calendar" title="Pick another date" aria-label="Pick another day's code">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="mm-play-card" data-mode="new">
                <span class="mm-play-icon">${ICONS.play}</span>
                <span>
                  <strong>New code</strong>
                  <span>${DIFF_LABEL[difficulty]} · ${rule.guesses} guesses.</span>
                </span>
              </button>
            </div>
            <div class="mm-diff">
              <div class="mm-diff-label">Code</div>
              <div class="mm-seg" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${DIFF_BLURB[d]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="mm-splash-links">
              <button class="mm-how" id="mm-examples">Solved examples</button>
              <button class="mm-how" id="mm-how">How to play</button>
              <button class="mm-how" id="mm-history">View history</button>
            </div>
          </div>
        </div>
        <div class="mm-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#mm-how")?.addEventListener("click", showHelp);
    root.querySelector("#mm-examples")?.addEventListener("click", openExamples);
    root.querySelector("#mm-history")?.addEventListener("click", openHistory);
    root.querySelector("#mm-calendar")?.addEventListener("click", openDailyCalendar);
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
          if (!resumeProgress()) toast("No saved code found.");
        } else if (mode === "daily") {
          beginDaily();
        } else {
          beginPuzzle(hashString(`mm-${Date.now()}-${Math.random()}`), "random", "");
        }
      });
    });
  }

  function beginDaily(day = dateKey()) {
    beginPuzzle(dailySeed(day), "daily", day);
  }

  function openDaily(day) {
    const rec = ph()?.findDaily?.("mastermind", day, difficulty);
    if (rec?.difficulty && DIFFS.includes(rec.difficulty)) setDifficulty(rec.difficulty);
    const seed = Number(rec?.share?.s);
    beginPuzzle(Number.isFinite(seed) ? seed : dailySeed(day), "daily", day);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "mastermind",
      host: root.querySelector(".mm-app") || root,
      overlayClass: "mm-overlay",
      title: "Daily Mastermind",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#mm-calendar")
    });
  }

  function beginPuzzle(seed, source, dailyDate) {
    const rule = rulesFor(difficulty);
    const code = makeCode(rule, seed);
    startGame({
      seed: seed >>> 0,
      difficulty,
      code,
      source: source || "random",
      dailyDate: source === "daily" ? (dailyDate || dateKey()) : ""
    }, null);
  }

  function emptySlots(n) {
    return Array.from({ length: n }, () => null);
  }

  function startGame(built, saved) {
    overlay?.remove();
    overlay = null;
    const rule = rulesFor(built.difficulty);
    const known = Array.isArray(saved?.known) && saved.known.length === rule.pegs ? saved.known.map((n) => (n == null ? null : Number(n))) : emptySlots(rule.pegs);
    const draft = Array.isArray(saved?.draft) && saved.draft.length === rule.pegs ? saved.draft.map((n) => (n == null ? null : Number(n))) : known.slice();
    game = {
      seed: built.seed,
      difficulty: built.difficulty,
      code: built.code,
      source: built.source,
      dailyDate: built.dailyDate || "",
      guesses: Array.isArray(saved?.guesses) ? saved.guesses : [],
      draft,
      known,
      hints: saved?.hints || 0,
      elapsed: saved?.elapsed || 0,
      phase: "play",
      left: 0,
      tick: Date.now()
    };
    focusPlay();
    game.left = countPossible(game);
    view = "play";
    persistProgress();
    renderPlay();
  }

  function resumeProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "");
      if (!saved) return false;
      setDifficulty(saved.difficulty);
      const rule = rulesFor(saved.difficulty);
      const code = makeCode(rule, saved.seed);
      startGame({
        seed: saved.seed >>> 0,
        difficulty: saved.difficulty,
        code,
        source: saved.source || "random",
        dailyDate: saved.dailyDate || ""
      }, saved);
      return true;
    } catch {
      return false;
    }
  }

  function draftFull() {
    return game.draft.every((color) => color != null);
  }

  function colorSpent(color) {
    const rule = rulesFor(game.difficulty);
    if (rule.repeats) return false;
    return game.draft.includes(color);
  }

  function firstOpenSlot() {
    for (let i = 0; i < game.draft.length; i++) {
      if (game.known[i] == null && game.draft[i] == null) return i;
    }
    return -1;
  }

  function nextUnlocked(from) {
    const n = game.draft.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + step) % n;
      if (game.known[i] == null) return i;
    }
    return 0;
  }

  function focusPlay(after) {
    const open = firstOpenSlot();
    if (open >= 0) {
      activeSlot = open;
      return;
    }
    activeSlot = after == null ? nextUnlocked(-1) : nextUnlocked(after);
  }

  function selectSlot(slot) {
    if (!game || game.phase !== "play") return;
    if (game.known[slot] != null) return;
    activeSlot = slot;
    rerenderPlay();
  }

  function placeInSlot(color) {
    if (!game || game.phase !== "play") return;
    if (activeSlot == null) focusPlay();
    const slot = activeSlot;
    if (game.known[slot] != null) return;
    if (colorSpent(color) && game.draft[slot] !== color) {
      toast("No repeats in this code.");
      return;
    }
    if (game.draft[slot] === color) return;
    game.draft[slot] = color;
    focusPlay(slot);
    tone(520 + color * 40, 0.05, "triangle", 0.04);
    persistProgress();
    rerenderPlay();
  }

  function clearLast() {
    if (!game || game.phase !== "play") return;
    for (let i = game.draft.length - 1; i >= 0; i--) {
      if (game.known[i] == null && game.draft[i] != null) {
        game.draft[i] = null;
        activeSlot = i;
        persistProgress();
        rerenderPlay();
        return;
      }
    }
  }

  function submitGuess() {
    if (!game || game.phase !== "play" || !draftFull()) return;
    const pegs = game.draft.slice();
    if (game.guesses.some((row) => sameCode(row.pegs, pegs))) {
      toast("You already tried that code.");
      return;
    }
    const scored = scoreGuess(game.code, pegs);
    game.guesses.push({ pegs, exact: scored.exact, color: scored.color });
    game.draft = game.known.slice();
    focusPlay();
    game.left = countPossible(game);
    tone(440 + scored.exact * 70, 0.08, "sine", 0.05);
    if (scored.exact === game.code.length) onSolved();
    else if (game.guesses.length >= rulesFor(game.difficulty).guesses) onLost();
    else {
      persistProgress();
      rerenderPlay();
    }
  }

  function clearDraft() {
    if (!game || game.phase !== "play") return;
    let cleared = false;
    for (let i = 0; i < game.draft.length; i++) {
      if (game.known[i] == null && game.draft[i] != null) {
        game.draft[i] = null;
        cleared = true;
      }
    }
    if (!cleared) return;
    focusPlay();
    persistProgress();
    rerenderPlay();
  }

  function giveHint() {
    if (!game || game.phase !== "play") return;
    const open = [];
    for (let i = 0; i < game.known.length; i++) if (game.known[i] == null) open.push(i);
    if (!open.length) {
      toast("Every peg is already revealed.");
      return;
    }
    const slot = open[(Math.random() * open.length) | 0];
    const color = game.code[slot];
    game.known[slot] = color;
    game.draft[slot] = color;
    if (!rulesFor(game.difficulty).repeats) {
      for (let i = 0; i < game.draft.length; i++) {
        if (i !== slot && game.known[i] == null && game.draft[i] === color) game.draft[i] = null;
      }
    }
    game.hints += 1;
    focusPlay();
    game.left = countPossible(game);
    tone(660, 0.07, "sine", 0.04);
    persistProgress();
    rerenderPlay();
    toast(`Hole ${slot + 1} is ${COLOR_NAMES[color]}.`);
  }

  function onSolved() {
    if (!game || game.phase !== "play") return;
    stampElapsed();
    game.phase = "won";
    stopTimer();
    const time = Math.round(game.elapsed);
    const score = scoreNow();
    const guesses = game.guesses.length;
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
    const label = DIFF_LABEL[game.difficulty];
    ph()?.record({
      game: "mastermind",
      title: game.source === "daily"
        ? `Daily ${label}${game.dailyDate ? ` · ${game.dailyDate}` : ""} · ${guesses} guess${guesses === 1 ? "" : "es"}`
        : `${label} · ${guesses} guess${guesses === 1 ? "" : "es"}`,
      difficulty: game.difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      score,
      time,
      checks: guesses,
      hints: game.hints,
      share: sharePayload()
    });
    tone(523, 0.1);
    setTimeout(() => tone(659, 0.1), 90);
    setTimeout(() => tone(784, 0.18), 180);
    renderPlay();
    const cells = root.querySelectorAll(".mm-guess .mm-peg, .mm-secret .mm-peg");
    const show = () => showEnd(true, score, time);
    if (ph()?.celebrate) ph().celebrate(cells, show);
    else show();
  }

  function onLost() {
    if (!game || game.phase !== "play") return;
    stampElapsed();
    game.phase = "lost";
    stopTimer();
    localStorage.removeItem(PROGRESS_KEY);
    tone(196, 0.22, "triangle", 0.05);
    renderPlay();
    showEnd(false, 0, Math.round(game.elapsed));
  }

  function showEnd(won, score, time) {
    const app = root.querySelector(".mm-app");
    if (!app || !game) return;
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "mm-overlay";
    const guesses = game.guesses.length;
    const revealed = `<div class="mm-holes" style="justify-content:center;margin:14px 0">${game.code.map((color) => `<span class="mm-hole">${pegHtml(color, false)}</span>`).join("")}</div>`;
    overlay.innerHTML = won ? `
      <div class="mm-modal">
        <h2>Code broken.</h2>
        <p class="mm-end-note">${DIFF_LABEL[game.difficulty]} · ${guesses} guess${guesses === 1 ? "" : "es"}</p>
        ${revealed}
        <div class="mm-win-stats">
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${score}/100</b><span>Score</span></div>
          <div><b>${guesses}</b><span>Guesses</span></div>
          <div><b>${game.hints}</b><span>Hints</span></div>
        </div>
        <p class="mm-end-note">The first guess is free. Every guess after that costs 10 on the score.</p>
        <div class="mm-modal-actions">
          <button class="mm-btn gold" id="mm-next">Next code</button>
          <button class="mm-btn" id="mm-share-win">Copy link</button>
          <button class="mm-btn ghost" id="mm-menu-win">Menu</button>
        </div>
      </div>
    ` : `
      <div class="mm-modal">
        <h2>The code stands.</h2>
        ${revealed}
        <p class="mm-end-note">${guesses} guesses used. This was the hidden code.</p>
        <div class="mm-modal-actions">
          <button class="mm-btn gold" id="mm-next">Next code</button>
          <button class="mm-btn ghost" id="mm-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#mm-next")?.addEventListener("click", () => {
      beginPuzzle(hashString(`mm-${Date.now()}-${Math.random()}`), "random", "");
    });
    overlay.querySelector("#mm-share-win")?.addEventListener("click", copyPuzzleLink);
    overlay.querySelector("#mm-menu-win")?.addEventListener("click", quitToMenu);
  }

  function quitToMenu() {
    overlay?.remove();
    overlay = null;
    if (game && game.phase === "play") persistProgress();
    game = null;
    view = "splash";
    render();
  }

  function secretHtml() {
    const open = game.phase !== "play";
    const holes = game.code.map((color) => `<span class="mm-hole">${pegHtml(color, false)}</span>`).join("");
    return `
      <div class="mm-secret">
        <span class="mm-secret-label">Code</span>
        <div class="mm-codebox${open ? " is-open" : ""}">
          <div class="mm-holes" ${open ? 'aria-label="Hidden code revealed"' : 'aria-hidden="true"'}>${holes}</div>
          <div class="mm-cover" aria-hidden="${open ? "true" : "false"}"${open ? "" : ' role="img" aria-label="Code covered"'}>
            <span>Covered</span>
          </div>
        </div>
        <span class="mm-keyspace" aria-hidden="true"></span>
      </div>
    `;
  }

  function guessRowHtml(row, index) {
    const holes = row.pegs.map((color, i) => {
      const exact = color === game.code[i];
      return `<span class="mm-hole">${pegHtml(color, game.phase !== "play" && exact)}</span>`;
    }).join("");
    return `
      <div class="mm-row mm-guess">
        <span class="mm-row-n">${index + 1}</span>
        <div class="mm-holes">${holes}</div>
        ${keysHtml(row.exact, row.color, row.pegs.length)}
      </div>
    `;
  }

  function emptyRowHtml(number) {
    const holes = game.code.map(() => `<span class="mm-hole"></span>`).join("");
    return `
      <div class="mm-row mm-empty" aria-hidden="true">
        <span class="mm-row-n">${number}</span>
        <div class="mm-holes">${holes}</div>
        ${keysHtml(0, 0, game.code.length)}
      </div>
    `;
  }

  function boardRowsHtml() {
    const total = rulesFor(game.difficulty).guesses;
    const rows = [];
    for (let number = total; number >= 1; number--) {
      const index = number - 1;
      if (index < game.guesses.length) rows.push(guessRowHtml(game.guesses[index], index));
      else if (game.phase === "play" && index === game.guesses.length) rows.push(draftHtml());
      else rows.push(emptyRowHtml(number));
    }
    return rows.join("");
  }

  function draftHtml() {
    const holes = game.draft.map((color, i) => {
      const locked = game.known[i] != null;
      const on = !locked && activeSlot === i;
      return `<button type="button" class="mm-hole current${locked ? " locked" : ""}${on ? " is-on" : ""}" data-slot="${i}" aria-pressed="${on ? "true" : "false"}" aria-label="Hole ${i + 1}${color == null ? ", empty" : `, ${COLOR_NAMES[color]}`}${locked ? ", revealed" : ""}${on ? ", selected" : ""}">${pegHtml(color, false)}</button>`;
    }).join("");
    return `
      <div class="mm-row mm-draft">
        <span class="mm-row-n">${game.guesses.length + 1}</span>
        <div class="mm-holes">${holes}</div>
        ${keysHtml(0, 0, game.draft.length)}
      </div>
    `;
  }

  function paletteHtml() {
    if (game.phase !== "play") return "";
    const rule = rulesFor(game.difficulty);
    const buttons = [];
    for (let color = 0; color < rule.colors; color++) {
      const spent = colorSpent(color);
      buttons.push(`<button type="button" class="mm-swatch${spent ? " spent" : ""}" data-color="${color}" aria-label="${COLOR_NAMES[color]}${spent ? ", already used" : ""}">${pegHtml(color, false)}</button>`);
    }
    return `<div class="mm-palette" role="group" aria-label="Colors">${buttons.join("")}</div>`;
  }

  function canClearDraft() {
    return game.phase === "play" && game.draft.some((color, i) => game.known[i] == null && color != null);
  }

  function pegBarHtml() {
    if (game.phase !== "play") return "";
    const canGuess = draftFull();
    return `
      <div class="mm-peg-bar">
        <button class="mm-btn" id="mm-clear" ${canClearDraft() ? "" : "disabled"}>Clear</button>
        ${paletteHtml()}
        <button class="mm-btn gold" id="mm-guess" ${canGuess ? "" : "disabled"}>Guess</button>
      </div>
    `;
  }

  function statusText() {
    if (game.phase === "won") return "Every peg is in the right hole.";
    if (game.phase === "lost") return "The hidden code is in the top row.";
    const rule = rulesFor(game.difficulty);
    const left = game.left.toLocaleString("en-US");
    const noun = game.left === 1 ? "code still fits" : "codes still fit";
    return `${left} ${noun} these keys. ${rule.repeats ? "Colors may repeat." : "No color repeats."}`;
  }

  function rerenderPlay() {
    const scroll = root.querySelector(".mm-view")?.scrollTop || 0;
    renderPlay();
    const box = root.querySelector(".mm-view");
    if (box) box.scrollTop = scroll;
  }

  function renderPlay() {
    if (!game) return;
    const rule = rulesFor(game.difficulty);
    const subtitle = game.source === "daily"
      ? `Daily · ${prettyDay(game.dailyDate || dateKey())} · ${ruleBlurb(game.difficulty)}`
      : `${DIFF_LABEL[game.difficulty]} · ${ruleBlurb(game.difficulty)}`;
    root.innerHTML = `
      <div class="mm-app">
        ${headerHtml(subtitle)}
        <div class="mm-view">
          <div class="mm-play">
            <div class="mm-hud">
              <div class="mm-hud-item"><span class="lbl">Guesses</span><span class="val" id="mm-guesses">${game.guesses.length}/${rule.guesses}</span></div>
              <div class="mm-hud-item"><span class="lbl">Still possible</span><span class="val" id="mm-left">${game.left.toLocaleString("en-US")}</span></div>
              <div class="mm-hud-item"><span class="lbl">Time</span><span class="val" id="mm-time">${formatTime(currentElapsed())}</span></div>
              <div class="mm-toolbar">
                <button class="mm-btn" id="mm-hint" ${game.phase === "play" ? "" : "disabled"}>${ICONS.hint} Hint</button>
                <button class="mm-btn ghost" id="mm-menu">Menu</button>
              </div>
            </div>
            <div class="mm-board" id="mm-board">
              <div class="mm-sheet" style="--mm-keys:${rule.pegs > 4 ? "46px" : "34px"}">
                ${secretHtml()}
                <div class="mm-rows">
                  ${boardRowsHtml()}
                </div>
              </div>
              <div class="mm-legend">
                <span><i class="mm-key exact"></i> Right place</span>
                <span><i class="mm-key color"></i> Right color, wrong place</span>
              </div>
            </div>
            ${pegBarHtml()}
            <p class="mm-status" id="mm-status">${statusText()}</p>
          </div>
        </div>
        <div class="mm-toast"></div>
      </div>
    `;
    bindChrome();
    if (game.phase === "play") startTimer();
    root.querySelector("#mm-clear")?.addEventListener("click", clearDraft);
    root.querySelector("#mm-hint")?.addEventListener("click", giveHint);
    root.querySelector("#mm-guess")?.addEventListener("click", submitGuess);
    root.querySelector("#mm-menu")?.addEventListener("click", quitToMenu);
    root.querySelectorAll("[data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => selectSlot(Number(btn.getAttribute("data-slot"))));
    });
    root.querySelectorAll("[data-color]").forEach((btn) => {
      btn.addEventListener("click", () => placeInSlot(Number(btn.getAttribute("data-color"))));
    });
    root.querySelector(".mm-draft")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const LESSONS = [
    {
      title: "Red means the right hole",
      secret: [0, 1, 2, 3],
      guess: [0, 1, 2, 3],
      body: "Every peg matches the code, so the keys are four solid red pegs and no white ones. A red key means right color, right place. This is the only time the keys line up with a finished code."
    },
    {
      title: "White is not a place",
      secret: [0, 1, 2, 3],
      guess: [1, 2, 3, 0],
      body: "All four colors are in the code, and none is in the right hole, so you get four solid white keys and no red. A white key counts a color that belongs somewhere else. It does not tell you which hole."
    },
    {
      title: "Only the match is marked",
      secret: [0, 1, 2, 3],
      guess: [0, 2, 1, 5],
      body: "Red is in the right hole, so it earns the one red key. Orange and Gold are in the code, swapped, so they earn two white keys between them. Violet is not in the code. The keys do not label that hole — you work it out from what the counts leave over."
    },
    {
      title: "Repeats only score once each",
      secret: [0, 0, 1, 2],
      guess: [0, 1, 0, 4],
      body: "The code has two reds. The first red is already exact, so it takes one of them. The later red matches the red that is left and earns one white key, not a second red key. Orange matches the leftover orange and earns the second white key. Blue is not in the code."
    }
  ];

  function lessonBoardHtml(lesson) {
    const scored = scoreGuess(lesson.secret, lesson.guess);
    const code = lesson.secret.map((color) => `<span class="mm-hole">${pegHtml(color, false)}</span>`).join("");
    const guess = lesson.guess.map((color, i) => {
      const exact = color === lesson.secret[i];
      return `<span class="mm-hole">${pegHtml(color, exact)}</span>`;
    }).join("");
    return `
      <div class="mm-lesson-line"><span class="mm-secret-label">Code</span><div class="mm-holes">${code}</div></div>
      <div class="mm-lesson-line">
        <span class="mm-secret-label">Guess</span>
        <div class="mm-holes">${guess}</div>
        ${keysHtml(scored.exact, scored.color, lesson.guess.length)}
      </div>
    `;
  }

  function openExamples() {
    const app = root.querySelector(".mm-app");
    if (!app) return;
    root.querySelector(".mm-overlay:not(.ph-overlay)")?.remove();
    let step = 0;
    const wrap = document.createElement("div");
    wrap.className = "mm-overlay";

    function paint() {
      const lesson = LESSONS[step];
      const last = step === LESSONS.length - 1;
      wrap.innerHTML = `
        <div class="mm-modal" role="dialog" aria-labelledby="mm-lesson-title">
          <p class="mm-lesson-kicker">Solved example ${step + 1} of ${LESSONS.length}</p>
          <h2 id="mm-lesson-title">${lesson.title}</h2>
          <div class="mm-lesson-board">${lessonBoardHtml(lesson)}</div>
          <p class="mm-legend" style="margin-top:0">
            <span><i class="mm-key exact"></i> Right place</span>
            <span><i class="mm-key color"></i> Right color, wrong place</span>
          </p>
          <p class="mm-lesson-copy">${lesson.body}</p>
          <div class="mm-modal-actions">
            <button class="mm-btn" id="mm-lesson-back" ${step === 0 ? "disabled" : ""}>Back</button>
            <button class="mm-btn gold" id="mm-lesson-next">${last ? "Done" : "Next"}</button>
          </div>
        </div>
      `;
      wrap.querySelector("#mm-lesson-back")?.addEventListener("click", () => {
        if (step > 0) {
          step -= 1;
          paint();
        }
      });
      wrap.querySelector("#mm-lesson-next")?.addEventListener("click", () => {
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
    const app = root.querySelector(".mm-app");
    if (!app) return;
    const wrap = document.createElement("div");
    wrap.className = "mm-overlay";
    wrap.innerHTML = `
      <div class="mm-modal">
        <h2>How to play</h2>
        <ol>
          <li>Click colors to fill the highlighted hole. The highlight moves to the next open hole. Click a hole only when you want to set that one peg.</li>
          <li>A red key means one peg is the right color in the right hole. A white key means one peg is the right color in the wrong hole.</li>
          <li>The keys are only counts. They are not lined up under the peg they describe.</li>
          <li>A repeated color scores only as many times as it appears in the code.</li>
          <li>The number on the board is how many codes still agree with every key so far. A hint locks one hole to its true color.</li>
        </ol>
        <div class="mm-modal-actions">
          <button class="mm-btn gold" id="mm-help-examples">Solved examples</button>
          <button class="mm-btn" id="mm-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#mm-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.querySelector("#mm-help-examples")?.addEventListener("click", () => {
      wrap.remove();
      openExamples();
    });
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const local = root.querySelector(".mm-overlay:not(.ph-overlay)");
      if (local) local.remove();
      return;
    }
    if (view !== "play" || !game || game.phase !== "play") return;
    if (root.querySelector(".mm-overlay")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      clearLast();
      return;
    }
    if (e.key === "Enter") {
      if (e.target instanceof Element && e.target.closest("button")) return;
      e.preventDefault();
      submitGuess();
      return;
    }
    if (/^[1-8]$/.test(e.key)) {
      const color = Number(e.key) - 1;
      if (color < rulesFor(game.difficulty).colors) {
        e.preventDefault();
        placeInSlot(color);
      }
    }
  });

  if (!tryShare()) render();
})();
