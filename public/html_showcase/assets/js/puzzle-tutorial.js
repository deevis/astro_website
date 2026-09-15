(() => {
  const seenKey = (id) => `puzzle-tutorial-seen-${id}`;

  /** @type {any} */
  let state = null;
  /** @type {HTMLElement | null} */
  let rootEl = null;
  let moving = false;

  function seen(gameId) {
    try {
      return localStorage.getItem(seenKey(gameId)) === "1";
    } catch {
      return false;
    }
  }

  function markSeen(gameId) {
    try {
      localStorage.setItem(seenKey(gameId), "1");
    } catch { /* ignore */ }
  }

  function isActive() {
    return !!state;
  }

  function collectEls(selector, host) {
    if (!selector) return [];
    const scope = host && host.isConnected ? host : document;
    let found = selector;
    if (typeof selector === "function") found = selector(scope);
    if (!found) return [];
    if (found.nodeType) return [found];
    if (typeof found === "string") return [...scope.querySelectorAll(found)];
    if (Array.isArray(found) || typeof found.length === "number") {
      return [...found].filter((el) => el && el.nodeType === 1);
    }
    return [];
  }

  function resolveTargets(selector, host) {
    return collectEls(selector, host).filter((el) => el && el.isConnected);
  }

  function clearMarks() {
    document.querySelectorAll(".pt-lit").forEach((el) => el.classList.remove("pt-lit"));
    document.querySelectorAll(".pt-dim").forEach((el) => el.classList.remove("pt-dim"));
  }

  function dimOthers(node, keep) {
    for (const child of node.children) {
      if (keep.has(child)) dimOthers(child, keep);
      else child.classList.add("pt-dim");
    }
  }

  function markTargets(targets) {
    const host = hostEl();
    if (!host) return;
    const keep = new Set();
    for (const el of targets) {
      el.classList.add("pt-lit");
      keep.add(el);
      let n = el.parentElement;
      while (n && n !== host.parentElement) {
        keep.add(n);
        n = n.parentElement;
      }
    }
    dimOthers(host, keep);
  }

  function mount() {
    if (rootEl) return;
    rootEl = document.createElement("div");
    rootEl.className = "pt-root";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.innerHTML = `
      <div class="pt-card center">
        <div class="pt-kicker"></div>
        <h3></h3>
        <p></p>
        <div class="pt-actions">
          <button type="button" class="pt-btn ghost" data-act="skip">Skip</button>
          <button type="button" class="pt-btn gold" data-act="next">Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(rootEl);
    rootEl.querySelector('[data-act="skip"]')?.addEventListener("click", () => stop("skip"));
    rootEl.querySelector('[data-act="next"]')?.addEventListener("click", () => next());
    document.addEventListener("keydown", onKey, true);
    bindViewport(true);
  }

  function unmount() {
    bindViewport(false);
    document.removeEventListener("keydown", onKey, true);
    if (state?.host) state.host.removeEventListener("click", onHostClick, true);
    clearMarks();
    rootEl?.remove();
    rootEl = null;
  }

  function onKey(e) {
    if (!state) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stop("skip");
    } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      e.preventDefault();
      next();
    }
  }

  function onHostClick(e) {
    if (!state) return;
    const step = state.steps[state.index];
    if (!step || step.advanceOn !== "target") return;
    const targets = resolveTargets(step.selector, hostEl());
    const node = e.target instanceof Node ? e.target : null;
    if (!node || !targets.some((el) => el.contains(node))) return;
    window.setTimeout(() => {
      if (state && state.steps[state.index] === step) next();
    }, 40);
  }

  const GAP = 14;
  const MARGIN = 12;

  function unionRect(els) {
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const el of els) {
      const box = el.getBoundingClientRect();
      if (box.width <= 0 && box.height <= 0) continue;
      top = Math.min(top, box.top);
      left = Math.min(left, box.left);
      right = Math.max(right, box.right);
      bottom = Math.max(bottom, box.bottom);
    }
    if (!Number.isFinite(top)) return null;
    return { top, left, right, bottom, width: right - left, height: bottom - top };
  }

  function clipRect() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const host = hostEl()?.getBoundingClientRect();
    const top = Math.max(MARGIN, host ? host.top : MARGIN);
    const left = Math.max(MARGIN, host ? host.left : MARGIN);
    const right = Math.min(vw - MARGIN, host ? host.right : vw - MARGIN);
    const bottom = Math.min(vh - MARGIN, host ? host.bottom : vh - MARGIN);
    if (right - left < 180 || bottom - top < 100) {
      return { top: MARGIN, left: MARGIN, right: vw - MARGIN, bottom: vh - MARGIN };
    }
    return { top, left, right, bottom };
  }

  function resetCardPos(card) {
    card.style.top = "";
    card.style.left = "";
    card.style.right = "";
    card.style.bottom = "";
    card.style.transform = "";
    card.classList.remove("anchored");
  }

  function placeCard(center, targets) {
    const card = rootEl?.querySelector(".pt-card");
    if (!card) return;
    resetCardPos(card);
    card.classList.toggle("center", !!center);
    if (center || !targets?.length) return;

    const rect = unionRect(targets);
    if (!rect) {
      card.classList.add("center");
      return;
    }

    card.classList.remove("center");
    card.classList.add("anchored");
    const clip = clipRect();
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const below = clip.bottom - rect.bottom - GAP;
    const above = rect.top - clip.top - GAP;
    let top = below >= Math.min(ch, 96) || below >= above
      ? rect.bottom + GAP
      : rect.top - GAP - ch;
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.min(Math.max(left, clip.left), Math.max(clip.left, clip.right - cw));
    top = Math.min(Math.max(top, clip.top), Math.max(clip.top, clip.bottom - ch));
    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
  }

  function onViewport() {
    if (!state || moving || !rootEl) return;
    const step = state.steps[state.index];
    if (!step?.selector || step.placement === "center") return;
    const targets = resolveTargets(step.selector, hostEl());
    if (targets.length) placeCard(false, targets);
  }

  function bindViewport(on) {
    const fn = on ? "addEventListener" : "removeEventListener";
    window[fn]("resize", onViewport);
    window[fn]("scroll", onViewport, true);
  }

  function fillCard(step) {
    const total = state.steps.length;
    const n = state.index + 1;
    const last = n === total;
    rootEl.querySelector(".pt-kicker").textContent = `Tutorial · ${n} / ${total}`;
    rootEl.querySelector("h3").textContent = step.title || "";
    rootEl.querySelector("p").textContent = step.body || "";
    const skip = rootEl.querySelector('[data-act="skip"]');
    const nextBtn = rootEl.querySelector('[data-act="next"]');
    skip.textContent = step.skipLabel || (last ? "Menu" : "Skip");
    nextBtn.textContent = step.nextLabel || (last ? "Got it" : "Next");
  }

  function paint() {
    if (!state || !rootEl) return;
    const step = state.steps[state.index];
    if (!step) return;
    fillCard(step);
    clearMarks();
    if (!step.selector || step.placement === "center") {
      placeCard(true);
      return;
    }
    const targets = resolveTargets(step.selector, hostEl());
    if (!targets.length) {
      placeCard(true);
      return;
    }
    markTargets(targets);
    targets[0].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    placeCard(false, targets);
  }

  function refresh() {
    if (!state || moving) return;
    paint();
  }

  async function go(index) {
    if (!state) return;
    if (index >= state.steps.length) {
      stop("finished");
      return;
    }
    if (index < 0) index = 0;
    moving = true;
    const prev = state.steps[state.index];
    try {
      if (prev && prev !== state.steps[index] && typeof prev.onLeave === "function") {
        await prev.onLeave();
      }
    } catch { /* ignore */ }
    state.index = index;
    const step = state.steps[index];
    try {
      if (typeof step.onEnter === "function") await step.onEnter();
    } catch { /* ignore */ }
    moving = false;
    if (!state) return;
    hostEl();
    const kick = () => {
      if (state) paint();
    };
    window.requestAnimationFrame(() => {
      kick();
      window.requestAnimationFrame(kick);
    });
  }

  function next() {
    if (!state) return;
    go(state.index + 1);
  }

  function start(config) {
    if (!config?.host || !Array.isArray(config.steps) || !config.steps.length) return;
    stop("restart");
    if (config.gameId) markSeen(config.gameId);
    state = {
      host: config.host,
      getHost: config.getHost,
      gameId: config.gameId || "",
      steps: config.steps,
      index: 0,
      onDone: config.onDone
    };
    mount();
    hostEl().addEventListener("click", onHostClick, true);
    go(0);
  }

  function hostEl() {
    if (!state) return null;
    if (typeof state.getHost === "function") {
      const next = state.getHost() || state.host;
      if (next && next !== state.host) {
        state.host?.removeEventListener("click", onHostClick, true);
        state.host = next;
        state.host.addEventListener("click", onHostClick, true);
      }
    }
    return state.host;
  }

  function stop(reason = "stop") {
    if (!state) {
      clearMarks();
      unmount();
      return;
    }
    const done = state.onDone;
    const prev = state.steps[state.index];
    try {
      if (typeof prev?.onLeave === "function") prev.onLeave();
    } catch { /* ignore */ }
    state.host.removeEventListener("click", onHostClick, true);
    clearMarks();
    state = null;
    unmount();
    if (reason !== "restart" && typeof done === "function") done(reason);
  }

  window.PuzzleTutorial = {
    seen,
    markSeen,
    isActive,
    start,
    next,
    refresh,
    stop
  };
})();
