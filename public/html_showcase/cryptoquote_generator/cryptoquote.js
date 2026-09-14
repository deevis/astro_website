(() => {
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const FREQ_ORDER = "ETAOINSHRDLCUMWFGYPBVKJXQZ";
  const STATS_KEY = "cryptoquote-stats-v1";
  const MUTE_KEY = "cryptoquote-muted";
  const DIFF_KEY = "cryptoquote-difficulty";
  const PROGRESS_KEY = "cryptoquote-progress-v1";

  const QUOTES = [
    { id: "franklin-knowledge", text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", tag: "Wisdom" },
    { id: "franklin-done", text: "Well done is better than well said.", author: "Benjamin Franklin", tag: "Wisdom" },
    { id: "franklin-secret", text: "Three can keep a secret if two of them are dead.", author: "Benjamin Franklin", tag: "Humor" },
    { id: "franklin-time", text: "Lost time is never found again.", author: "Benjamin Franklin", tag: "Wisdom" },
    { id: "franklin-early", text: "Early to bed and early to rise makes a man healthy, wealthy, and wise.", author: "Benjamin Franklin", tag: "Wisdom" },
    { id: "shakespeare-be", text: "To be, or not to be, that is the question.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-self", text: "This above all: to thine own self be true.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-glitters", text: "All that glisters is not gold.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-wit", text: "Brevity is the soul of wit.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-name", text: "What's in a name? That which we call a rose by any other name would smell as sweet.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-cowards", text: "Cowards die many times before their deaths; the valiant never taste of death but once.", author: "William Shakespeare", tag: "Literature" },
    { id: "shakespeare-valor", text: "The better part of valor is discretion.", author: "William Shakespeare", tag: "Literature" },
    { id: "bacon-knowledge", text: "Knowledge itself is power.", author: "Francis Bacon", tag: "Wisdom" },
    { id: "descartes-think", text: "I think, therefore I am.", author: "Rene Descartes", tag: "Wisdom" },
    { id: "socrates-life", text: "The unexamined life is not worth living.", author: "Socrates", tag: "Wisdom" },
    { id: "virgil-fortune", text: "Fortune favors the bold.", author: "Virgil", tag: "History" },
    { id: "caesar-came", text: "I came, I saw, I conquered.", author: "Julius Caesar", tag: "History" },
    { id: "caesar-die", text: "The die is cast.", author: "Julius Caesar", tag: "History" },
    { id: "nietzsche-stronger", text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche", tag: "Wisdom" },
    { id: "twain-truth", text: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain", tag: "Humor" },
    { id: "twain-started", text: "The secret of getting ahead is getting started.", author: "Mark Twain", tag: "Wisdom" },
    { id: "twain-classic", text: "A classic is something that everybody wants to have read and nobody wants to read.", author: "Mark Twain", tag: "Humor" },
    { id: "confucius-heart", text: "Wherever you go, go with all your heart.", author: "Confucius", tag: "Wisdom" },
    { id: "eliot-late", text: "It is never too late to be what you might have been.", author: "George Eliot", tag: "Wisdom" },
    { id: "donne-island", text: "No man is an island, entire of itself.", author: "John Donne", tag: "Literature" },
    { id: "laotzu-journey", text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu", tag: "Wisdom" },
    { id: "henry-liberty", text: "Give me liberty, or give me death!", author: "Patrick Henry", tag: "History" },
    { id: "dickens-times", text: "It was the best of times, it was the worst of times.", author: "Charles Dickens", tag: "Literature" },
    { id: "emerson-friend", text: "The only way to have a friend is to be one.", author: "Ralph Waldo Emerson", tag: "Wisdom" },
    { id: "emerson-hitch", text: "Hitch your wagon to a star.", author: "Ralph Waldo Emerson", tag: "Wisdom" },
    { id: "thoreau-simplify", text: "Simplify, simplify.", author: "Henry David Thoreau", tag: "Wisdom" },
    { id: "thoreau-beat", text: "If a man does not keep pace with his companions, perhaps it is because he hears a different drummer.", author: "Henry David Thoreau", tag: "Wisdom" },
    { id: "austen-truth", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", author: "Jane Austen", tag: "Literature" },
    { id: "lincoln-fool", text: "You can fool all the people some of the time, and some of the people all the time, but you cannot fool all the people all the time.", author: "Abraham Lincoln", tag: "History" },
    { id: "lincoln-charity", text: "With malice toward none, with charity for all.", author: "Abraham Lincoln", tag: "History" },
    { id: "roosevelt-do", text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt", tag: "History" },
    { id: "roosevelt-stick", text: "Speak softly and carry a big stick; you will go far.", author: "Theodore Roosevelt", tag: "History" },
    { id: "paine-times", text: "These are the times that try men's souls.", author: "Thomas Paine", tag: "History" },
    { id: "jefferson-liberty", text: "The tree of liberty must be refreshed from time to time with the blood of patriots and tyrants.", author: "Thomas Jefferson", tag: "History" },
    { id: "sun-tzu-war", text: "The supreme art of war is to subdue the enemy without fighting.", author: "Sun Tzu", tag: "History" },
    { id: "heraclitus-change", text: "There is nothing permanent except change.", author: "Heraclitus", tag: "Wisdom" },
    { id: "pascal-heart", text: "The heart has its reasons which reason knows nothing of.", author: "Blaise Pascal", tag: "Wisdom" },
    { id: "voltaire-liberty", text: "I disapprove of what you say, but I will defend to the death your right to say it.", author: "Voltaire", tag: "Wisdom" },
    { id: "wilde-temptation", text: "I can resist everything except temptation.", author: "Oscar Wilde", tag: "Humor" },
    { id: "wilde-sincerest", text: "Imitation is the sincerest form of flattery.", author: "Oscar Wilde", tag: "Humor" },
    { id: "carroll-curiouser", text: "Curiouser and curiouser!", author: "Lewis Carroll", tag: "Literature" },
    { id: "melville-call", text: "Call me Ishmael.", author: "Herman Melville", tag: "Literature" },
    { id: "douglass-power", text: "If there is no struggle, there is no progress.", author: "Frederick Douglass", tag: "History" },
    { id: "austen-picture", text: "There is nothing like staying at home for real comfort.", author: "Jane Austen", tag: "Literature" },
    { id: "franklin-guest", text: "Guests, like fish, begin to smell after three days.", author: "Benjamin Franklin", tag: "Humor" }
  ];

  const GIVEN_COUNTS = { easy: 2, medium: 1, hard: 0 };

  const ICONS = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    random: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6l2 3h8v13H4z"/><path d="m9 14 2 2 4-5"/></svg>',
    create: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const root = document.getElementById("cq-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = localStorage.getItem(DIFF_KEY) || "medium";
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let timerId = null;
  let toastTimer = null;
  let audioCtx = null;
  let stats = loadStats();

  function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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

  function derangement(letters, rnd) {
    const alpha = letters.split("");
    for (let attempt = 0; attempt < 80; attempt++) {
      const shuffled = fisherYates(alpha, rnd);
      if (shuffled.every((ch, i) => ch !== alpha[i])) return shuffled;
    }
    const shuffled = fisherYates(alpha, rnd);
    for (let i = 0; i < alpha.length; i++) {
      if (shuffled[i] === alpha[i]) {
        const j = (i + 1) % alpha.length;
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    if (shuffled.some((ch, i) => ch === alpha[i])) {
      shuffled.push(shuffled.shift());
    }
    return shuffled;
  }

  function buildCipher(seed) {
    const rnd = mulberry32(seed >>> 0);
    const shuffled = derangement(ALPHA, rnd);
    /** @type {Record<string,string>} */
    const encode = {};
    /** @type {Record<string,string>} */
    const decode = {};
    for (let i = 0; i < ALPHA.length; i++) {
      encode[ALPHA[i]] = shuffled[i];
      decode[shuffled[i]] = ALPHA[i];
    }
    return { encode, decode, seed };
  }

  function encodeText(text, encode) {
    return text.replace(/[A-Za-z]/g, (ch) => {
      const up = ch.toUpperCase();
      return encode[up] || ch;
    });
  }

  function tokenize(text) {
    const words = [];
    let current = [];
    const pushWord = () => {
      if (current.length) {
        words.push(current);
        current = [];
      }
    };
    for (const ch of text) {
      if (ch === " " || ch === "\n") {
        pushWord();
      } else {
        current.push(ch);
      }
    }
    pushWord();
    return words;
  }

  function uniqueLetters(text) {
    return [...new Set(text.toUpperCase().replace(/[^A-Z]/g, "").split(""))];
  }

  function letterCounts(text) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const ch of text.toUpperCase()) {
      if (ch >= "A" && ch <= "Z") counts[ch] = (counts[ch] || 0) + 1;
    }
    return counts;
  }

  function pickGiven(ciphertext, n) {
    if (n <= 0) return [];
    const counts = letterCounts(ciphertext);
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || FREQ_ORDER.indexOf(a) - FREQ_ORDER.indexOf(b))
      .slice(0, n);
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
    const payload = {
      g: "cryptoquote",
      t: game.quote.text,
      a: game.quote.author,
      s: game.seed,
      d: difficulty,
      src: game.source || "random"
    };
    if (game.source === "daily" && game.dailyDate) payload.day = game.dailyDate;
    return payload;
  }

  function copyShare(payload) {
    const api = ph();
    const full = { g: "cryptoquote", ...payload };
    if (!api) {
      toast("Share is unavailable.");
      return;
    }
    const url = api.urlFor(full);
    api.copy(url).then(
      () => toast("Share link copied"),
      () => toast(url)
    );
  }

  function copyPuzzleLink() {
    const payload = sharePayload();
    if (!payload) {
      toast("Nothing to share yet.");
      return;
    }
    copyShare(payload);
  }

  function applyShare(payload) {
    if (!payload) return false;
    const api = ph();
    if (payload.g && payload.g !== "cryptoquote") {
      if (api) location.href = api.urlFor(payload);
      return true;
    }
    if (!payload.t) return false;
    if (payload.d) difficulty = payload.d;
    beginPuzzle(
      { id: "shared", text: payload.t, author: payload.a || "Unknown", tag: "Shared" },
      Number(payload.s) || 1,
      payload.src === "daily" ? "daily" : (payload.src || "custom"),
      payload.day
    );
    return true;
  }

  function tryShare() {
    const api = ph();
    if (!api) return false;
    if (api.handoff("cryptoquote")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "cryptoquote")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "cryptoquote",
      host: root.querySelector(".cq-app") || root,
      overlayClass: "cq-overlay",
      onReplay: applyShare,
      toast
    });
  }

  function quoteTitle(text) {
    const t = String(text || "").trim();
    return t.length > 52 ? `${t.slice(0, 51)}…` : t;
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
    const el = root.querySelector(".cq-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function headerHtml(subtitle) {
    return `
      <header class="cq-header">
        <div class="cq-brand">
          <div class="cq-mark" aria-hidden="true">CQ</div>
          <div class="cq-brand-text">
            <h1>Cryptoquote</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="cq-header-actions">
          <button class="cq-icon-btn" id="cq-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          ${game ? `<button class="cq-icon-btn" id="cq-share-head" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="cq-icon-btn" id="cq-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#cq-help")?.addEventListener("click", showHelp);
    root.querySelector("#cq-share-head")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#cq-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#cq-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return !!(p?.quote?.text && !p.solved);
    } catch {
      return false;
    }
  }

  function dailyQuoteIndex(day = dateKey()) {
    return hashString(`cq-daily-${day}`) % QUOTES.length;
  }

  function dailySeed(day = dateKey()) {
    return hashString(`cq-seed-${day}-${difficulty}`);
  }

  function beginDaily(day = dateKey()) {
    beginPuzzle(QUOTES[dailyQuoteIndex(day)], dailySeed(day), "daily", day);
  }

  function openDaily(day) {
    const rec = ph()?.findDaily?.("cryptoquote", day, difficulty);
    if (rec?.difficulty && GIVEN_COUNTS[rec.difficulty] != null) {
      difficulty = rec.difficulty;
      localStorage.setItem(DIFF_KEY, difficulty);
    }
    const seed = Number(rec?.share?.s);
    const quote = rec?.share?.t
      ? { id: "daily", text: rec.share.t, author: rec.share.a || "Unknown", tag: "Daily" }
      : QUOTES[dailyQuoteIndex(day)];
    beginPuzzle(quote, Number.isFinite(seed) ? seed : dailySeed(day), "daily", day, rec || null);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "cryptoquote",
      host: root.querySelector(".cq-app") || root,
      overlayClass: "cq-overlay",
      title: "Daily Cryptoquote",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#cq-calendar")
    });
  }

  function todaySolved() {
    return stats.lastDailyDate === dateKey() && stats.lastDailySolved;
  }

  function render() {
    stopTimer();
    if (view === "splash") renderSplash();
    else if (view === "create") renderCreate();
    else renderPlay();
  }

  function renderSplash() {
    ph()?.clearHash();
    const solvedToday = todaySolved();
    root.innerHTML = `
      <div class="cq-app">
        ${headerHtml("Substitution-cipher puzzle")}
        <div class="cq-view">
          <div class="cq-splash">
            <div class="cq-hero">
              <h2>Decode the quote.</h2>
              <p>Every letter stands for another. Punctuation stays put, and no letter ever encodes as itself. Crack the mapping, reveal the line, and claim the author.</p>
            </div>
            <div class="cq-stats-row">
              <div class="cq-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="cq-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="cq-stat"><b>${stats.bestScore || "—"}</b><span>Best /100</span></div>
              <div class="cq-stat"><b>${stats.bestTime ? formatTime(stats.bestTime) : "—"}</b><span>Best time</span></div>
            </div>
            <div class="cq-play-grid">
              ${hasProgress() ? `
              <button class="cq-play-card primary" data-mode="resume">
                <span class="cq-play-icon">${ICONS.random}</span>
                <span>
                  <strong>Continue puzzle</strong>
                  <span>Pick up the quote you were decoding. Guesses and timer are saved on this device.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
              <button class="cq-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                <span class="cq-play-icon">${ICONS.daily}</span>
                <span>
                  <strong>Daily quote</strong>
                  <span>One shared puzzle for ${dateKey()}. Same cipher for everyone on this difficulty.</span>
                  ${solvedToday ? "<em>Solved today</em>" : ""}
                </span>
              </button>
              <button type="button" class="ph-cal-launch" id="cq-calendar" title="Pick another date" aria-label="Pick another day's puzzle">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="cq-play-card" data-mode="random">
                <span class="cq-play-icon">${ICONS.random}</span>
                <span>
                  <strong>Random puzzle</strong>
                  <span>A fresh quote from the archive with a new cipher.</span>
                </span>
              </button>
              <button class="cq-play-card" data-mode="create">
                <span class="cq-play-icon">${ICONS.create}</span>
                <span>
                  <strong>Create your own</strong>
                  <span>Encrypt any quote, play it, print it, or share a link.</span>
                </span>
              </button>
            </div>
            <div class="cq-diff">
              <div class="cq-diff-label">Difficulty</div>
              <div class="cq-seg" role="group" aria-label="Difficulty">
                <button data-diff="easy" class="${difficulty === "easy" ? "active" : ""}">Easy<small>2 letters given</small></button>
                <button data-diff="medium" class="${difficulty === "medium" ? "active" : ""}">Medium<small>1 letter given</small></button>
                <button data-diff="hard" class="${difficulty === "hard" ? "active" : ""}">Hard<small>No free letters</small></button>
              </div>
            </div>
            <div class="cq-splash-links">
              <button class="cq-how" id="cq-how">How to play</button>
              <button class="cq-how" id="cq-history">View history</button>
            </div>
          </div>
        </div>
        <div class="cq-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#cq-how")?.addEventListener("click", showHelp);
    root.querySelector("#cq-history")?.addEventListener("click", openHistory);
    root.querySelector("#cq-calendar")?.addEventListener("click", openDailyCalendar);
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
        if (mode === "create") {
          view = "create";
          render();
        } else if (mode === "resume") {
          if (!resumeProgress()) toast("No saved puzzle found.");
        } else if (mode === "daily") {
          beginDaily();
        } else {
          const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
          beginPuzzle(q, (Math.random() * 0xffffffff) >>> 0, "random");
        }
      });
    });
  }

  function renderCreate() {
    root.innerHTML = `
      <div class="cq-app">
        ${headerHtml("Make a puzzle")}
        <div class="cq-view">
          <button class="cq-back" id="cq-back">← Back to menu</button>
          <form class="cq-form" id="cq-form">
            <label>Quote
              <textarea id="cq-quote" required maxlength="280" placeholder="Enter a quote to encrypt…"></textarea>
            </label>
            <label>Author
              <input id="cq-author" maxlength="80" placeholder="Optional attribution" />
            </label>
            <div class="cq-form-actions">
              <button type="submit" class="cq-btn gold">Play this puzzle</button>
              <button type="button" class="cq-btn" id="cq-share">Copy share link</button>
              <button type="button" class="cq-btn" id="cq-print">Print puzzle</button>
            </div>
          </form>
        </div>
        <div class="cq-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#cq-back")?.addEventListener("click", () => { view = "splash"; render(); });
    const form = root.querySelector("#cq-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = root.querySelector("#cq-quote").value.trim();
      const author = root.querySelector("#cq-author").value.trim() || "Unknown";
      if (uniqueLetters(text).length < 8) {
        toast("Use a longer quote — at least 8 different letters.");
        return;
      }
      beginPuzzle({ id: "custom", text, author, tag: "Custom" }, (Math.random() * 0xffffffff) >>> 0, "custom");
    });
    root.querySelector("#cq-share")?.addEventListener("click", () => {
      const text = root.querySelector("#cq-quote").value.trim();
      const author = root.querySelector("#cq-author").value.trim() || "Unknown";
      if (uniqueLetters(text).length < 8) {
        toast("Enter a quote first.");
        return;
      }
      const seed = (Math.random() * 0xffffffff) >>> 0;
      copyShare({ t: text, a: author, s: seed, d: difficulty });
    });
    root.querySelector("#cq-print")?.addEventListener("click", () => {
      const text = root.querySelector("#cq-quote").value.trim();
      const author = root.querySelector("#cq-author").value.trim() || "Unknown";
      if (uniqueLetters(text).length < 8) {
        toast("Enter a quote first.");
        return;
      }
      const seed = (Math.random() * 0xffffffff) >>> 0;
      beginPuzzle({ id: "custom", text, author, tag: "Custom" }, seed, "custom");
      setTimeout(() => window.print(), 250);
    });
  }

  function startFromQuote(quote, seed, source, dailyDate) {
    const { encode, decode } = buildCipher(seed);
    const quoteText = quote.text.trim();
    const authorText = quote.author.trim();
    const quoteCipher = encodeText(quoteText.toUpperCase(), encode);
    const authorCipher = encodeText(authorText.toUpperCase(), encode);
    const given = pickGiven(quoteCipher + authorCipher, GIVEN_COUNTS[difficulty] ?? 1);
    /** @type {Record<string, string>} */
    const guesses = {};
    for (const cipher of given) guesses[cipher] = decode[cipher];

    game = {
      quote,
      source,
      seed,
      encode,
      decode,
      quoteText: quoteText.toUpperCase(),
      authorText: authorText.toUpperCase(),
      quoteCipher,
      authorCipher,
      guesses,
      given: new Set(given),
      selected: null,
      cursor: 0,
      startedAt: Date.now(),
      elapsed: 0,
      hintsUsed: 0,
      checksUsed: 0,
      wrong: new Set(),
      solved: false,
      dailyDate: source === "daily" ? (dailyDate || dateKey()) : ""
    };

    const first = firstOpenIndex();
    game.cursor = first;
    game.selected = letterAt(first)?.cipher || null;
    view = "play";
    ph()?.setHash(sharePayload());
  }

  function beginPuzzle(quote, seed, source, dailyDate, review) {
    startFromQuote(quote, seed, source, dailyDate);
    if (review) applyReview(review);
    else persistProgress();
    renderPlay();
  }

  function applyReview(review) {
    game.guesses = {};
    for (const cipher of Object.keys(game.decode)) {
      game.guesses[cipher] = game.decode[cipher];
    }
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
    startFromQuote(game.quote, game.seed, game.source, game.dailyDate);
    persistProgress();
    renderPlay();
    toast("Play again.");
  }

  function allLetterCells() {
    if (!game) return [];
    const cells = [];
    let i = 0;
    for (const ch of game.quoteCipher) {
      if (ch >= "A" && ch <= "Z") cells.push({ cipher: ch, plain: game.decode[ch], where: "quote", i: i++ });
    }
    for (const ch of game.authorCipher) {
      if (ch >= "A" && ch <= "Z") cells.push({ cipher: ch, plain: game.decode[ch], where: "author", i: i++ });
    }
    return cells;
  }

  function letterAt(index) {
    return allLetterCells()[index] || null;
  }

  function firstOpenIndex() {
    const cells = allLetterCells();
    const open = cells.findIndex((c) => !game.given.has(c.cipher) && !game.guesses[c.cipher]);
    return open < 0 ? 0 : open;
  }

  function usedPlain() {
    return new Set(Object.values(game.guesses).filter(Boolean));
  }

  function isSolved() {
    return allLetterCells().every((c) => game.guesses[c.cipher] === c.plain);
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
      quote: game.quote,
      source: game.source,
      seed: game.seed,
      difficulty,
      guesses: game.guesses,
      given: [...game.given],
      elapsed: currentElapsed(),
      hintsUsed: game.hintsUsed,
      checksUsed: game.checksUsed,
      dailyDate: game.dailyDate || ""
    }));
  }

  function resumeProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (!p?.quote?.text) return false;
      difficulty = p.difficulty || difficulty;
      startFromQuote(p.quote, p.seed, p.source, p.dailyDate);
      game.guesses = p.guesses || game.guesses;
      game.given = new Set(p.given || []);
      game.elapsed = p.elapsed || 0;
      game.startedAt = Date.now();
      game.hintsUsed = p.hintsUsed || 0;
      game.checksUsed = p.checksUsed || 0;
      const first = firstOpenIndex();
      game.cursor = first;
      game.selected = letterAt(first)?.cipher || null;
      persistProgress();
      renderPlay();
      return true;
    } catch {
      return false;
    }
  }

  function renderPlay() {
    const cells = allLetterCells();
    const quoteWords = tokenize(game.quoteCipher);
    const authorWords = tokenize(game.authorCipher);
    let idx = 0;

    const renderWords = (words) => words.map((word) => {
      const parts = word.map((ch) => {
        if (ch >= "A" && ch <= "Z") {
          const i = idx++;
          const cell = cells[i];
          const guess = game.guesses[cell.cipher] || "";
          const cls = [
            "cq-cell",
            game.selected === cell.cipher ? (game.cursor === i ? "selected" : "same") : "",
            game.given.has(cell.cipher) ? "given" : "",
            game.wrong.has(cell.cipher) ? "wrong" : ""
          ].filter(Boolean).join(" ");
          return `<button type="button" class="${cls}" data-i="${i}" aria-label="Cipher ${cell.cipher}">
            <span class="cq-guess">${guess}</span>
            <span class="cq-cipher">${cell.cipher}</span>
          </button>`;
        }
        return `<span class="cq-punct">${escapeHtml(ch)}</span>`;
      }).join("");
      return `<div class="cq-word">${parts}</div>`;
    }).join("");

    const counts = letterCounts(game.quoteCipher + game.authorCipher);
    const freq = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const used = usedPlain();

    root.innerHTML = `
      <div class="cq-app">
        ${headerHtml(game.source === "daily" ? `Daily · ${prettyDay(game.dailyDate || dateKey())}` : game.quote.tag || "Puzzle")}
        <div class="cq-view">
          <div class="cq-hud">
            <div class="cq-hud-item"><span class="lbl">Time</span><span class="val" id="cq-time">${formatTime(currentElapsed())}</span></div>
            <div class="cq-hud-item"><span class="lbl">Score</span><span class="val" id="cq-score">${scoreNow()}</span></div>
            <div class="cq-hud-item"><span class="lbl">Filled</span><span class="val" id="cq-filled">${Object.keys(game.guesses).length}/${uniqueLetters(game.quoteCipher + game.authorCipher).length}</span></div>
            <div class="cq-toolbar">
              ${game.solved ? `
              ${game.source === "daily" ? `<button class="cq-btn gold" id="cq-again">Play again</button>` : `<button class="cq-btn gold" id="cq-next-bar">Next puzzle</button>`}
              ${game.source === "daily" ? `<button class="cq-btn" id="cq-next-bar">Next puzzle</button>` : ""}
              <button class="cq-btn ghost" id="cq-quit">Menu</button>
              ` : `
              <button class="cq-btn" id="cq-hint">${ICONS.hint} Hint</button>
              <button class="cq-btn" id="cq-check">Check</button>
              <button class="cq-btn ghost" id="cq-quit">Menu</button>
              `}
            </div>
          </div>
          <div class="cq-paper" id="cq-board" tabindex="0">
            <div class="cq-lines">${renderWords(quoteWords)}</div>
            <div class="cq-author-block">
              <div class="cq-author-label">Author</div>
              <div class="cq-lines">${renderWords(authorWords)}</div>
            </div>
          </div>
          <div class="cq-helpers">
            <div class="cq-panel">
              <h3>Letter frequency</h3>
              <div class="cq-freq">
                ${freq.map((ch) => `<button type="button" class="cq-freq-chip ${game.selected === ch ? "selected" : ""}" data-sel="${ch}">${ch}<small>${counts[ch]}</small></button>`).join("")}
              </div>
            </div>
            <div class="cq-panel">
              <h3>Plaintext letters</h3>
              <div class="cq-alpha">
                ${ALPHA.split("").map((ch) => `<button type="button" class="${used.has(ch) ? "used" : ""}" data-type="${ch}">${ch}</button>`).join("")}
              </div>
              <div class="cq-hint">Click a cipher letter, then type its replacement. Backspace clears. No letter maps to itself.</div>
            </div>
            <div class="cq-kb" aria-hidden="true">
              ${["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row, r) => `
                <div class="cq-kb-row">
                  ${r === 2 ? `<button type="button" class="wide" data-type="BACK">⌫</button>` : ""}
                  ${row.split("").map((ch) => `<button type="button" class="${used.has(ch) ? "used" : ""}" data-type="${ch}">${ch}</button>`).join("")}
                  ${r === 2 ? `<button type="button" class="wide" data-act="check">Check</button>` : ""}
                </div>
              `).join("")}
            </div>
          </div>
          ${game.solved ? `
          <div class="cq-solved-bar">
            <div class="cq-solved-copy">
              <strong>Decoded.</strong>
              <span>${formatTime(Math.round(game.elapsed))} · ${scoreNow()}/100 · ${game.checksUsed} check${game.checksUsed === 1 ? "" : "s"}</span>
            </div>
            <div class="cq-solved-actions">
              ${game.source === "daily" ? `<button class="cq-btn gold" id="cq-again-bar">Play again</button>` : `<button class="cq-btn gold" id="cq-next-winbar">Next puzzle</button>`}
              <button class="cq-btn" id="cq-share-bar">Copy link</button>
              <button class="cq-btn ghost" id="cq-menu-bar">Menu</button>
            </div>
          </div>` : ""}
        </div>
        <div class="cq-toast"></div>
      </div>
    `;
    bindChrome();
    bindPlay();
    if (!game.solved) startTimer();
    root.querySelector("#cq-board")?.focus();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function bindPlay() {
    root.querySelector("#cq-quit")?.addEventListener("click", () => {
      persistProgress();
      view = "splash";
      game = null;
      render();
    });
    root.querySelector("#cq-hint")?.addEventListener("click", giveHint);
    root.querySelector("#cq-check")?.addEventListener("click", checkBoard);
    root.querySelector("#cq-again")?.addEventListener("click", playAgain);
    root.querySelector("#cq-again-bar")?.addEventListener("click", playAgain);
    root.querySelector("#cq-share-bar")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#cq-next-bar")?.addEventListener("click", () => {
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      beginPuzzle(q, (Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#cq-next-winbar")?.addEventListener("click", () => {
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      beginPuzzle(q, (Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#cq-menu-bar")?.addEventListener("click", () => {
      view = "splash";
      game = null;
      render();
    });
    root.querySelectorAll(".cq-cell").forEach((el) => {
      el.addEventListener("click", () => selectIndex(Number(el.getAttribute("data-i"))));
    });
    root.querySelectorAll("[data-sel]").forEach((el) => {
      el.addEventListener("click", () => selectCipher(el.getAttribute("data-sel")));
    });
    root.querySelectorAll("[data-type]").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.getAttribute("data-type");
        if (key === "BACK") assign("");
        else assign(key);
      });
    });
    root.querySelector("[data-act='check']")?.addEventListener("click", checkBoard);
  }

  function selectIndex(i) {
    const cell = letterAt(i);
    if (!cell) return;
    game.cursor = i;
    game.selected = cell.cipher;
    refreshSelection();
    root.querySelector("#cq-board")?.focus();
  }

  function selectCipher(ch) {
    const cells = allLetterCells();
    const next = cells.find((c) => c.cipher === ch);
    if (next) selectIndex(next.i);
  }

  function refreshSelection() {
    root.querySelectorAll(".cq-cell").forEach((el) => {
      const i = Number(el.getAttribute("data-i"));
      const cell = letterAt(i);
      el.classList.toggle("selected", game.cursor === i);
      el.classList.toggle("same", !!cell && game.selected === cell.cipher && game.cursor !== i);
    });
    root.querySelectorAll(".cq-freq-chip").forEach((el) => {
      el.classList.toggle("selected", el.getAttribute("data-sel") === game.selected);
    });
  }

  function assign(letter) {
    if (!game || game.solved) return;
    const cell = letterAt(game.cursor);
    if (!cell) return;
    if (game.given.has(cell.cipher)) {
      toast("That letter was given.");
      tone(180, 0.08, "square", 0.04);
      return;
    }
    const up = (letter || "").toUpperCase();
    if (up && (up < "A" || up > "Z")) return;

    if (up) {
      for (const [cipher, plain] of Object.entries(game.guesses)) {
        if (plain === up && cipher !== cell.cipher) {
          if (game.given.has(cipher)) {
            toast("That letter is already given elsewhere.");
            tone(180, 0.08, "square", 0.04);
            return;
          }
          delete game.guesses[cipher];
        }
      }
      game.guesses[cell.cipher] = up;
      tone(520, 0.05, "sine", 0.05);
      advanceAfterAssign(cell.cipher);
    } else {
      delete game.guesses[cell.cipher];
      tone(240, 0.05, "sine", 0.04);
    }
    game.wrong.delete(cell.cipher);
    persistProgress();
    if (isSolved()) {
      renderPlay();
      onSolved();
      return;
    }
    renderPlay();
  }

  function advanceAfterAssign(cipher) {
    const cells = allLetterCells();
    const start = game.cursor;
    const nextSame = cells.find((c) => c.i > start && c.cipher === cipher && !game.guesses[c.cipher]);
    if (nextSame) {
      game.cursor = nextSame.i;
      game.selected = nextSame.cipher;
      return;
    }
    const nextOpen = cells.find((c) => c.i > start && !game.guesses[c.cipher] && !game.given.has(c.cipher));
    if (nextOpen) {
      game.cursor = nextOpen.i;
      game.selected = nextOpen.cipher;
    }
  }

  function onKey(e) {
    if (view !== "play" || !game || root.querySelector(".cq-overlay")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    if (key.length === 1 && /[a-z]/i.test(key)) {
      e.preventDefault();
      assign(key);
      return;
    }
    if (key === "Backspace" || key === "Delete") {
      e.preventDefault();
      assign("");
      return;
    }
    if (key === "ArrowRight" || key === "ArrowLeft") {
      e.preventDefault();
      const cells = allLetterCells();
      const dir = key === "ArrowRight" ? 1 : -1;
      const next = Math.max(0, Math.min(cells.length - 1, game.cursor + dir));
      selectIndex(next);
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

  function giveHint() {
    if (!game || game.solved) return;
    const cells = allLetterCells();
    const counts = letterCounts(game.quoteCipher + game.authorCipher);
    const candidate = Object.keys(counts)
      .filter((ch) => game.guesses[ch] !== game.decode[ch])
      .sort((a, b) => counts[b] - counts[a])[0];
    if (!candidate) return;
    game.hintsUsed += 1;
    game.given.add(candidate);
    game.guesses[candidate] = game.decode[candidate];
    game.wrong.delete(candidate);
    tone(660, 0.1, "triangle", 0.06);
    persistProgress();
    if (isSolved()) {
      renderPlay();
      onSolved();
    } else {
      renderPlay();
      toast(`Revealed ${candidate} → ${game.decode[candidate]}`);
    }
  }

  function checkBoard() {
    if (!game || game.solved) return;
    game.checksUsed += 1;
    game.wrong = new Set();
    let mistakes = 0;
    for (const [cipher, plain] of Object.entries(game.guesses)) {
      if (game.given.has(cipher)) continue;
      if (plain !== game.decode[cipher]) {
        game.wrong.add(cipher);
        mistakes += 1;
      }
    }
    persistProgress();
    renderPlay();
    if (mistakes === 0) {
      toast(Object.keys(game.guesses).length ? "No mistakes so far." : "No letters filled yet.");
      tone(500, 0.08);
    } else {
      toast(`${mistakes} letter${mistakes === 1 ? "" : "s"} look wrong.`);
      tone(170, 0.12, "square", 0.05);
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
      game: "cryptoquote",
      title: quoteTitle(game.quote.text),
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
    const app = root.querySelector(".cq-app");
    overlay = document.createElement("div");
    overlay.className = "cq-overlay";
    overlay.innerHTML = `
      <div class="cq-modal">
        <h2>Decoded.</h2>
        <div class="cq-quote-reveal">“${escapeHtml(game.quote.text)}”</div>
        <div class="cq-author-reveal">— ${escapeHtml(game.quote.author)}</div>
        <div class="cq-win-stats">
          <div><b>${formatTime(time)}</b><span>Time</span></div>
          <div><b>${score}/100</b><span>Score</span></div>
          <div><b>${game.checksUsed}</b><span>Checks</span></div>
        </div>
        <div class="cq-modal-actions">
          <button class="cq-btn gold" id="cq-next">Next puzzle</button>
          <button class="cq-btn" id="cq-again-win">Play again</button>
          <button class="cq-btn" id="cq-share-win">Copy link</button>
          <button class="cq-btn ghost" id="cq-menu-win">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#cq-next")?.addEventListener("click", () => {
      const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      overlay = null;
      beginPuzzle(q, (Math.random() * 0xffffffff) >>> 0, "random");
    });
    overlay.querySelector("#cq-again-win")?.addEventListener("click", playAgain);
    overlay.querySelector("#cq-share-win")?.addEventListener("click", () => {
      copyShare({ t: game.quote.text, a: game.quote.author, s: game.seed, d: difficulty });
    });
    overlay.querySelector("#cq-menu-win")?.addEventListener("click", () => {
      overlay = null;
      view = "splash";
      game = null;
      render();
    });
  }

  function showHelp() {
    const app = root.querySelector(".cq-app");
    const wrap = document.createElement("div");
    wrap.className = "cq-overlay";
    wrap.innerHTML = `
      <div class="cq-modal">
        <h2>How to play</h2>
        <ol>
          <li>Each cipher letter stands for one plaintext letter — the same everywhere.</li>
          <li>No letter ever encodes as itself. Punctuation and spaces are real.</li>
          <li>Select a letter, then type what you think it is. All copies fill in.</li>
          <li>English patterns help: THE, AND, short words, apostrophes, and letter frequency.</li>
          <li>Hint reveals one mapping. Check flags guesses that don't match the quote.</li>
          <li>Score is out of 100. Five minutes and one Check (or none) is perfect; every extra five minutes or extra Check costs 10. Copy the share link to send this exact cipher.</li>
        </ol>
        <div class="cq-modal-actions">
          <button class="cq-btn gold" id="cq-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#cq-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const t = root.querySelector("#cq-time");
      const s = root.querySelector("#cq-score");
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
