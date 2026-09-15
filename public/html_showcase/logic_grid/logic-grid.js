(() => {
  const STATS_KEY = "logic-grid-stats-v1";
  const MUTE_KEY = "logic-grid-muted";
  const DIFF_KEY = "logic-grid-difficulty";
  const PROGRESS_KEY = "logic-grid-progress-v1";

  const SIZE = 4;
  const ALL = 0xf;
  const ORD = 2;
  const DIFFS = ["easy", "medium", "hard", "nightmare"];
  const CLUE_COUNTS = { easy: 8, medium: 7, hard: 6, nightmare: 5 };
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", nightmare: "Nightmare" };
  const HINT_COOLDOWN_MS = 15000;

  const ICONS = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    random: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6l2 3h8v13H4z"/><path d="m9 14 2 2 4-5"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 1 1 0 12h-3"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>'
  };

  const NAMES = [
    "Ada", "Ash", "Bea", "Cal", "Cleo", "Eve", "Finn", "Gwen",
    "Hugo", "Ivy", "Jude", "Kai", "Lena", "Max", "Mira", "Ned",
    "Nina", "Nora", "Omar", "Otto", "Pia", "Remy", "Rosa", "Tess",
    "Uma", "Wes", "Wren", "Zoe"
  ];

  const NOMINALS = [
    {
      id: "hat", label: "Hat",
      values: ["straw", "felt", "wool", "leather"],
      of: (v) => `the one in the ${v} hat`,
      is: (n, v) => `${n} is the one in the ${v} hat`,
      not: (n, v) => `${n} is not the one in the ${v} hat`
    },
    {
      id: "fruit", label: "Fruit",
      values: ["plums", "pears", "damsons", "cherries"],
      of: (v) => `the ${v} seller`,
      is: (n, v) => `${n} is the ${v} seller`,
      not: (n, v) => `${n} is not the ${v} seller`
    },
    {
      id: "coat", label: "Coat",
      values: ["red", "cream", "gray", "navy"],
      of: (v) => `the one in the ${v} coat`,
      is: (n, v) => `${n} is the one in the ${v} coat`,
      not: (n, v) => `${n} is not the one in the ${v} coat`
    },
    {
      id: "pastry", label: "Order",
      values: ["a bun", "a cake", "a pie", "a donut"],
      of: (v) => `the one buying ${v}`,
      is: (n, v) => `${n} is the one buying ${v}`,
      not: (n, v) => `${n} is not the one buying ${v}`
    },
    {
      id: "band", label: "Band",
      values: ["The Smiths", "Nirvana", "ABBA", "Queen"],
      of: (v) => `the ${v} fan`,
      is: (n, v) => `${n}'s favorite band is ${v}`,
      not: (n, v) => `${n}'s favorite band is not ${v}`
    },
    {
      id: "socks", label: "Socks",
      values: ["striped", "argyle", "dotted", "ribbed"],
      of: (v) => `the one in ${v} socks`,
      is: (n, v) => `${n} is wearing ${v} socks`,
      not: (n, v) => `${n} is not wearing ${v} socks`
    },
    {
      id: "mascot", label: "Mascot",
      values: ["Tigers", "Owls", "Bears", "Hawks"],
      of: (v) => `the ${v} alum`,
      is: (n, v) => `${n}'s high-school mascot was the ${v}`,
      not: (n, v) => `${n}'s high-school mascot was not the ${v}`
    },
    {
      id: "drink", label: "Drink",
      values: ["coffee", "tea", "cocoa", "lemonade"],
      of: (v) => `the ${v} drinker`,
      is: (n, v) => `${n} is drinking ${v}`,
      not: (n, v) => `${n} is not drinking ${v}`
    },
    {
      id: "pet", label: "Pet",
      values: ["a cat", "a dog", "a bird", "a rabbit"],
      of: (v) => `the one with ${v}`,
      is: (n, v) => `${n} has ${v}`,
      not: (n, v) => `${n} does not have ${v}`
    },
    {
      id: "job", label: "Job",
      values: ["baker", "potter", "librarian", "gardener"],
      of: (v) => `the ${v}`,
      is: (n, v) => `${n} is the ${v}`,
      not: (n, v) => `${n} is not the ${v}`
    },
    {
      id: "instrument", label: "Instrument",
      values: ["guitar", "piano", "violin", "drums"],
      of: (v) => `the ${v} player`,
      is: (n, v) => `${n} plays the ${v}`,
      not: (n, v) => `${n} does not play the ${v}`
    },
    {
      id: "book", label: "Book",
      values: ["a mystery", "a western", "poetry", "a cookbook"],
      of: (v) => `the one reading ${v}`,
      is: (n, v) => `${n} is reading ${v}`,
      not: (n, v) => `${n} is not reading ${v}`
    },
    {
      id: "color", label: "Color",
      values: ["crimson", "ochre", "teal", "violet"],
      of: (v) => `the one in ${v}`,
      is: (n, v) => `${n} chose ${v}`,
      not: (n, v) => `${n} did not choose ${v}`
    },
    {
      id: "shoes", label: "Shoes",
      values: ["boots", "sneakers", "loafers", "sandals"],
      of: (v) => `the one in ${v}`,
      is: (n, v) => `${n} is wearing ${v}`,
      not: (n, v) => `${n} is not wearing ${v}`
    }
  ];

  const ORDERED = [
    {
      id: "stall", label: "Stall", title: "The market",
      values: ["2", "3", "4", "5"],
      of: (v) => `the one at stall ${v}`,
      is: (n, v) => `${n} is at stall ${v}`,
      not: (n, v) => `${n} is not at stall ${v}`,
      offset: (L, d, R) => `${L} is at a stall numbered exactly ${d} more than ${R}`,
      before: (L, R) => `${L} is at a stall numbered less than ${R}`
    },
    {
      id: "spot", label: "Spot", title: "The bakery line",
      values: ["3rd", "4th", "5th", "6th"],
      of: (v) => `the one ${v} in line`,
      is: (n, v) => `${n} is ${v} in line`,
      not: (n, v) => `${n} is not ${v} in line`,
      offset: (L, d, R) => `${L} is exactly ${d} place${d === 1 ? "" : "s"} later in line than ${R}`,
      before: (L, R) => `${L} is earlier in line than ${R}`
    },
    {
      id: "floor", label: "Floor", title: "The apartment",
      values: ["2nd", "3rd", "4th", "5th"],
      of: (v) => `the one on the ${v} floor`,
      is: (n, v) => `${n} lives on the ${v} floor`,
      not: (n, v) => `${n} does not live on the ${v} floor`,
      offset: (L, d, R) => `${L} lives on a floor numbered exactly ${d} more than ${R}`,
      before: (L, R) => `${L} lives on a floor numbered less than ${R}`
    },
    {
      id: "plot", label: "Plot", title: "The garden",
      values: ["1", "2", "3", "4"],
      of: (v) => `the one at plot ${v}`,
      is: (n, v) => `${n} has garden plot ${v}`,
      not: (n, v) => `${n} does not have garden plot ${v}`,
      offset: (L, d, R) => `${L} is at a plot numbered exactly ${d} more than ${R}`,
      before: (L, R) => `${L} is at a plot numbered less than ${R}`
    },
    {
      id: "place", label: "Place", title: "The race",
      values: ["1st", "2nd", "3rd", "4th"],
      of: (v) => `the one who finished ${v}`,
      is: (n, v) => `${n} finished ${v}`,
      not: (n, v) => `${n} did not finish ${v}`,
      offset: (L, d, R) => `${L} finished exactly ${d} place${d === 1 ? "" : "s"} later than ${R}`,
      before: (L, R) => `${L} finished earlier than ${R}`
    },
    {
      id: "luck", label: "Number", title: "Lucky numbers",
      values: ["4", "5", "6", "7"],
      of: (v) => `the one whose number is ${v}`,
      is: (n, v) => `${n}'s favorite number is ${v}`,
      not: (n, v) => `${n}'s favorite number is not ${v}`,
      offset: (L, d, R) => `${L} has a favorite number exactly ${d} more than ${R}`,
      before: (L, R) => `${L} has a favorite number less than ${R}`
    },
    {
      id: "desk", label: "Desk", title: "The office",
      values: ["1", "2", "3", "4"],
      of: (v) => `the one at desk ${v}`,
      is: (n, v) => `${n} sits at desk ${v}`,
      not: (n, v) => `${n} does not sit at desk ${v}`,
      offset: (L, d, R) => `${L} sits at a desk numbered exactly ${d} more than ${R}`,
      before: (L, R) => `${L} sits at a desk numbered less than ${R}`
    },
    {
      id: "dock", label: "Slip", title: "The marina",
      values: ["A", "B", "C", "D"],
      of: (v) => `the one at slip ${v}`,
      is: (n, v) => `${n} is at slip ${v}`,
      not: (n, v) => `${n} is not at slip ${v}`,
      offset: (L, d, R) => `${L} is at a slip lettered exactly ${d} later than ${R}`,
      before: (L, R) => `${L} is at a slip lettered earlier than ${R}`
    }
  ];

  const NOM_BY_ID = Object.fromEntries(NOMINALS.map((c) => [c.id, c]));
  const ORD_BY_ID = Object.fromEntries(ORDERED.map((c) => [c.id, c]));

  const PERMS = (() => {
    const items = [0, 1, 2, 3];
    const res = [];
    function rec(n) {
      if (n === 1) {
        res.push(items.slice());
        return;
      }
      for (let i = 0; i < n; i++) {
        rec(n - 1);
        if (n % 2) [items[0], items[n - 1]] = [items[n - 1], items[0]];
        else [items[i], items[n - 1]] = [items[n - 1], items[i]];
      }
    }
    rec(4);
    return res;
  })();

  const root = document.getElementById("lg-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "medium";
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let timerId = null;
  let toastTimer = null;
  let audioCtx = null;
  let pressTimer = null;
  let longFired = false;
  let stats = loadStats();
  let tutorialSavedDiff = null;
  let autoTutorialArmed = true;

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

  function utcDayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  }

  function parseDateKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function beginDaily(day = dateKey()) {
    beginPuzzle(hashString(`logic-grid:${day}:${difficulty}`), "daily", day);
  }

  function openDaily(day) {
    const rec = ph()?.findDaily?.("logic-grid", day, difficulty);
    if (rec?.difficulty && DIFFS.includes(rec.difficulty)) {
      difficulty = rec.difficulty;
      localStorage.setItem(DIFF_KEY, difficulty);
    }
    const seed = Number(rec?.share?.s);
    const useSeed = Number.isFinite(seed) ? seed : hashString(`logic-grid:${day}:${difficulty}`);
    beginPuzzle(useSeed, "daily", day, rec || null);
  }

  function openDailyCalendar(ev) {
    ph()?.openCalendar({
      game: "logic-grid",
      host: root.querySelector(".lg-app") || root,
      overlayClass: "lg-overlay",
      title: "Daily Logic Grid",
      onSelect: openDaily,
      anchor: ev?.currentTarget || root.querySelector("#lg-calendar")
    });
  }

  function issueNumber(d = new Date()) {
    return utcDayNumber(d) - Math.floor(Date.UTC(2026, 0, 1) / 86_400_000) + 1;
  }

  function formatPrettyDate(d = new Date()) {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
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
    const payload = { g: "logic-grid", s: game.seed, d: difficulty, src: game.source || "random" };
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
    if (payload.g && payload.g !== "logic-grid") {
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
    if (api.handoff("logic-grid")) return true;
    const payload = api.parseHash();
    if (!payload || (payload.g && payload.g !== "logic-grid")) return false;
    return applyShare(payload);
  }

  function openHistory() {
    ph()?.open({
      currentGame: "logic-grid",
      host: root.querySelector(".lg-app") || root,
      overlayClass: "lg-overlay",
      onReplay: applyShare,
      toast
    });
  }

  function checksForScore() {
    if (!game) return 1;
    return game.solved ? game.checksUsed : game.checksUsed + 1;
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
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

  function playVictory() {
    tone(523, 0.12);
    setTimeout(() => tone(659, 0.12), 90);
    setTimeout(() => tone(784, 0.18), 180);
  }

  function celebrateSolve(selector, done) {
    playVictory();
    const cells = root.querySelectorAll(selector);
    const api = ph();
    if (api?.celebrate) api.celebrate(cells, done);
    else if (typeof done === "function") done();
  }

  function toast(msg) {
    const el = root.querySelector(".lg-toast");
    if (!el || typeof msg !== "string") return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function cap(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function catsOf(sc) {
    return [NOM_BY_ID[sc.ids[0]], NOM_BY_ID[sc.ids[1]], ORD_BY_ID[sc.ids[2]]];
  }

  function clueKey(c) {
    return JSON.stringify(c);
  }

  function who(ref, p0, p1, p2) {
    if (ref.type === "person") return ref.i;
    const row = ref.cat === 0 ? p0 : ref.cat === 1 ? p1 : p2;
    for (let i = 0; i < SIZE; i++) if (row[i] === ref.val) return i;
    return -1;
  }

  function clueHolds(clue, p0, p1, p2) {
    const row = (c) => (c === 0 ? p0 : c === 1 ? p1 : p2);
    switch (clue.type) {
      case "is":
        return row(clue.cat)[clue.person] === clue.val;
      case "not":
        return row(clue.cat)[clue.person] !== clue.val;
      case "link": {
        const p = who({ type: "attr", cat: clue.aCat, val: clue.aVal }, p0, p1, p2);
        return row(clue.bCat)[p] === clue.bVal;
      }
      case "not_link": {
        const p = who({ type: "attr", cat: clue.aCat, val: clue.aVal }, p0, p1, p2);
        return row(clue.bCat)[p] !== clue.bVal;
      }
      case "offset": {
        const L = who(clue.left, p0, p1, p2);
        const R = who(clue.right, p0, p1, p2);
        return p2[L] === p2[R] + clue.delta;
      }
      case "before": {
        const L = who(clue.left, p0, p1, p2);
        const R = who(clue.right, p0, p1, p2);
        return p2[L] < p2[R];
      }
      default:
        return false;
    }
  }

  function countSolutions(clues, limit = 2) {
    let n = 0;
    for (const p0 of PERMS) {
      for (const p1 of PERMS) {
        for (const p2 of PERMS) {
          let ok = true;
          for (const clue of clues) {
            if (!clueHolds(clue, p0, p1, p2)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          n += 1;
          if (n >= limit) return n;
        }
      }
    }
    return n;
  }

  function emptyDomains() {
    return Array.from({ length: SIZE }, () => [ALL, ALL, ALL]);
  }

  function isSingleMask(m) {
    return m !== 0 && (m & (m - 1)) === 0;
  }

  function domainsFilled(rem) {
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) if (!isSingleMask(rem[p][c])) return false;
    }
    return true;
  }

  function peopleWhoCan(rem, ref) {
    if (ref.type === "person") return [ref.i];
    const ps = [];
    for (let p = 0; p < SIZE; p++) {
      if (rem[p][ref.cat] & (1 << ref.val)) ps.push(p);
    }
    return ps;
  }

  function propagate(clues) {
    const rem = emptyDomains();
    let dirty = true;

    function setMask(p, c, next) {
      next &= ALL;
      if (next === rem[p][c]) return true;
      if (!next) return false;
      rem[p][c] = next;
      dirty = true;
      return true;
    }

    function assignVal(p, c, v) {
      if (!(rem[p][c] & (1 << v))) return false;
      if (!setMask(p, c, 1 << v)) return false;
      for (let q = 0; q < SIZE; q++) {
        if (q === p) continue;
        if (!setMask(q, c, rem[q][c] & ~(1 << v))) return false;
      }
      return true;
    }

    function applySingles() {
      for (let p = 0; p < SIZE; p++) {
        for (let c = 0; c < 3; c++) {
          const m = rem[p][c];
          if (!m) return false;
          if (!isSingleMask(m)) continue;
          for (let q = 0; q < SIZE; q++) {
            if (q === p) continue;
            if (!setMask(q, c, rem[q][c] & ~m)) return false;
          }
        }
      }
      for (let c = 0; c < 3; c++) {
        for (let v = 0; v < SIZE; v++) {
          const bit = 1 << v;
          let who = -1;
          let n = 0;
          for (let p = 0; p < SIZE; p++) {
            if (rem[p][c] & bit) {
              who = p;
              n += 1;
            }
          }
          if (n === 0) return false;
          if (n === 1 && rem[who][c] !== bit && !assignVal(who, c, v)) return false;
        }
      }
      return true;
    }

    function applyClue(clue) {
      switch (clue.type) {
        case "is":
          return assignVal(clue.person, clue.cat, clue.val);
        case "not":
          return setMask(clue.person, clue.cat, rem[clue.person][clue.cat] & ~(1 << clue.val));
        case "link": {
          for (let p = 0; p < SIZE; p++) {
            const canA = !!(rem[p][clue.aCat] & (1 << clue.aVal));
            const canB = !!(rem[p][clue.bCat] & (1 << clue.bVal));
            if (canA && !canB && !setMask(p, clue.aCat, rem[p][clue.aCat] & ~(1 << clue.aVal))) return false;
            if (canB && !canA && !setMask(p, clue.bCat, rem[p][clue.bCat] & ~(1 << clue.bVal))) return false;
            if (rem[p][clue.aCat] === (1 << clue.aVal) && !assignVal(p, clue.bCat, clue.bVal)) return false;
            if (rem[p][clue.bCat] === (1 << clue.bVal) && !assignVal(p, clue.aCat, clue.aVal)) return false;
          }
          return true;
        }
        case "not_link": {
          for (let p = 0; p < SIZE; p++) {
            if (rem[p][clue.aCat] === (1 << clue.aVal) && !setMask(p, clue.bCat, rem[p][clue.bCat] & ~(1 << clue.bVal))) return false;
            if (rem[p][clue.bCat] === (1 << clue.bVal) && !setMask(p, clue.aCat, rem[p][clue.aCat] & ~(1 << clue.aVal))) return false;
          }
          return true;
        }
        case "offset":
        case "before": {
          const lefts = peopleWhoCan(rem, clue.left);
          const rights = peopleWhoCan(rem, clue.right);
          if (!lefts.length || !rights.length) return false;
          const allowL = [0, 0, 0, 0];
          const allowR = [0, 0, 0, 0];
          const canBeL = [false, false, false, false];
          const canBeR = [false, false, false, false];
          let pairs = 0;
          for (const pL of lefts) {
            for (const pR of rights) {
              if (pL === pR) continue;
              for (let vR = 0; vR < SIZE; vR++) {
                if (!(rem[pR][ORD] & (1 << vR))) continue;
                for (let vL = 0; vL < SIZE; vL++) {
                  if (!(rem[pL][ORD] & (1 << vL))) continue;
                  const ok = clue.type === "offset" ? vL === vR + clue.delta : vL < vR;
                  if (!ok) continue;
                  pairs += 1;
                  canBeL[pL] = true;
                  canBeR[pR] = true;
                  allowL[pL] |= 1 << vL;
                  allowR[pR] |= 1 << vR;
                }
              }
            }
          }
          if (!pairs) return false;
          if (clue.left.type === "attr") {
            for (let p = 0; p < SIZE; p++) {
              if (!canBeL[p] && !setMask(p, clue.left.cat, rem[p][clue.left.cat] & ~(1 << clue.left.val))) return false;
            }
          }
          if (clue.right.type === "attr") {
            for (let p = 0; p < SIZE; p++) {
              if (!canBeR[p] && !setMask(p, clue.right.cat, rem[p][clue.right.cat] & ~(1 << clue.right.val))) return false;
            }
          }
          const defL = clue.left.type === "person" || peopleWhoCan(rem, clue.left).length === 1;
          const defR = clue.right.type === "person" || peopleWhoCan(rem, clue.right).length === 1;
          if (defL) {
            for (let p = 0; p < SIZE; p++) {
              if (canBeL[p] && !setMask(p, ORD, rem[p][ORD] & allowL[p])) return false;
            }
          }
          if (defR) {
            for (let p = 0; p < SIZE; p++) {
              if (canBeR[p] && !setMask(p, ORD, rem[p][ORD] & allowR[p])) return false;
            }
          }
          return true;
        }
        default:
          return true;
      }
    }

    let guard = 0;
    while (dirty && guard++ < 80) {
      dirty = false;
      for (const clue of clues) {
        if (!applyClue(clue)) return null;
      }
      if (!applySingles()) return null;
    }
    return rem;
  }

  function logicSolvable(clues) {
    const rem = propagate(clues);
    return !!(rem && domainsFilled(rem));
  }

  function logicSolvableWithSplit(clues) {
    const rem = propagate(clues);
    if (!rem) return false;
    if (domainsFilled(rem)) return true;
    let best = null;
    let bestBits = 9;
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        const m = rem[p][c];
        if (isSingleMask(m) || !m) continue;
        let bits = 0;
        for (let v = 0; v < SIZE; v++) if (m & (1 << v)) bits += 1;
        if (bits < bestBits) {
          bestBits = bits;
          best = { p, c, m };
        }
      }
    }
    if (!best || bestBits > 3) return false;
    let solved = 0;
    for (let v = 0; v < SIZE; v++) {
      if (!(best.m & (1 << v))) continue;
      const trial = [{ type: "is", person: best.p, cat: best.c, val: v }, ...clues];
      if (logicSolvable(trial)) solved += 1;
      if (solved > 1) return false;
    }
    return solved === 1;
  }

  function acceptsDifficulty(clues) {
    const logic = logicSolvable(clues);
    const split = logicSolvableWithSplit(clues);
    if (difficulty === "nightmare") return !logic && !split;
    if (logic) return true;
    return difficulty === "hard" && split;
  }

  function uniqueEnoughToDrop(next) {
    if (countSolutions(next) !== 1) return false;
    if (difficulty === "nightmare") return true;
    return acceptsDifficulty(next);
  }

  function refPhrase(ref, sc) {
    const cats = catsOf(sc);
    if (ref.type === "person") return sc.people[ref.i];
    const cat = cats[ref.cat];
    return cat.of(cat.values[ref.val]);
  }

  function clueText(clue, sc) {
    const cats = catsOf(sc);
    const name = (p) => sc.people[p];
    const cat = (c) => cats[c];
    let text = "";
    switch (clue.type) {
      case "is":
        text = cat(clue.cat).is(name(clue.person), cat(clue.cat).values[clue.val]);
        break;
      case "not":
        text = cat(clue.cat).not(name(clue.person), cat(clue.cat).values[clue.val]);
        break;
      case "link":
        text = `${cat(clue.aCat).of(cat(clue.aCat).values[clue.aVal])} is ${cat(clue.bCat).of(cat(clue.bCat).values[clue.bVal])}`;
        break;
      case "not_link":
        text = `${cat(clue.aCat).of(cat(clue.aCat).values[clue.aVal])} is not ${cat(clue.bCat).of(cat(clue.bCat).values[clue.bVal])}`;
        break;
      case "offset":
        text = cats[ORD].offset(refPhrase(clue.left, sc), clue.delta, refPhrase(clue.right, sc));
        break;
      case "before":
        text = cats[ORD].before(refPhrase(clue.left, sc), refPhrase(clue.right, sc));
        break;
      default:
        text = "…";
    }
    if (!/[.!?]$/.test(text)) text += ".";
    return cap(text);
  }

  function ease(clue) {
    if (clue.type === "is") return 0;
    if (clue.type === "link") return 1;
    if (clue.type === "not") return 1;
    if (clue.type === "before") return 2;
    if (clue.type === "offset") return clue.delta === 1 ? 2 : 3;
    return 2;
  }

  function nomRefs(person, sol) {
    return [
      { type: "person", i: person },
      { type: "attr", cat: 0, val: sol[0][person] },
      { type: "attr", cat: 1, val: sol[1][person] }
    ];
  }

  function buildPool(sol, rnd) {
    const pool = [];
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        pool.push({ type: "is", person: p, cat: c, val: sol[c][p] });
      }
    }

    const nots = [];
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        for (let v = 0; v < SIZE; v++) {
          if (v !== sol[c][p]) nots.push({ type: "not", person: p, cat: c, val: v });
        }
      }
    }
    pool.push(...fisherYates(nots, rnd).slice(0, 10));

    for (let c1 = 0; c1 < 3; c1++) {
      for (let c2 = c1 + 1; c2 < 3; c2++) {
        for (let p = 0; p < SIZE; p++) {
          pool.push({
            type: "link",
            aCat: c1, aVal: sol[c1][p],
            bCat: c2, bVal: sol[c2][p]
          });
        }
      }
    }

    const notLinks = [];
    for (let c1 = 0; c1 < 3; c1++) {
      for (let c2 = 0; c2 < 3; c2++) {
        if (c1 === c2) continue;
        for (let p = 0; p < SIZE; p++) {
          for (let v = 0; v < SIZE; v++) {
            if (v === sol[c2][p]) continue;
            notLinks.push({
              type: "not_link",
              aCat: c1, aVal: sol[c1][p],
              bCat: c2, bVal: v
            });
          }
        }
      }
    }
    pool.push(...fisherYates(notLinks, rnd).slice(0, 10));

    for (let pL = 0; pL < SIZE; pL++) {
      for (let pR = 0; pR < SIZE; pR++) {
        if (pL === pR) continue;
        const d = sol[ORD][pL] - sol[ORD][pR];
        if (d <= 0) continue;
        const lefts = nomRefs(pL, sol);
        const rights = nomRefs(pR, sol);
        pool.push({ type: "offset", left: lefts[0], right: rights[0], delta: d });
        pool.push({ type: "offset", left: lefts[1], right: rights[0], delta: d });
        pool.push({ type: "offset", left: lefts[0], right: rights[2], delta: d });
        pool.push({ type: "offset", left: lefts[1], right: rights[2], delta: d });
        pool.push({ type: "before", left: rights[0], right: lefts[0] });
        pool.push({ type: "before", left: rights[0], right: lefts[1] });
        pool.push({ type: "before", left: rights[2], right: lefts[0] });
      }
    }

    const seen = new Set();
    const unique = [];
    for (const clue of pool) {
      if (!clueHolds(clue, sol[0], sol[1], sol[2])) continue;
      const k = clueKey(clue);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(clue);
    }
    return unique;
  }

  function sameClue(a, b) {
    return clueKey(a) === clueKey(b);
  }

  function uniqueByText(pool, sc) {
    const seen = new Set();
    const out = [];
    for (const clue of pool) {
      const text = clueText(clue, sc);
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(clue);
    }
    return out;
  }

  function dropToTarget(pool, target, rnd) {
    let list = pool.slice();
    if (countSolutions(list) !== 1) return null;
    const dropHardFirst = difficulty === "hard" || difficulty === "nightmare";
    const dropOrder = fisherYates(list, rnd).sort((a, b) => {
      const diff = dropHardFirst ? ease(a) - ease(b) : ease(b) - ease(a);
      return diff || (rnd() < 0.5 ? -1 : 1);
    });
    for (const clue of dropOrder) {
      if (list.length <= target) break;
      const next = list.filter((c) => !sameClue(c, clue));
      if (uniqueEnoughToDrop(next)) list = next;
    }
    if (list.length > target) return null;
    if (list.length < target) {
      const have = new Set(list.map(clueKey));
      for (const clue of pool) {
        if (list.length >= target) break;
        if (have.has(clueKey(clue))) continue;
        if (dropHardFirst && clue.type === "is" && list.some((c) => c.type === "is")) continue;
        list.push(clue);
        have.add(clueKey(clue));
      }
    }
    if (list.length !== target) return null;
    if (countSolutions(list) !== 1 || !acceptsDifficulty(list)) return null;
    return list;
  }

  function greedyMix(pool, target, rnd) {
    const buckets = { is: [], link: [], offset: [], before: [], not: [], not_link: [] };
    for (const clue of fisherYates(pool, rnd)) {
      if (buckets[clue.type]) buckets[clue.type].push(clue);
    }
    const order = difficulty === "nightmare"
      ? ["offset", "before", "not_link", "link", "not", "is"]
      : difficulty === "hard"
        ? ["offset", "link", "before", "not_link", "not", "is"]
        : difficulty === "medium"
          ? ["link", "offset", "is", "before", "not", "not_link"]
          : ["is", "link", "not", "offset", "before", "not_link"];
    const picked = [];
    let guard = 0;
    while (picked.length < 18 && guard++ < 100) {
      if (countSolutions(picked) !== 1) {
        /* keep adding */
      } else if (difficulty === "nightmare" || acceptsDifficulty(picked)) {
        break;
      }
      const type = order[guard % order.length];
      if (!buckets[type] || !buckets[type].length) continue;
      picked.push(buckets[type].shift());
    }
    if (countSolutions(picked) !== 1) return null;
    return dropToTarget(picked.concat(pool.filter((c) => !picked.some((p) => sameClue(p, c)))), target, rnd)
      || dropToTarget(picked, target, rnd);
  }

  function tryGenerate(rnd) {
    const people = fisherYates(NAMES, rnd).slice(0, SIZE);
    const noms = fisherYates(NOMINALS, rnd).slice(0, 2);
    const ordered = ORDERED[Math.floor(rnd() * ORDERED.length)];
    const sc = { people, title: ordered.title, ids: [noms[0].id, noms[1].id, ordered.id] };
    const sol = [
      fisherYates([0, 1, 2, 3], rnd),
      fisherYates([0, 1, 2, 3], rnd),
      fisherYates([0, 1, 2, 3], rnd)
    ];
    const pool = uniqueByText(buildPool(sol, rnd), sc);
    if (pool.length < CLUE_COUNTS[difficulty] + 3) return null;

    const target = CLUE_COUNTS[difficulty];
    const clues = dropToTarget(pool, target, rnd) || greedyMix(pool, target, rnd);
    if (!clues || countSolutions(clues) !== 1 || !acceptsDifficulty(clues)) return null;
    return { scenario: sc, solution: sol, clues };
  }

  function generatePuzzle(seed) {
    const attempts = difficulty === "nightmare" ? 280 : 160;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const rnd = mulberry32((seed + attempt * 0x9e3779b9) >>> 0);
      const result = tryGenerate(rnd);
      if (result) return { ...result, seed, attempt };
    }
    return null;
  }

  function headerHtml(subtitle) {
    return `
      <header class="lg-header">
        <div class="lg-brand">
          <div class="lg-mark" aria-hidden="true">LG</div>
          <div class="lg-brand-text">
            <h1>Logic Grid</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="lg-header-actions">
          <button class="lg-icon-btn" id="lg-help" title="Tutorial" aria-label="Open tutorial">${ICONS.help}</button>
          ${game && !isTutorial() ? `<button class="lg-icon-btn" id="lg-share" title="Copy share link" aria-label="Copy share link">${ICONS.share}</button>` : ""}
          <button class="lg-icon-btn" id="lg-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#lg-help")?.addEventListener("click", startTutorial);
    root.querySelector("#lg-tutorial")?.addEventListener("click", startTutorial);
    root.querySelector("#lg-share")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#lg-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#lg-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  function hasProgress() {
    try {
      return !!localStorage.getItem(PROGRESS_KEY);
    } catch {
      return false;
    }
  }

  function renderSplash() {
    view = "splash";
    stopTimer();
    ph()?.clearHash();
    const solvedToday = stats.lastDailyDate === dateKey() && stats.lastDailySolved;
    const clues = CLUE_COUNTS[difficulty];
    root.innerHTML = `
      <div class="lg-app">
        ${headerHtml("Cross out what isn’t true")}
        <div class="lg-view">
          <div class="lg-splash">
            <div class="lg-hero">
              <button type="button" class="lg-tut-btn" id="lg-tutorial" title="Tutorial" aria-label="Open tutorial">?</button>
              <h2>Logic Grid</h2>
              <p>The old magazine deduction puzzle — four people, three attributes, and a handful of clues. Eliminate until only the truth remains.</p>
            </div>
            <div class="lg-stats-row">
              <div class="lg-stat"><b>${stats.solvedCount}</b><span>Solved</span></div>
              <div class="lg-stat"><b>${stats.currentStreak}</b><span>Streak</span></div>
              <div class="lg-stat"><b>${stats.bestScore || "—"}</b><span>Best /100</span></div>
              <div class="lg-stat"><b>${stats.bestTime ? formatTime(stats.bestTime) : "—"}</b><span>Best time</span></div>
            </div>
            <div class="lg-play-grid">
              ${hasProgress() ? `
              <button class="lg-play-card primary" data-mode="resume">
                <span class="lg-play-icon">${ICONS.random}</span>
                <span>
                  <strong>Continue puzzle</strong>
                  <span>Pick up the grid you were eliminating. Timer stays on this device.</span>
                </span>
              </button>` : ""}
              <div class="ph-daily-row">
              <button class="lg-play-card ${hasProgress() ? "" : "primary"}" data-mode="daily">
                <span class="lg-play-icon">${ICONS.daily}</span>
                <span>
                  <strong>Daily puzzle</strong>
                  <span>Issue no. ${issueNumber()} · ${formatPrettyDate()} at this difficulty.</span>
                  ${solvedToday ? "<em>Solved today</em>" : ""}
                </span>
              </button>
              <button type="button" class="ph-cal-launch" id="lg-calendar" title="Pick another date" aria-label="Pick another day's puzzle">${ph()?.CAL_ICON || ICONS.daily}</button>
              </div>
              <button class="lg-play-card" data-mode="random">
                <span class="lg-play-icon">${ICONS.random}</span>
                <span>
                  <strong>New puzzle</strong>
                  <span>A fresh unique grid with ${clues} clues${difficulty === "nightmare" ? " — you’ll have to branch" : ""}.</span>
                </span>
              </button>
            </div>
            <div class="lg-diff">
              <div class="lg-diff-label">Difficulty</div>
              <div class="lg-seg" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${CLUE_COUNTS[d]} clues</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="lg-splash-links">
              <button class="lg-how" id="lg-how">How to play</button>
              <button class="lg-how" id="lg-history">View history</button>
            </div>
          </div>
        </div>
        <div class="lg-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#lg-how")?.addEventListener("click", startTutorial);
    root.querySelector("#lg-history")?.addEventListener("click", openHistory);
    root.querySelector("#lg-calendar")?.addEventListener("click", openDailyCalendar);
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

  function emptyGrid(fill) {
    return Array.from({ length: SIZE }, () => Array.from({ length: 3 }, () => fill));
  }

  function blankBoard(clues) {
    const elim = emptyGrid(0);
    const confirmed = emptyGrid(-1);
    const locked = emptyGrid(false);
    if (difficulty === "easy") {
      for (const clue of clues) {
        if (clue.type !== "is") continue;
        confirmed[clue.person][clue.cat] = clue.val;
        locked[clue.person][clue.cat] = true;
        elim[clue.person][clue.cat] = ALL & ~(1 << clue.val);
      }
    }
    return { elim, confirmed, locked };
  }

  function startFromGenerated(puzzle, source, dailyDate) {
    const board = blankBoard(puzzle.clues);
    game = {
      seed: puzzle.seed,
      source,
      scenario: puzzle.scenario,
      solution: puzzle.solution,
      clues: puzzle.clues,
      ...board,
      usedClues: puzzle.clues.map(() => false),
      selected: { p: 0, c: 0 },
      startedAt: Date.now(),
      elapsed: 0,
      hintsUsed: 0,
      lastHintAt: 0,
      checksUsed: 0,
      wrong: new Set(),
      undo: [],
      solved: false,
      dailyDate: source === "daily" ? (dailyDate || dateKey()) : ""
    };
    view = "play";
    if (source === "tutorial") ph()?.clearHash();
    else ph()?.setHash(sharePayload());
  }

  function fillSolvedBoard() {
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        const v = game.solution[c][p];
        game.confirmed[p][c] = v;
        game.elim[p][c] = ALL & ~(1 << v);
      }
    }
  }

  function applyReview(review) {
    fillSolvedBoard();
    game.solved = true;
    game.elapsed = Number(review.time) || 0;
    game.checksUsed = Number(review.checks) || 1;
    game.hintsUsed = Number(review.hints) || 0;
    game.wrong = new Set();
    game.usedClues = game.clues.map(() => true);
    game.undo = [];
    stopTimer();
  }

  function playAgain() {
    resetPuzzle("Play again.");
  }

  function resetPuzzle(message = "Started over.") {
    if (!game) return;
    const note = typeof message === "string" && message ? message : "Started over.";
    const board = blankBoard(game.clues);
    game.elim = board.elim;
    game.confirmed = board.confirmed;
    game.locked = board.locked;
    game.usedClues = game.clues.map(() => false);
    game.selected = { p: 0, c: 0 };
    game.startedAt = Date.now();
    game.elapsed = 0;
    game.hintsUsed = 0;
    game.lastHintAt = 0;
    game.checksUsed = 0;
    game.wrong = new Set();
    game.undo = [];
    game.solved = false;
    persistProgress();
    window.setTimeout(() => {
      if (!game) return;
      renderPlay();
      toast(note);
      tone(320, 0.08, "sine", 0.05);
    }, 0);
  }

  function beginPuzzle(seed, source, dailyDate, review) {
    showGenerating();
    window.setTimeout(() => {
      try {
        const puzzle = generatePuzzle(seed);
        if (!puzzle) throw new Error("generate");
        startFromGenerated(puzzle, source, dailyDate);
        if (review) applyReview(review);
        else persistProgress();
        renderPlay();
      } catch {
        view = "splash";
        renderSplash();
        toast("Could not build a unique puzzle. Try again.");
      }
    }, 40);
  }

  function showGenerating() {
    root.innerHTML = `
      <div class="lg-app">
        ${headerHtml("Shuffling hats and alibis")}
        <div class="lg-view">
          <p class="lg-generating">${difficulty === "nightmare"
            ? `Hiding the path behind ${CLUE_COUNTS.nightmare} clues…`
            : `Writing ${CLUE_COUNTS[difficulty]} clues that fit exactly one story…`}</p>
        </div>
      </div>
    `;
    bindChrome();
  }

  function localRemaining(p, c) {
    if (game.confirmed[p][c] >= 0) return 1 << game.confirmed[p][c];
    return ALL & ~game.elim[p][c];
  }

  function cellMask(p, c) {
    return localRemaining(p, c);
  }

  function snapshot() {
    return {
      elim: game.elim.map((row) => row.slice()),
      confirmed: game.confirmed.map((row) => row.slice()),
      usedClues: game.usedClues.slice()
    };
  }

  function pushUndo() {
    game.undo.push(snapshot());
    if (game.undo.length > 50) game.undo.shift();
  }

  function undo() {
    if (!game || game.solved || !game.undo.length) return;
    const prev = game.undo.pop();
    game.elim = prev.elim;
    game.confirmed = prev.confirmed;
    game.usedClues = prev.usedClues;
    game.wrong = new Set();
    tone(280, 0.06, "sine", 0.04);
    persistProgress();
    renderPlay();
  }

  function filledCount() {
    let n = 0;
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) if (isSingleMask(cellMask(p, c))) n += 1;
    }
    return n;
  }

  function isSolved() {
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        if (cellMask(p, c) !== (1 << game.solution[c][p])) return false;
      }
    }
    return true;
  }

  function afterBoardChange() {
    game.wrong = new Set();
    persistProgress();
    renderPlay();
  }

  function hintsForScore() {
    return Math.max(0, game?.hintsUsed | 0);
  }

  function scoreNow() {
    const api = ph();
    if (api) return api.score100(currentElapsed(), checksForScore(), hintsForScore());
    return Math.max(0, 100 - Math.max(0, Math.ceil(currentElapsed() / 300) - 1) * 10 - Math.max(0, checksForScore() - 1) * 10 - hintsForScore() * 10);
  }

  function currentElapsed() {
    if (!game) return 0;
    if (game.solved) return game.elapsed;
    return game.elapsed + (Date.now() - game.startedAt) / 1000;
  }

  function persistProgress() {
    if (!game || game.tutorial || game.source === "tutorial") return;
    if (game.solved) {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      seed: game.seed,
      source: game.source,
      difficulty,
      scenario: game.scenario,
      solution: game.solution,
      clues: game.clues,
      elim: game.elim,
      confirmed: game.confirmed,
      locked: game.locked,
      usedClues: game.usedClues,
      elapsed: currentElapsed(),
      hintsUsed: hintsForScore(),
      lastHintAt: game.lastHintAt || 0,
      checksUsed: game.checksUsed,
      selected: game.selected,
      dailyDate: game.dailyDate || ""
    }));
  }

  function resumeProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      if (!p?.scenario?.ids || !Array.isArray(p.clues)) return false;
      if (!catsOf(p.scenario).every(Boolean)) return false;
      difficulty = p.difficulty || difficulty;
      game = {
        seed: p.seed,
        source: p.source || "random",
        scenario: p.scenario,
        solution: p.solution,
        clues: p.clues,
        elim: p.elim,
        confirmed: p.confirmed,
        locked: p.locked,
        usedClues: p.usedClues || p.clues.map(() => false),
        selected: p.selected || { p: 0, c: 0 },
        startedAt: Date.now(),
        elapsed: p.elapsed || 0,
        hintsUsed: p.hintsUsed || 0,
        lastHintAt: p.lastHintAt || 0,
        checksUsed: p.checksUsed || 0,
        wrong: new Set(),
        undo: [],
        solved: false,
        dailyDate: p.dailyDate || ""
      };
      view = "play";
      persistProgress();
      ph()?.setHash(sharePayload());
      renderPlay();
      return true;
    } catch {
      return false;
    }
  }

  function renderPlay() {
    const sc = game.scenario;
    const cats = catsOf(sc);
    const dailyAt = game.dailyDate ? parseDateKey(game.dailyDate) : new Date();
    const issue = game.source === "daily"
      ? `NO. ${issueNumber(dailyAt)} · ${formatPrettyDate(dailyAt)}`
      : `RANDOM · ${DIFF_LABEL[difficulty]}`;
    const sel = game.selected;

    const chips = (p, c) => {
      const mask = cellMask(p, c);
      const lone = isSingleMask(mask);
      return cats[c].values.map((label, v) => {
        const out = !(mask & (1 << v));
        const cls = ["lg-chip"];
        if (out) cls.push("out");
        else if (lone) cls.push("ready");
        const state = game.locked[p][c] && !out ? "given" : out ? "ruled out" : lone ? "last remaining" : "possible";
        return `<button type="button" class="${cls.join(" ")}" data-p="${p}" data-c="${c}" data-v="${v}" aria-label="${esc(sc.people[p])}, ${esc(cats[c].label)} ${esc(label)}, ${state}">${esc(label)}</button>`;
      }).join("");
    };

    const cells = [];
    for (let p = 0; p < SIZE; p++) {
      cells.push(`<div class="lg-who">${esc(sc.people[p])}</div>`);
      for (let c = 0; c < 3; c++) {
        const mask = cellMask(p, c);
        const lone = isSingleMask(mask);
        const cls = ["lg-cell"];
        if (sel.p === p && sel.c === c) cls.push("selected");
        if (lone) cls.push("ready");
        if (game.wrong.has(`${p}-${c}`)) cls.push("wrong");
        cells.push(`<div class="${cls.join(" ")}" data-cell="${p}-${c}">${chips(p, c)}</div>`);
      }
    }

    root.innerHTML = `
      <div class="lg-app">
        ${headerHtml(game.source === "tutorial" ? "Guided tutorial" : game.source === "daily" ? `Daily · ${formatPrettyDate(dailyAt)} · ${DIFF_LABEL[difficulty]}` : `${DIFF_LABEL[difficulty]} puzzle`)}
        <div class="lg-view">
          <div class="lg-hud">
            <div class="lg-hud-item"><span class="lbl">Time</span><span class="val" id="lg-time">${formatTime(currentElapsed())}</span></div>
            <div class="lg-hud-item"><span class="lbl">Score</span><span class="val" id="lg-score">${scoreNow()}</span></div>
            <div class="lg-hud-item"><span class="lbl">Set</span><span class="val">${filledCount()}/12</span></div>
            <div class="lg-toolbar">
              ${game.solved ? `
              ${game.source === "daily" ? `<button class="lg-btn gold" id="lg-again">Play again</button>` : `<button class="lg-btn gold" id="lg-next">Next puzzle</button>`}
              ${game.source === "daily" ? `<button class="lg-btn" id="lg-next">Next puzzle</button>` : ""}
              <button class="lg-btn ghost" id="lg-quit">Menu</button>
              ` : `
              <button class="lg-btn" id="lg-undo">${ICONS.undo} Undo</button>
              ${hintButtonHtml()}
              <button class="lg-btn" id="lg-check">Check</button>
              <button class="lg-btn" id="lg-reset">${ICONS.reset} Reset</button>
              <button class="lg-btn ghost" id="lg-quit">Menu</button>
              `}
            </div>
          </div>
          <div class="lg-play-stack">
          <div class="lg-issue">
            <span class="no">${issue}</span>
            <h2>${esc(sc.title)}</h2>
          </div>
          <div class="lg-clues">
            <ol>
              ${game.clues.map((clue, i) =>
                `<li data-clue="${i}" class="${game.usedClues[i] ? "used" : ""}"><span class="lg-clue-num">${i + 1}.</span><span class="lg-clue-body">${esc(clueText(clue, sc))}</span></li>`
              ).join("")}
            </ol>
            <p class="lg-clue-hint">Tap a clue once you’ve used it</p>
          </div>
          <div class="lg-board">
            <div></div>
            ${cats.map((cat) => `<div class="lg-col-h">${esc(cat.label)}</div>`).join("")}
            ${cells.join("")}
          </div>
          </div>
          ${game.solved ? `
          <div class="lg-solved-bar">
            <div class="lg-solved-copy">
              <strong>Deduced.</strong>
              <span>${formatTime(Math.round(game.elapsed))} · ${scoreNow()}/100 · ${game.checksUsed} check${game.checksUsed === 1 ? "" : "s"} · ${hintsForScore()} hint${hintsForScore() === 1 ? "" : "s"} · ${DIFF_LABEL[difficulty]}</span>
            </div>
            <div class="lg-solved-actions">
              ${game.source === "daily" ? `<button class="lg-btn gold" id="lg-again-bar">Play again</button>` : `<button class="lg-btn gold" id="lg-next-bar">Next puzzle</button>`}
              ${game.source === "daily" ? `<button class="lg-btn" id="lg-next-bar">Next puzzle</button>` : ""}
              <button class="lg-btn" id="lg-share-bar">Copy link</button>
              <button class="lg-btn ghost" id="lg-menu-win">Menu</button>
            </div>
          </div>
          ` : `<p class="lg-play-hint">Tap to rule a possibility out. Hold to lock in an answer in that box. Hit Check when you think you’re done.</p>`}
        </div>
        <div class="lg-toast"></div>
      </div>
    `;
    bindChrome();
    bindPlay();
    if (!game.solved) startTimer();
    pt()?.refresh?.();
  }

  function bindPlay() {
    let pointerHandled = false;
    root.querySelector("#lg-quit")?.addEventListener("click", () => {
      if (isTutorial()) {
        leaveTutorial();
        return;
      }
      persistProgress();
      view = "splash";
      game = null;
      renderSplash();
    });
    root.querySelector("#lg-next")?.addEventListener("click", () => {
      beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#lg-next-bar")?.addEventListener("click", () => {
      beginPuzzle((Math.random() * 0xffffffff) >>> 0, "random");
    });
    root.querySelector("#lg-menu-win")?.addEventListener("click", () => {
      if (isTutorial()) {
        leaveTutorial();
        return;
      }
      view = "splash";
      game = null;
      renderSplash();
    });
    root.querySelector("#lg-share-bar")?.addEventListener("click", copyPuzzleLink);
    root.querySelector("#lg-again")?.addEventListener("click", playAgain);
    root.querySelector("#lg-again-bar")?.addEventListener("click", playAgain);
    root.querySelector("#lg-hint")?.addEventListener("click", giveHint);
    root.querySelector("#lg-check")?.addEventListener("click", checkBoard);
    root.querySelector("#lg-reset")?.addEventListener("click", () => resetPuzzle());
    root.querySelector("#lg-undo")?.addEventListener("click", undo);
    root.querySelectorAll("[data-clue]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = Number(el.getAttribute("data-clue"));
        game.usedClues[i] = !game.usedClues[i];
        persistProgress();
        el.classList.toggle("used", game.usedClues[i]);
      });
    });
    root.querySelectorAll(".lg-chip").forEach((btn) => {
      const p = Number(btn.getAttribute("data-p"));
      const c = Number(btn.getAttribute("data-c"));
      const v = Number(btn.getAttribute("data-v"));
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
      btn.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        game.selected = { p, c };
        longFired = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          longFired = true;
          confirmCell(p, c, v);
        }, 420);
      });
      btn.addEventListener("pointerup", (e) => {
        clearTimeout(pressTimer);
        if (longFired) return;
        if (e.button && e.button !== 0) return;
        pointerHandled = true;
        toggleElim(p, c, v);
      });
      btn.addEventListener("click", () => {
        if (pointerHandled) {
          pointerHandled = false;
          return;
        }
        toggleElim(p, c, v);
      });
      btn.addEventListener("pointercancel", () => clearTimeout(pressTimer));
    });
  }

  function toggleElim(p, c, v) {
    if (!game || game.solved) return;
    if (game.locked[p][c]) {
      toast("That square was given.");
      tone(180, 0.08, "square", 0.04);
      return;
    }
    game.selected = { p, c };
    const local = localRemaining(p, c);
    const currentlyOut = !(local & (1 << v));
    pushUndo();
    if (!currentlyOut) {
      game.elim[p][c] |= 1 << v;
      if (game.confirmed[p][c] === v) game.confirmed[p][c] = -1;
      tone(320, 0.04, "sine", 0.04);
    } else {
      game.elim[p][c] &= ~(1 << v);
      game.confirmed[p][c] = -1;
      tone(360, 0.04, "sine", 0.04);
    }
    afterBoardChange();
  }

  function confirmCell(p, c, v) {
    if (!game || game.solved) return;
    if (game.locked[p][c]) {
      toast("That square was given.");
      tone(180, 0.08, "square", 0.04);
      return;
    }
    game.selected = { p, c };
    if (!(localRemaining(p, c) & (1 << v))) {
      toggleElim(p, c, v);
      return;
    }
    if (isSingleMask(localRemaining(p, c)) && (localRemaining(p, c) & (1 << v))) {
      toggleElim(p, c, v);
      return;
    }
    pushUndo();
    game.confirmed[p][c] = v;
    game.elim[p][c] = ALL & ~(1 << v);
    tone(320, 0.04, "sine", 0.04);
    afterBoardChange();
  }

  function hintCooldownLeft() {
    if (!game?.lastHintAt) return 0;
    return Math.max(0, HINT_COOLDOWN_MS - (Date.now() - game.lastHintAt));
  }

  function hintButtonHtml() {
    const wait = Math.ceil(hintCooldownLeft() / 1000);
    const label = wait ? `Hint ${wait}s` : "Hint";
    return `<button class="lg-btn" id="lg-hint"${wait ? " disabled" : ""}>${ICONS.hint} ${label}</button>`;
  }

  function syncHintButton() {
    const btn = root.querySelector("#lg-hint");
    if (!btn) return;
    const wait = Math.ceil(hintCooldownLeft() / 1000);
    const label = wait ? `Hint ${wait}s` : "Hint";
    const state = `${wait}|${label}`;
    btn.disabled = wait > 0;
    if (btn.dataset.state === state) return;
    btn.dataset.state = state;
    btn.innerHTML = `${ICONS.hint} ${label}`;
  }

  function chargeHint() {
    game.hintsUsed = hintsForScore() + 1;
    game.lastHintAt = Date.now();
  }

  function giveHint() {
    if (!game || game.solved) return;
    const left = hintCooldownLeft();
    if (left > 0) {
      toast(`Next hint in ${Math.ceil(left / 1000)}s.`);
      return;
    }
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        if (game.locked[p][c]) continue;
        const truth = game.solution[c][p];
        if (game.confirmed[p][c] >= 0 && game.confirmed[p][c] !== truth) {
          pushUndo();
          game.confirmed[p][c] = -1;
          game.elim[p][c] &= ~(1 << truth);
          chargeHint();
          game.wrong.delete(`${p}-${c}`);
          game.selected = { p, c };
          tone(660, 0.1, "triangle", 0.06);
          persistProgress();
          renderPlay();
          toast("Cleared an incorrect answer.");
          return;
        }
      }
    }
    let best = null;
    let bestBits = 99;
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        if (isSingleMask(cellMask(p, c))) continue;
        const truth = game.solution[c][p];
        const mask = cellMask(p, c);
        if (!(mask & (1 << truth))) continue;
        const extras = [];
        for (let v = 0; v < SIZE; v++) {
          if (v !== truth && (mask & (1 << v))) extras.push(v);
        }
        if (extras.length && extras.length < bestBits) {
          bestBits = extras.length;
          best = { p, c, v: extras[0] };
        }
      }
    }
    if (best) {
      pushUndo();
      game.elim[best.p][best.c] |= 1 << best.v;
      chargeHint();
      game.selected = { p: best.p, c: best.c };
      tone(660, 0.1, "triangle", 0.06);
      afterBoardChange();
      if (!game.solved) toast("Ruled out a possibility.");
      return;
    }
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        if (cellMask(p, c) === (1 << game.solution[c][p])) continue;
        const truth = game.solution[c][p];
        pushUndo();
        game.confirmed[p][c] = truth;
        game.elim[p][c] = ALL & ~(1 << truth);
        game.locked[p][c] = true;
        chargeHint();
        game.selected = { p, c };
        tone(660, 0.1, "triangle", 0.06);
        afterBoardChange();
        if (!game.solved) toast("Left the correct option.");
        return;
      }
    }
  }

  function checkBoard() {
    if (!game || game.solved) return;
    if (isSolved()) {
      game.checksUsed += 1;
      onSolved();
      return;
    }
    game.checksUsed += 1;
    game.wrong = new Set();
    let mistakes = 0;
    for (let p = 0; p < SIZE; p++) {
      for (let c = 0; c < 3; c++) {
        const truth = game.solution[c][p];
        if (game.confirmed[p][c] >= 0 && game.confirmed[p][c] !== truth) {
          game.wrong.add(`${p}-${c}`);
          mistakes += 1;
        } else if (game.elim[p][c] & (1 << truth)) {
          game.wrong.add(`${p}-${c}`);
          mistakes += 1;
        }
      }
    }
    persistProgress();
    renderPlay();
    if (mistakes === 0) {
      toast(filledCount() === 12 ? "Every box is filled, but it isn’t the unique story. Keep looking." : filledCount() === 0 ? "Nothing to check yet." : "No mistakes so far.");
      tone(500, 0.08);
    } else {
      toast(`${mistakes} cell${mistakes === 1 ? " looks" : "s look"} wrong.`);
      tone(170, 0.12, "square", 0.05);
    }
  }

  function onSolved() {
    if (isTutorial()) {
      const elapsed = currentElapsed();
      game.solved = true;
      game.elapsed = elapsed;
      stopTimer();
      pt()?.stop("finished");
      toast("Practice grid deduced. That’s the whole game.");
      celebrateSolve(".lg-cell", renderPlay);
      return;
    }
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
        /* already counted */
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
      game: "logic-grid",
      title: game.scenario?.title || "Logic Grid",
      difficulty,
      source: game.source,
      dailyDate: game.dailyDate || "",
      score,
      time,
      checks: game.checksUsed,
      hints: hintsForScore(),
      share: sharePayload()
    });
    celebrateSolve(".lg-cell", renderPlay);
  }

  function pt() {
    return window.PuzzleTutorial || null;
  }

  function isTutorial() {
    return !!(game && (game.tutorial || game.source === "tutorial"));
  }

  function restoreTutorialDiff() {
    if (tutorialSavedDiff != null) {
      difficulty = tutorialSavedDiff;
      tutorialSavedDiff = null;
    }
  }

  function leaveTutorial() {
    restoreTutorialDiff();
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
    if (tutorialSavedDiff == null) tutorialSavedDiff = difficulty;
    difficulty = "easy";
    let puzzle = null;
    for (const seed of [20260914, 11, 42, 99, 123456, 7]) {
      puzzle = generatePuzzle(seed);
      if (puzzle) break;
    }
    if (!puzzle) {
      restoreTutorialDiff();
      toast("Could not build a practice grid.");
      throw new Error("tutorial");
    }
    startFromGenerated(puzzle, "tutorial");
    game.tutorial = true;
    renderPlay();
  }

  function startTutorial() {
    const api = pt();
    if (!api) {
      showHelp();
      return;
    }
    if (game && !isTutorial()) persistProgress();
    stopTimer();
    if (!(view === "splash" && !game)) {
      game = null;
      view = "splash";
      renderSplash();
    }
    const host = root.querySelector(".lg-app");
    if (!host) return;
    api.start({
      host,
      getHost: () => root.querySelector(".lg-app") || root,
      gameId: "logic-grid",
      onDone: (reason) => {
        if (reason === "finished") return;
        restoreTutorialDiff();
        stopTimer();
        game = null;
        view = "splash";
        renderSplash();
      },
      steps: [
        {
          title: "Cross out what isn’t true",
          body: "Four people, each with one value in every category. The clues describe the only story that fits. Let’s walk through a practice grid.",
          placement: "center",
          nextLabel: "Start"
        },
        {
          title: "The clues",
          body: "Read these first. Tap a clue once you’ve used it so you can see what’s left. Easy puzzles also lock a few true facts onto the grid.",
          selector: ".lg-clues",
          onEnter: () => beginTutorialPuzzle()
        },
        {
          title: "The grid",
          body: "Each row is a person. Each column is a category. Every possibility starts in play until you rule it out.",
          selector: ".lg-board"
        },
        {
          title: "Rule one out",
          body: "Tap a remaining option to cross it off. If a clue says someone isn’t in the straw hat, tap straw in that row.",
          selector: (host) => {
            const open = [...host.querySelectorAll(".lg-chip")].find((el) =>
              !el.classList.contains("out") && !el.closest(".lg-cell")?.classList.contains("ready")
            );
            return open || host.querySelector(".lg-chip:not(.out)");
          },
          advanceOn: "target"
        },
        {
          title: "Lock an answer",
          body: "Hold a remaining option to lock it in for that box only. You still have to cross that value off for everyone else.",
          selector: (host) => {
            const open = [...host.querySelectorAll(".lg-chip")].find((el) =>
              !el.classList.contains("out") && !el.closest(".lg-cell")?.classList.contains("ready")
            );
            return open || host.querySelector(".lg-chip:not(.out)");
          }
        },
        {
          title: "Check when you’re done",
          body: "Check is how you finish. It also highlights mistakes once; those marks clear when you change the board. Hint rules out one wrong option (−10, 15s cooldown). Score is out of 100.",
          selector: "#lg-hint, #lg-check",
          nextLabel: "Got it"
        }
      ]
    });
  }

  function maybeAutoTutorial() {
    if (!autoTutorialArmed) return;
    autoTutorialArmed = false;
    const api = pt();
    if (!api || api.seen("logic-grid")) return;
    window.setTimeout(() => {
      if (view === "splash" && !game) startTutorial();
    }, 450);
  }

  function showHelp() {
    const app = root.querySelector(".lg-app");
    const wrap = document.createElement("div");
    wrap.className = "lg-overlay";
    wrap.innerHTML = `
      <div class="lg-modal">
        <h2>How to play</h2>
        <ol>
          <li>These are the old magazine “logic problems”: four people, each with one value in every category.</li>
          <li>Read the clues. Tap a possibility to rule it out. Hold to rule out the rest in that box.</li>
          <li>Each value is used once. Settling a box does not cross that value off for anyone else — that is still yours to do. Hold locks in an answer in that box only.</li>
          <li>Tap clues you’ve already used. Check is how you finish — it also highlights mistakes once, and those marks clear when you change the board. Hint rules out one wrong option, costs 10, and waits 15 seconds between uses. Reset starts this same puzzle over.</li>
          <li>Score is out of 100. Five minutes and one Check is perfect; every extra five minutes, extra Check, or Hint costs 10. Copy the share link to send this exact grid.</li>
          <li>Easy 8 and Medium 7 can be finished by elimination. Hard 6 may need one short “what if.” Nightmare 5 is still unique, but the clues will not nail a path — you have to branch.</li>
        </ol>
        <div class="lg-modal-actions">
          <button class="lg-btn gold" id="lg-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#lg-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      const t = root.querySelector("#lg-time");
      const s = root.querySelector("#lg-score");
      if (t) t.textContent = formatTime(currentElapsed());
      if (s) s.textContent = String(scoreNow());
      syncHintButton();
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
    if (root.querySelector(".lg-overlay")) return;
    if (pt()?.isActive() && e.key === "Escape") return;
    if (e.key === "Escape") {
      if (isTutorial()) {
        persistProgress();
        leaveTutorial();
        return;
      }
      persistProgress();
      view = "splash";
      game = null;
      renderSplash();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  });

  if (!tryShare()) {
    renderSplash();
    maybeAutoTutorial();
  }
})();
