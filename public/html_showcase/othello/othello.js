(() => {
  const STATS_KEY = "othello-stats-v1";
  const MUTE_KEY = "othello-muted";
  const DIFF_KEY = "othello-difficulty";
  const COLOR_KEY = "othello-color";
  const PROGRESS_KEY = "othello-progress-v1";

  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const FILES = "abcdefgh";
  const DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];

  const DIFFS = ["easy", "medium", "hard", "nightmare"];
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", nightmare: "Nightmare" };
  const DIFF_BLURB = {
    easy: "Mostly random. Misses corners.",
    medium: "Greedy flips. Short sight.",
    hard: "Looks a few moves ahead.",
    nightmare: "Deep search. Endgame solver."
  };
  const DIFF_THINK = { easy: 280, medium: 420, hard: 280, nightmare: 180 };
  const DIFF_SEARCH = {
    easy: { depth: 1, noise: 0.85, weak: true },
    medium: { depth: 2, noise: 0.28 },
    hard: { depth: 4, noise: 0 },
    nightmare: { depth: 6, noise: 0, endgame: 12, budget: 1400 }
  };

  const WEIGHTS = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
     20,  -5, 15, 3, 3, 15,  -5,  20,
      5,  -5,  3, 3, 3,  3,  -5,   5,
      5,  -5,  3, 3, 3,  3,  -5,   5,
     20,  -5, 15, 3, 3, 15,  -5,  20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120
  ];

  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z" fill="currentColor" stroke="none"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 1.8V14"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.5 1 2.4V17h6v-.6c0-.9.4-1.8 1-2.4A7 7 0 0 0 12 2z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a6.5 6.5 0 1 1 0 13H11"/></svg>'
  };

  const RAYS = buildRays();

  const root = document.getElementById("ot-root");
  if (!root) return;

  /** @type {any} */
  let game = null;
  let view = "splash";
  let difficulty = DIFFS.includes(localStorage.getItem(DIFF_KEY) || "") ? localStorage.getItem(DIFF_KEY) : "medium";
  let humanColor = localStorage.getItem(COLOR_KEY) === "white" ? WHITE : BLACK;
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let overlay = null;
  let toastTimer = null;
  let aiTimer = null;
  let animTimer = null;
  let thinking = false;
  let animating = false;
  let audioCtx = null;
  let stats = loadStats();

  function buildRays() {
    return Array.from({ length: 64 }, (_, i) => {
      const col = i % 8;
      const row = (i / 8) | 0;
      const rays = [];
      for (const [dc, dr] of DIRS) {
        const ray = [];
        let c = col + dc;
        let r = row + dr;
        while (c >= 0 && c < 8 && r >= 0 && r < 8) {
          ray.push(c + r * 8);
          c += dc;
          r += dr;
        }
        if (ray.length) rays.push(ray);
      }
      return rays;
    });
  }

  function opp(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  function colorName(color) {
    return color === BLACK ? "Black" : "White";
  }

  function alg(i) {
    return FILES[i % 8] + (8 - ((i / 8) | 0));
  }

  function freshBoard() {
    const board = new Uint8Array(64);
    board[27] = BLACK;
    board[28] = WHITE;
    board[35] = WHITE;
    board[36] = BLACK;
    return board;
  }

  function count(board, color) {
    let n = 0;
    for (let i = 0; i < 64; i++) if (board[i] === color) n++;
    return n;
  }

  function flipsAt(board, idx, color) {
    if (board[idx]) return [];
    const enemy = opp(color);
    const out = [];
    for (const ray of RAYS[idx]) {
      let k = 0;
      while (k < ray.length && board[ray[k]] === enemy) k++;
      if (k > 0 && k < ray.length && board[ray[k]] === color) {
        for (let j = 0; j < k; j++) out.push(ray[j]);
      }
    }
    return out;
  }

  function legalMoves(board, color) {
    const moves = [];
    for (let i = 0; i < 64; i++) {
      if (flipsAt(board, i, color).length) moves.push(i);
    }
    return moves;
  }

  function applyMove(board, idx, color) {
    const next = board.slice();
    const flips = flipsAt(board, idx, color);
    if (!flips.length) return null;
    next[idx] = color;
    for (const f of flips) next[f] = color;
    return { board: next, flips };
  }

  function empties(board) {
    let n = 0;
    for (let i = 0; i < 64; i++) if (!board[i]) n++;
    return n;
  }

  function evaluate(board, color) {
    const enemy = opp(color);
    let mine = 0;
    let theirs = 0;
    let pos = 0;
    for (let i = 0; i < 64; i++) {
      if (board[i] === color) {
        mine++;
        pos += WEIGHTS[i];
      } else if (board[i] === enemy) {
        theirs++;
        pos -= WEIGHTS[i];
      }
    }
    const left = 64 - mine - theirs;
    if (left === 0 || (!legalMoves(board, color).length && !legalMoves(board, enemy).length)) {
      if (mine > theirs) return 100000 + (mine - theirs);
      if (mine < theirs) return -100000 - (theirs - mine);
      return 0;
    }
    const mob = legalMoves(board, color).length - legalMoves(board, enemy).length;
    if (left > 20) return pos * 2 + mob * 14 + (mine - theirs);
    if (left > 12) return pos + mob * 18 + (mine - theirs) * 6;
    return (mine - theirs) * 22 + mob * 10 + pos * 0.4;
  }

  function orderMoves(board, color, moves) {
    return moves
      .map((idx) => ({ idx, w: WEIGHTS[idx] * 8 + flipsAt(board, idx, color).length }))
      .sort((a, b) => b.w - a.w)
      .map((m) => m.idx);
  }

  function search(board, color, depth, alpha, beta, rootColor, deadline, statsBox) {
    statsBox.nodes++;
    if (deadline && performance.now() > deadline && depth > 0) {
      return { score: evaluate(board, rootColor), move: -1 };
    }
    const maximizing = color === rootColor;
    let moves = legalMoves(board, color);
    if (!moves.length) {
      const replies = legalMoves(board, opp(color));
      if (!replies.length) {
        const mine = count(board, rootColor);
        const theirs = count(board, opp(rootColor));
        const score = mine === theirs ? 0 : (mine > theirs ? 100000 + (mine - theirs) : -100000 - (theirs - mine));
        return { score, move: -1 };
      }
      if (depth <= 0) return { score: evaluate(board, rootColor), move: -1 };
      return search(board, opp(color), depth - 1, alpha, beta, rootColor, deadline, statsBox);
    }
    if (depth <= 0) return { score: evaluate(board, rootColor), move: -1 };

    moves = orderMoves(board, color, moves);
    let bestMove = moves[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const idx of moves) {
      const next = applyMove(board, idx, color);
      if (!next) continue;
      const child = search(next.board, opp(color), depth - 1, alpha, beta, rootColor, deadline, statsBox);
      if (maximizing) {
        if (child.score > bestScore) {
          bestScore = child.score;
          bestMove = idx;
        }
        if (bestScore > alpha) alpha = bestScore;
      } else {
        if (child.score < bestScore) {
          bestScore = child.score;
          bestMove = idx;
        }
        if (bestScore < beta) beta = bestScore;
      }
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  function pickAiMove(board, color, diff) {
    const moves = legalMoves(board, color);
    if (!moves.length) return -1;
    const cfg = DIFF_SEARCH[diff] || DIFF_SEARCH.medium;
    const ranked = orderMoves(board, color, moves);

    if (cfg.weak) {
      if (Math.random() < 0.72) {
        const weak = ranked.slice(Math.max(0, ranked.length - Math.ceil(ranked.length / 2)));
        return weak[(Math.random() * weak.length) | 0];
      }
      return ranked[(Math.random() * Math.min(3, ranked.length)) | 0];
    }

    const left = empties(board);
    let depth = cfg.depth;
    if (cfg.endgame && left <= cfg.endgame) depth = left + 1;

    const deadline = cfg.budget ? performance.now() + cfg.budget : 0;
    const statsBox = { nodes: 0 };
    let chosen = ranked[0];

    if (cfg.budget && depth > 3) {
      for (let d = 2; d <= depth; d++) {
        if (performance.now() > deadline) break;
        const res = search(board, color, d, -Infinity, Infinity, color, deadline, statsBox);
        if (res.move >= 0) chosen = res.move;
      }
    } else {
      const res = search(board, color, depth, -Infinity, Infinity, color, 0, statsBox);
      if (res.move >= 0) chosen = res.move;
    }

    if (cfg.noise && Math.random() < cfg.noise && ranked.length > 1) {
      const alt = ranked[1 + ((Math.random() * Math.min(2, ranked.length - 1)) | 0)];
      return alt;
    }
    return chosen;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestStreak: 0
    };
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function persistProgress() {
    if (!game || game.over) {
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      board: Array.from(game.board),
      turn: game.turn,
      human: game.human,
      difficulty: game.difficulty,
      lastMove: game.lastMove,
      history: game.history
    }));
  }

  function hasProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return p && Array.isArray(p.board) && p.board.length === 64 && !p.over;
    } catch {
      return false;
    }
  }

  function resumeProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw);
      game = {
        board: Uint8Array.from(p.board),
        turn: p.turn === WHITE ? WHITE : BLACK,
        human: p.human === WHITE ? WHITE : BLACK,
        difficulty: DIFFS.includes(p.difficulty) ? p.difficulty : difficulty,
        lastMove: Number.isInteger(p.lastMove) ? p.lastMove : -1,
        history: Array.isArray(p.history) ? p.history : [],
        over: false,
        fx: null,
        hint: -1
      };
      difficulty = game.difficulty;
      humanColor = game.human;
      view = "play";
      render();
      scheduleTurn(true);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = "sine", gain = 0.05) {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch { /* ignore */ }
  }

  function playPlace() {
    tone(420, 0.07, "triangle", 0.04);
  }

  function playWin() {
    tone(523, 0.12);
    setTimeout(() => tone(659, 0.12), 90);
    setTimeout(() => tone(784, 0.2), 180);
  }

  function playLose() {
    tone(330, 0.14, "sine", 0.05);
    setTimeout(() => tone(247, 0.22, "triangle", 0.05), 120);
  }

  function toast(msg) {
    const el = root.querySelector(".ot-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function headerHtml(subtitle) {
    return `
      <header class="ot-header">
        <div class="ot-brand">
          <div class="ot-mark" aria-hidden="true"><i></i><i></i></div>
          <div class="ot-brand-text">
            <h1>Othello</h1>
            <p>${subtitle}</p>
          </div>
        </div>
        <div class="ot-header-actions">
          <button class="ot-icon-btn" id="ot-help" title="How to play" aria-label="How to play">${ICONS.help}</button>
          <button class="ot-icon-btn" id="ot-mute" title="Toggle sound" aria-label="Toggle sound">${muted ? ICONS.mute : ICONS.sound}</button>
        </div>
      </header>
    `;
  }

  function bindChrome() {
    root.querySelector("#ot-help")?.addEventListener("click", showHelp);
    root.querySelector("#ot-mute")?.addEventListener("click", () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      const btn = root.querySelector("#ot-mute");
      if (btn) btn.innerHTML = muted ? ICONS.mute : ICONS.sound;
      if (!muted) tone(440, 0.08);
    });
  }

  function render() {
    stopAi();
    if (view === "splash") renderSplash();
    else renderPlay();
  }

  function renderSplash() {
    const record = `${stats.wins}–${stats.losses}${stats.draws ? `–${stats.draws}` : ""}`;
    root.innerHTML = `
      <div class="ot-app">
        ${headerHtml("Black and white stones. Outflank the machine.")}
        <div class="ot-view">
          <div class="ot-splash">
            <div class="ot-hero">
              <h2>Sandwich. Flip. Take the corners.</h2>
              <p>Place a stone so it traps the computer’s stones in a straight line — they flip to your color. Most stones at the end wins.</p>
            </div>
            <div class="ot-stats-row">
              <div class="ot-stat"><b>${stats.played}</b><span>Played</span></div>
              <div class="ot-stat"><b>${stats.wins}</b><span>Won</span></div>
              <div class="ot-stat"><b>${stats.losses}</b><span>Lost</span></div>
              <div class="ot-stat"><b>${stats.bestStreak}</b><span>Best streak</span></div>
            </div>
            <div class="ot-play-grid">
              ${hasProgress() ? `
              <button class="ot-play-card primary" data-mode="resume">
                <span class="ot-play-icon">${ICONS.play}</span>
                <span>
                  <strong>Continue game</strong>
                  <span>Pick up the board on this device.</span>
                </span>
              </button>` : ""}
              <button class="ot-play-card ${hasProgress() ? "" : "primary"}" data-mode="new">
                <span class="ot-play-icon">${ICONS.play}</span>
                <span>
                  <strong>Challenge the computer</strong>
                  <span>You play ${colorName(humanColor)} · ${DIFF_LABEL[difficulty]}${stats.played ? ` · record ${record}` : ""}.</span>
                </span>
              </button>
            </div>
            <div class="ot-diff">
              <div class="ot-diff-label">You play</div>
              <div class="ot-seg two" role="group" aria-label="Your color">
                <button data-color="black" class="${humanColor === BLACK ? "active" : ""}">
                  <span class="ot-color-dot black"></span>Black<small>You move first.</small>
                </button>
                <button data-color="white" class="${humanColor === WHITE ? "active" : ""}">
                  <span class="ot-color-dot white"></span>White<small>Computer opens.</small>
                </button>
              </div>
            </div>
            <div class="ot-diff">
              <div class="ot-diff-label">Computer</div>
              <div class="ot-seg four" role="group" aria-label="Difficulty">
                ${DIFFS.map((d) => `
                  <button data-diff="${d}" class="${difficulty === d ? "active" : ""}">
                    ${DIFF_LABEL[d]}<small>${DIFF_BLURB[d]}</small>
                  </button>
                `).join("")}
              </div>
            </div>
            <button class="ot-how" id="ot-how">How to play</button>
          </div>
        </div>
        <div class="ot-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#ot-how")?.addEventListener("click", showHelp);
    root.querySelectorAll("[data-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        humanColor = btn.getAttribute("data-color") === "white" ? WHITE : BLACK;
        localStorage.setItem(COLOR_KEY, humanColor === WHITE ? "white" : "black");
        renderSplash();
      });
    });
    root.querySelectorAll("[data-diff]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-diff");
        if (!DIFFS.includes(next)) return;
        difficulty = next;
        localStorage.setItem(DIFF_KEY, difficulty);
        renderSplash();
      });
    });
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode === "resume") {
          if (!resumeProgress()) toast("No saved game found.");
        } else {
          beginGame();
        }
      });
    });
  }

  function beginGame() {
    overlay?.remove();
    overlay = null;
    game = {
      board: freshBoard(),
      turn: BLACK,
      human: humanColor,
      difficulty,
      lastMove: -1,
      history: [],
      over: false,
      fx: null,
      hint: -1
    };
    view = "play";
    thinking = false;
    animating = false;
    persistProgress();
    renderPlay();
    scheduleTurn(true);
  }

  function snapshot() {
    return {
      board: Array.from(game.board),
      turn: game.turn,
      lastMove: game.lastMove
    };
  }

  function restore(snap) {
    game.board = Uint8Array.from(snap.board);
    game.turn = snap.turn;
    game.lastMove = snap.lastMove;
    game.over = false;
    game.fx = null;
    game.hint = -1;
  }

  function canInput() {
    return game && !game.over && game.turn === game.human && !thinking && !animating;
  }

  function statusText() {
    if (!game) return "";
    if (game.over) return "Game over";
    if (thinking) return `${DIFF_LABEL[game.difficulty]} is thinking…`;
    if (game.turn === game.human) return `Your turn — ${colorName(game.human)}`;
    return "Computer to move";
  }

  function renderPlay() {
    if (!game) return;
    const blackN = count(game.board, BLACK);
    const whiteN = count(game.board, WHITE);
    const legal = canInput() ? legalMoves(game.board, game.human) : [];
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const piece = game.board[i];
      const isLegal = legal.includes(i);
      const isHint = game.hint === i;
      const isLast = game.lastMove === i;
      const classes = ["ot-sq"];
      if (piece) classes.push("filled");
      if (isLegal) classes.push("legal");
      if (isHint) classes.push("hint");
      if (isLast) classes.push("last");
      let stone = "";
      if (piece) {
        const fx = game.fx;
        const stoneClass = [
          "ot-stone",
          piece === BLACK ? "black" : "white",
          fx && fx.placed === i ? "placed" : "",
          fx && fx.flips.includes(i) ? "flipping" : ""
        ].filter(Boolean).join(" ");
        const delay = fx && fx.flips.includes(i) ? `style="animation-delay:${Math.max(0, fx.flips.indexOf(i)) * 42}ms"` : "";
        stone = `<span class="${stoneClass}" ${delay}></span>`;
      }
      cells.push(
        `<button type="button" class="${classes.join(" ")}" data-i="${i}" aria-label="${alg(i)}${piece ? `, ${colorName(piece)}` : isLegal ? ", legal" : ""}">${stone}</button>`
      );
    }
    root.innerHTML = `
      <div class="ot-app">
        ${headerHtml(`${DIFF_LABEL[game.difficulty]} · you are ${colorName(game.human).toLowerCase()}`)}
        <div class="ot-view">
          <div class="ot-play-layout">
            <div class="ot-hud">
              <div class="ot-hud-item black ${game.turn === BLACK && !game.over ? "to-move" : ""}">
                <span class="lbl">Black${game.human === BLACK ? " · you" : ""}</span>
                <span class="val">${blackN}</span>
              </div>
              <div class="ot-hud-item white ${game.turn === WHITE && !game.over ? "to-move" : ""}">
                <span class="lbl">White${game.human === WHITE ? " · you" : ""}</span>
                <span class="val">${whiteN}</span>
              </div>
              <div class="ot-toolbar">
                <button class="ot-btn" id="ot-hint" ${canInput() ? "" : "disabled"}>${ICONS.hint} Hint</button>
                <button class="ot-btn" id="ot-undo" ${game.history.length && !thinking && !animating ? "" : "disabled"}>${ICONS.undo} Undo</button>
                <button class="ot-btn ghost" id="ot-menu">Menu</button>
              </div>
            </div>
            <div class="ot-table">
              <div class="ot-board-frame">
                <div class="ot-ranks" aria-hidden="true">${[8, 7, 6, 5, 4, 3, 2, 1].map((n) => `<span>${n}</span>`).join("")}</div>
                <div class="ot-felt" id="ot-board">${cells.join("")}</div>
              </div>
              <div class="ot-files" aria-hidden="true"><span></span>${[...FILES].map((ch) => `<span>${ch}</span>`).join("")}</div>
              <div class="ot-status ${thinking ? "thinking" : ""}">${statusText()}</div>
            </div>
          </div>
        </div>
        <div class="ot-toast"></div>
      </div>
    `;
    bindChrome();
    root.querySelector("#ot-menu")?.addEventListener("click", quitToMenu);
    root.querySelector("#ot-hint")?.addEventListener("click", showHint);
    root.querySelector("#ot-undo")?.addEventListener("click", undo);
    root.querySelectorAll(".ot-sq").forEach((el) => {
      el.addEventListener("click", () => onSquare(Number(el.getAttribute("data-i"))));
    });
  }

  function onSquare(i) {
    if (!canInput()) return;
    const flips = flipsAt(game.board, i, game.human);
    if (!flips.length) {
      toast("Not a legal sandwich.");
      return;
    }
    commitMove(i);
  }

  function commitMove(idx) {
    const color = game.turn;
    const next = applyMove(game.board, idx, color);
    if (!next) return;
    game.history.push(snapshot());
    game.board = next.board;
    game.lastMove = idx;
    game.hint = -1;
    game.fx = { placed: idx, flips: next.flips };
    playPlace();
    renderPlay();
    animating = true;
    clearTimeout(animTimer);
    const wait = 90 + next.flips.length * 42;
    animTimer = setTimeout(() => {
      game.fx = null;
      animating = false;
      afterMove();
    }, wait);
  }

  function afterMove() {
    if (!game || game.over) return;
    const nextColor = opp(game.turn);
    const nextMoves = legalMoves(game.board, nextColor);
    const againMoves = legalMoves(game.board, game.turn);
    if (!nextMoves.length && !againMoves.length) {
      endGame();
      return;
    }
    if (!nextMoves.length) {
      toast(`${nextColor === game.human ? "You" : "Computer"} pass${nextColor === game.human ? "" : "es"}.`);
      persistProgress();
      renderPlay();
      scheduleTurn(false);
      return;
    }
    game.turn = nextColor;
    persistProgress();
    renderPlay();
    scheduleTurn(false);
  }

  function scheduleTurn(immediate) {
    if (!game || game.over) return;
    if (game.turn === game.human) return;
    const moves = legalMoves(game.board, game.turn);
    if (!moves.length) {
      afterMove();
      return;
    }
    thinking = true;
    renderPlay();
    const pause = immediate ? DIFF_THINK[game.difficulty] : DIFF_THINK[game.difficulty];
    stopAi();
    aiTimer = setTimeout(() => {
      const move = pickAiMove(game.board, game.turn, game.difficulty);
      thinking = false;
      if (move < 0) {
        afterMove();
        return;
      }
      commitMove(move);
    }, pause);
  }

  function stopAi() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    thinking = false;
  }

  function showHint() {
    if (!canInput()) return;
    const move = pickAiMove(game.board, game.human, "hard");
    if (move < 0) {
      toast("No legal move.");
      return;
    }
    game.hint = move;
    tone(660, 0.08, "sine", 0.04);
    renderPlay();
    toast(`Try ${alg(move).toUpperCase()}.`);
  }

  function undo() {
    if (!game || thinking || animating || !game.history.length) return;
    overlay?.remove();
    overlay = null;
    stopAi();
    if (game.turn === game.human || game.over) {
      restore(game.history.pop());
    }
    if (game.history.length && game.turn !== game.human) {
      restore(game.history.pop());
    }
    game.over = false;
    persistProgress();
    renderPlay();
    if (game.turn !== game.human) scheduleTurn(true);
  }

  function endGame() {
    game.over = true;
    game.fx = null;
    thinking = false;
    animating = false;
    persistProgress();
    localStorage.removeItem(PROGRESS_KEY);
    const blackN = count(game.board, BLACK);
    const whiteN = count(game.board, WHITE);
    const mine = count(game.board, game.human);
    const theirs = count(game.board, opp(game.human));
    let result = "draw";
    if (mine > theirs) result = "win";
    else if (mine < theirs) result = "loss";
    stats.played += 1;
    if (result === "win") {
      stats.wins += 1;
      stats.streak += 1;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      playWin();
    } else if (result === "loss") {
      stats.losses += 1;
      stats.streak = 0;
      playLose();
    } else {
      stats.draws += 1;
      stats.streak = 0;
    }
    saveStats();
    renderPlay();
    const title = result === "win" ? "You win" : result === "loss" ? "Computer wins" : "Draw";
    const copy = result === "win"
      ? "You closed with more stones."
      : result === "loss"
        ? "The machine took the board."
        : "Same stone count. Split the difference.";
    showOver(title, copy, blackN, whiteN);
  }

  function showOver(title, copy, blackN, whiteN) {
    const app = root.querySelector(".ot-app");
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "ot-overlay";
    overlay.innerHTML = `
      <div class="ot-modal">
        <h2>${title}</h2>
        <p>${copy}</p>
        <div class="ot-win-stats">
          <div><b>${blackN}</b><span>Black</span></div>
          <div><b>${whiteN}</b><span>White</span></div>
          <div><b>${DIFF_LABEL[game.difficulty]}</b><span>Computer</span></div>
        </div>
        <div class="ot-modal-actions">
          <button class="ot-btn gold" id="ot-again">Play again</button>
          <button class="ot-btn ghost" id="ot-over-menu">Menu</button>
        </div>
      </div>
    `;
    app.appendChild(overlay);
    overlay.querySelector("#ot-again")?.addEventListener("click", beginGame);
    overlay.querySelector("#ot-over-menu")?.addEventListener("click", quitToMenu);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function quitToMenu() {
    stopAi();
    clearTimeout(animTimer);
    overlay?.remove();
    overlay = null;
    if (game && !game.over) persistProgress();
    view = "splash";
    game = null;
    render();
  }

  function showHelp() {
    const app = root.querySelector(".ot-app");
    const wrap = document.createElement("div");
    wrap.className = "ot-overlay";
    wrap.innerHTML = `
      <div class="ot-modal">
        <h2>How to play</h2>
        <ol>
          <li>Black starts. Each new stone must sandwich at least one opponent stone in a straight line — row, column, or diagonal.</li>
          <li>Every trapped stone flips to your color. Dots on the board mark your legal squares.</li>
          <li>If a player cannot move, they pass. When neither can move, the game ends. Most stones wins.</li>
          <li>Corners are gold. The X-squares next to empty corners are traps. Nightmare looks far ahead and solves the endgame.</li>
        </ol>
        <div class="ot-modal-actions">
          <button class="ot-btn gold" id="ot-help-close">Got it</button>
        </div>
      </div>
    `;
    app.appendChild(wrap);
    wrap.querySelector("#ot-help-close")?.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  }

  render();
})();
