import {
  clonePack,
  findShippedPack,
  officialPacks,
  templatePacks,
  UNRANKED_TIER,
  standardTiers,
  type DetailField,
  type TierDef,
  type TierItem,
  type TierPack,
} from '../data/tier-list';

const STORE_KEY = 'tier-list:v1';

interface RankingEntry {
  tier: string;
  order: number;
}

interface Store {
  version: 1;
  lastPackId?: string;
  rankings: Record<string, Record<string, RankingEntry>>;
  userPacks: TierPack[];
  furnaceSettings: { gasPrice: string; annualBTU: string };
}

interface WorkingState {
  pack: TierPack;
  selectedId: string | null;
  view: 'rank' | 'manage';
}

const state: WorkingState = {
  pack: officialPacks[0],
  selectedId: null,
  view: 'rank',
};

function emptyStore(): Store {
  return {
    version: 1,
    rankings: {},
    userPacks: [],
    furnaceSettings: { gasPrice: '1.40', annualBTU: '70000000' },
  };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    if (parsed?.version !== 1 || !Array.isArray(parsed.userPacks)) return emptyStore();
    return {
      ...emptyStore(),
      ...parsed,
      rankings: parsed.rankings ?? {},
      userPacks: parsed.userPacks,
      furnaceSettings: {
        gasPrice: parsed.furnaceSettings?.gasPrice ?? '1.40',
        annualBTU: parsed.furnaceSettings?.annualBTU ?? '70000000',
      },
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(mutator: (store: Store) => void) {
  const store = loadStore();
  mutator(store);
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'data:';
  } catch {
    return false;
  }
}

function cloneIdForSource(sourceId: string) {
  return `user:${sourceId}`;
}

function newUserId() {
  return `user:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function isEditable(pack: TierPack) {
  return pack.kind === 'user' || pack.kind === 'template';
}

function pickerIdFor(pack: TierPack) {
  if (pack.kind === 'user' && pack.sourceId && templatePacks.some((t) => t.id === pack.sourceId)) {
    return pack.sourceId;
  }
  return pack.id;
}

function ensureTemplateClone(template: TierPack): TierPack {
  const store = loadStore();
  const existing = store.userPacks.find((pack) => pack.sourceId === template.id);
  if (existing) return clonePack(existing);
  const created = clonePack(template, {
    id: cloneIdForSource(template.id),
    kind: 'user',
    sourceId: template.id,
    updatedAt: new Date().toISOString(),
  });
  saveStore((s) => {
    s.userPacks.push(created);
  });
  return clonePack(created);
}

function resolvePack(requestedId: string | null): TierPack {
  const store = loadStore();
  const id = requestedId || store.lastPackId || 'furnaces';

  const template = templatePacks.find((pack) => pack.id === id);
  if (template) return ensureTemplateClone(template);

  const user = store.userPacks.find((pack) => pack.id === id);
  if (user) return clonePack(user);

  const shipped = findShippedPack(id);
  if (shipped) return clonePack(shipped);

  return clonePack(officialPacks[0]);
}

function rankingKey(pack: TierPack) {
  return pack.id;
}

function applySavedRanking(pack: TierPack) {
  const ranking = loadStore().rankings[rankingKey(pack)];
  if (!ranking) return;
  const validTiers = new Set([...pack.tiers.map((t) => t.id), UNRANKED_TIER]);
  pack.items.forEach((item) => {
    const saved = ranking[item.id];
    if (saved && validTiers.has(saved.tier)) item.defaultTier = saved.tier;
  });
  pack.items.sort((a, b) => {
    const oa = ranking[a.id]?.order ?? 0;
    const ob = ranking[b.id]?.order ?? 0;
    return oa - ob;
  });
}

function persistRankingFromDom() {
  const ranking: Record<string, RankingEntry> = {};
  const ordered: TierItem[] = [];
  document.querySelectorAll<HTMLElement>('[data-tier]').forEach((row) => {
    const tier = row.dataset.tier;
    if (!tier) return;
    row.querySelectorAll<HTMLElement>('.tl-card').forEach((card, order) => {
      const id = card.dataset.id;
      if (!id) return;
      ranking[id] = { tier, order };
      const item = state.pack.items.find((entry) => entry.id === id);
      if (item) {
        item.defaultTier = tier;
        ordered.push(item);
      }
    });
  });
  if (ordered.length) {
    const seen = new Set(ordered.map((item) => item.id));
    state.pack.items = [...ordered, ...state.pack.items.filter((item) => !seen.has(item.id))];
  }
  saveStore((store) => {
    store.rankings[rankingKey(state.pack)] = ranking;
    store.lastPackId = pickerIdFor(state.pack);
    const userIdx = store.userPacks.findIndex((pack) => pack.id === state.pack.id);
    if (userIdx >= 0) {
      store.userPacks[userIdx] = clonePack(state.pack, { updatedAt: new Date().toISOString() });
    }
  });
}

function persistRankingFromState() {
  const ranking: Record<string, RankingEntry> = {};
  const counts: Record<string, number> = {};
  for (const item of state.pack.items) {
    const tier = item.defaultTier || UNRANKED_TIER;
    const order = counts[tier] ?? 0;
    counts[tier] = order + 1;
    ranking[item.id] = { tier, order };
  }
  saveStore((store) => {
    store.rankings[rankingKey(state.pack)] = ranking;
    store.lastPackId = pickerIdFor(state.pack);
    const userIdx = store.userPacks.findIndex((pack) => pack.id === state.pack.id);
    if (userIdx >= 0) {
      store.userPacks[userIdx] = clonePack(state.pack, { updatedAt: new Date().toISOString() });
    }
  });
}

function commitPack() {
  persistUserPack();
  if (state.view === 'rank') persistRankingFromDom();
  else persistRankingFromState();
  renderChrome();
}

function isTemplateCopy(pack = state.pack) {
  return Boolean(pack.sourceId && templatePacks.some((entry) => entry.id === pack.sourceId));
}

function slugify(text: string, fallback: string) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function uniqueId(base: string, taken: string[]) {
  let id = base || 'item';
  let n = 2;
  while (taken.includes(id) || id === UNRANKED_TIER) {
    id = `${base}-${n++}`;
  }
  return id;
}

function moveIndex<T>(list: T[], index: number, delta: number) {
  const next = index + delta;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return copy;
}

function btn(label: string, className: string, onClick: () => void, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  if (!disabled) button.addEventListener('click', onClick);
  return button;
}

function persistUserPack() {
  if (state.pack.kind !== 'user') return;
  state.pack.updatedAt = new Date().toISOString();
  saveStore((store) => {
    const idx = store.userPacks.findIndex((pack) => pack.id === state.pack.id);
    const copy = clonePack(state.pack);
    if (idx >= 0) store.userPacks[idx] = copy;
    else store.userPacks.push(copy);
    store.lastPackId = pickerIdFor(state.pack);
  });
}

function setUrlPack(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('pack', id);
  history.replaceState({}, '', url);
}

function fillPackSelect() {
  const select = $('pack-select') as HTMLSelectElement;
  const store = loadStore();
  const currentPickerId = pickerIdFor(state.pack);
  select.innerHTML = '';

  const groups: { label: string; packs: { id: string; title: string }[] }[] = [
    { label: 'Official', packs: officialPacks.map((pack) => ({ id: pack.id, title: pack.title })) },
    { label: 'Templates', packs: templatePacks.map((pack) => ({ id: pack.id, title: pack.title })) },
  ];

  const custom = store.userPacks.filter(
    (pack) => !pack.sourceId || !templatePacks.some((t) => t.id === pack.sourceId)
  );
  if (custom.length) {
    groups.push({
      label: 'My lists',
      packs: custom.map((pack) => ({ id: pack.id, title: pack.title })),
    });
  }

  for (const group of groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const pack of group.packs) {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = pack.title;
      if (pack.id === currentPickerId) option.selected = true;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
}

function glyphFor(item: TierItem) {
  const glyph = document.createElement('div');
  glyph.className = 'tl-glyph';
  glyph.textContent = item.emoji || item.name.slice(0, 1);
  glyph.style.background = item.accent || '#334155';
  return glyph;
}

function thumbFor(item: TierItem) {
  if (item.image && isSafeUrl(item.image)) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = '';
    img.addEventListener('error', () => {
      img.replaceWith(glyphFor(item));
    });
    return img;
  }
  return glyphFor(item);
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  const ranked = state.pack.tiers.map((tier) => ({ ...tier }));
  const unranked = { id: UNRANKED_TIER, label: 'Unranked', emoji: '📦' };
  const unrankedHasItems = state.pack.items.some(
    (item) => (item.defaultTier || UNRANKED_TIER) === UNRANKED_TIER
  );
  const tiers = unrankedHasItems ? [unranked, ...ranked] : [...ranked, unranked];

  for (const tier of tiers) {
    const row = document.createElement('section');
    row.className = `tl-tier${tier.id === UNRANKED_TIER ? ' tl-tier-unranked' : ''}`;
    row.dataset.tier = tier.id;

    const heading = document.createElement('h2');
    if (tier.color) heading.style.color = tier.color;
    heading.textContent = `${tier.emoji ? `${tier.emoji} ` : ''}${tier.label}`;

    const content = document.createElement('div');
    content.className = 'tl-tier-content';
    bindDropTarget(content);

    const items = state.pack.items.filter((item) => (item.defaultTier || UNRANKED_TIER) === tier.id);
    for (const item of items) content.appendChild(cardFor(item));

    row.append(heading, content);
    board.appendChild(row);
  }
}

function cardFor(item: TierItem) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tl-card';
  el.draggable = true;
  el.dataset.id = item.id;
  if (state.selectedId === item.id) el.classList.add('is-selected');

  const name = document.createElement('span');
  name.textContent = item.name;
  el.append(thumbFor(item), name);

  el.addEventListener('click', () => {
    state.selectedId = item.id;
    renderBoard();
    renderDetails();
  });
  el.addEventListener('dragstart', () => el.classList.add('is-dragging'));
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    persistRankingFromDom();
  });
  return el;
}

function bindDropTarget(container: HTMLElement) {
  container.addEventListener('dragover', (event) => {
    event.preventDefault();
    const dragging = document.querySelector<HTMLElement>('.is-dragging');
    if (!dragging) return;
    const after = [...container.children].find((child) => {
      const rect = (child as HTMLElement).getBoundingClientRect();
      return event.clientY < rect.top + (child as HTMLElement).offsetHeight / 2;
    });
    container.insertBefore(dragging, after ?? null);
  });
}

function annualFuelCost(item: TierItem) {
  const afue = Number(item.meta?.afue);
  if (!Number.isFinite(afue) || afue <= 0) return null;
  const gas = Number(( $('gas-price') as HTMLInputElement).value);
  const btu = Number(( $('annual-btu') as HTMLInputElement).value);
  if (!Number.isFinite(gas) || !Number.isFinite(btu)) return null;
  return ((btu / (100000 * afue)) * gas).toFixed(0);
}

function renderDetails() {
  const item = state.pack.items.find((entry) => entry.id === state.selectedId) ?? null;
  const nameEl = $('selected-name');
  const hint = $('details-hint');
  const details = $('details');
  const actions = $('item-actions');
  details.innerHTML = '';
  actions.innerHTML = '';

  if (!item) {
    nameEl.textContent = '';
    hint.hidden = false;
    hint.textContent = 'Select an item to inspect details.';
    renderMoveControl(null);
    return;
  }

  hint.hidden = true;
  nameEl.textContent = item.name;

  const hero = document.createElement('div');
  hero.className = 'tl-hero';
  hero.appendChild(thumbFor(item));
  details.appendChild(hero);

  if (item.description) {
    const p = document.createElement('p');
    p.className = 'tl-desc';
    p.textContent = item.description;
    details.appendChild(p);
  }

  for (const field of state.pack.detailFields ?? []) {
    const value = item.meta?.[field.key];
    if (value == null || value === '') continue;
    const row = document.createElement('div');
    row.className = 'tl-stat';
    const label = document.createElement('strong');
    label.textContent = `${field.label}: `;
    row.append(label, document.createTextNode(String(value)));
    details.appendChild(row);
  }

  if (item.link && isSafeUrl(item.link) && !item.link.startsWith('data:')) {
    const a = document.createElement('a');
    a.className = 'tl-link';
    a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Open link';
    details.appendChild(a);
  }

  if (item.tags?.length) {
    const tags = document.createElement('div');
    tags.className = 'tl-tags';
    for (const tag of item.tags) {
      const chip = document.createElement('span');
      chip.textContent = tag;
      tags.appendChild(chip);
    }
    details.appendChild(tags);
  }

  if (state.pack.plugins?.includes('furnace-cost')) {
    const cost = annualFuelCost(item);
    if (cost) {
      const calc = document.createElement('div');
      calc.className = 'tl-calc';
      const label = document.createElement('strong');
      label.textContent = 'Annual fuel cost: ';
      calc.append(label, document.createTextNode(`~$${cost}`));
      details.appendChild(calc);
    }
  }

  renderMoveControl(item);

  if (isEditable(state.pack)) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'tl-btn';
    edit.textContent = 'Edit item';
    edit.addEventListener('click', () => openEditor(item));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tl-btn tl-btn-danger';
    del.textContent = 'Delete item';
    del.addEventListener('click', () => deleteItem(item.id));
    actions.append(edit, del);
  }
}

function renderMoveControl(item: TierItem | null) {
  const wrap = $('move-wrap');
  wrap.innerHTML = '';
  if (!item) return;
  const label = document.createElement('label');
  label.textContent = 'Move to';
  const select = document.createElement('select');
  select.id = 'move-tier';
  const options = [...state.pack.tiers, { id: UNRANKED_TIER, label: 'Unranked' }];
  for (const tier of options) {
    const option = document.createElement('option');
    option.value = tier.id;
    option.textContent = tier.label;
    if ((item.defaultTier || UNRANKED_TIER) === tier.id) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    item.defaultTier = select.value;
    renderBoard();
    persistRankingFromDom();
    persistUserPack();
    renderDetails();
  });
  wrap.append(label, select);
}

function setView(view: 'rank' | 'manage') {
  if (state.view === 'rank' && view === 'manage') persistRankingFromDom();
  if (state.view === 'manage' && view === 'rank') persistRankingFromState();
  state.view = view;
  $('rank-view').hidden = view !== 'rank';
  $('manage-view').hidden = view !== 'manage';
  $('view-rank').classList.toggle('is-active', view === 'rank');
  $('view-manage').classList.toggle('is-active', view === 'manage');
  $('view-rank').setAttribute('aria-selected', String(view === 'rank'));
  $('view-manage').setAttribute('aria-selected', String(view === 'manage'));
  if (view === 'rank') {
    renderBoard();
    renderDetails();
  } else {
    renderManage();
  }
}

function renderManage() {
  const root = $('manage-root');
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'tl-manage-grid';
  const editable = isEditable(state.pack);

  if (!editable) {
    const banner = document.createElement('div');
    banner.className = 'tl-banner';
    const text = document.createElement('p');
    text.textContent = 'This shipped list is read-only. Make a personal copy to change items, tiers, and fields.';
    banner.append(text, btn('Customize', 'tl-btn tl-btn-primary', () => forkCurrent()));
    grid.appendChild(banner);
  }

  grid.append(settingsPanel(editable), tiersPanel(editable), fieldsPanel(editable), itemsPanel(editable));
  if (editable) grid.appendChild(dangerPanel());
  root.appendChild(grid);
}

function settingsPanel(editable: boolean) {
  const panel = document.createElement('section');
  panel.className = 'tl-panel';
  const h2 = document.createElement('h2');
  h2.textContent = 'List settings';
  const form = document.createElement('div');
  form.className = 'tl-form-grid';

  const title = labeledInput('Title', 'manage-title', state.pack.title, editable, (value) => {
    state.pack.title = value || 'Untitled list';
    commitPack();
    $('pack-title').textContent = state.pack.title;
    fillPackSelect();
  });
  const subtitle = labeledInput('Subtitle', 'manage-subtitle', state.pack.subtitle, editable, (value) => {
    state.pack.subtitle = value;
    commitPack();
    $('pack-subtitle').textContent = state.pack.subtitle;
  });
  const prompt = labeledInput('Prompt', 'manage-prompt', state.pack.prompt ?? '', editable, (value) => {
    state.pack.prompt = value || undefined;
    commitPack();
    const promptEl = $('pack-prompt');
    promptEl.hidden = !state.pack.prompt;
    promptEl.textContent = state.pack.prompt ?? '';
  }, true);

  form.append(title, subtitle, prompt);

  const plugin = document.createElement('label');
  plugin.className = 'tl-check';
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = Boolean(state.pack.plugins?.includes('furnace-cost'));
  check.disabled = !editable;
  check.addEventListener('change', () => {
    state.pack.plugins = check.checked ? ['furnace-cost'] : [];
    commitPack();
  });
  plugin.append(check, document.createTextNode('Show furnace fuel-cost calculator'));
  form.appendChild(plugin);

  panel.append(h2, form);
  return panel;
}

function labeledInput(
  labelText: string,
  id: string,
  value: string,
  editable: boolean,
  onChange: (value: string) => void,
  textarea = false
) {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement(textarea ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
  input.id = id;
  input.value = value;
  input.disabled = !editable;
  if (input instanceof HTMLInputElement) {
    input.type = 'text';
    input.maxLength = id === 'manage-title' ? 80 : 200;
  }
  input.addEventListener('change', () => onChange(input.value.trim()));
  label.append(span, input);
  return label;
}

function tiersPanel(editable: boolean) {
  const panel = document.createElement('section');
  panel.className = 'tl-panel';
  const head = document.createElement('div');
  head.className = 'tl-panel-head';
  const h2 = document.createElement('h2');
  h2.textContent = `Tiers (${state.pack.tiers.length})`;
  const note = document.createElement('span');
  note.className = 'tl-muted';
  note.textContent = 'Unranked is always available as a bench.';
  head.append(h2, note);

  const wrap = document.createElement('div');
  wrap.className = 'tl-table-wrap';
  const table = document.createElement('table');
  table.className = 'tl-table';
  table.appendChild(tableHead(['Emoji', 'Label', 'Color', '']));

  const body = document.createElement('tbody');
  state.pack.tiers.forEach((tier, index) => {
    const tr = document.createElement('tr');
    tr.append(
      cellInput('text', tier.emoji ?? '', editable, (value) => updateTier(index, { emoji: value || undefined })),
      cellInput('text', tier.label, editable, (value) => updateTier(index, { label: value || tier.id })),
      cellInput('color', tier.color ?? '#94a3b8', editable, (value) => updateTier(index, { color: value })),
      actionCell([
        ['↑', () => reorderTiers(index, -1), index === 0 || !editable],
        ['↓', () => reorderTiers(index, 1), index === state.pack.tiers.length - 1 || !editable],
        ['Delete', () => deleteTier(index), !editable || state.pack.tiers.length <= 1],
      ])
    );
    body.appendChild(tr);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  panel.append(head, wrap);

  if (editable) {
    const add = document.createElement('div');
    add.className = 'tl-inline-add';
    const emoji = addFieldInput('Emoji', 'S');
    const label = addFieldInput('Label', 'New tier');
    const color = addFieldInput('Color', '#38bdf8');
    (color.querySelector('input') as HTMLInputElement).type = 'color';
    add.append(
      emoji,
      label,
      color,
      btn('Add tier', 'tl-btn tl-btn-primary', () => {
        const name = (label.querySelector('input') as HTMLInputElement).value.trim() || 'Tier';
        const id = uniqueId(
          slugify(name, 'tier').toUpperCase().replace(/-/g, '') || 'T',
          state.pack.tiers.map((tier) => tier.id)
        );
        state.pack.tiers.push({
          id,
          label: name,
          emoji: (emoji.querySelector('input') as HTMLInputElement).value.trim() || undefined,
          color: (color.querySelector('input') as HTMLInputElement).value,
        });
        commitPack();
        renderManage();
      })
    );
    panel.appendChild(add);
  }
  return panel;
}

function fieldsPanel(editable: boolean) {
  const panel = document.createElement('section');
  panel.className = 'tl-panel';
  const fields = state.pack.detailFields ?? [];
  const head = document.createElement('div');
  head.className = 'tl-panel-head';
  const h2 = document.createElement('h2');
  h2.textContent = `Custom fields (${fields.length})`;
  const note = document.createElement('span');
  note.className = 'tl-muted';
  note.textContent = 'Shown in the detail pane and item editor.';
  head.append(h2, note);

  if (!fields.length) {
    const empty = document.createElement('p');
    empty.className = 'tl-empty';
    empty.textContent = 'No extra fields yet. Add things like price, year, or a one-line claim.';
    panel.append(head, empty);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'tl-table-wrap';
    const table = document.createElement('table');
    table.className = 'tl-table';
    table.appendChild(tableHead(['Label', 'Key', '']));
    const body = document.createElement('tbody');
    fields.forEach((field, index) => {
      const tr = document.createElement('tr');
      const keyCell = document.createElement('td');
      keyCell.className = 'tl-muted';
      keyCell.textContent = field.key;
      tr.append(
        cellInput('text', field.label, editable, (value) => updateField(index, { label: value || field.key })),
        keyCell,
        actionCell([
          ['↑', () => reorderFields(index, -1), index === 0 || !editable],
          ['↓', () => reorderFields(index, 1), index === fields.length - 1 || !editable],
          ['Delete', () => deleteField(index), !editable],
        ])
      );
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    panel.append(head, wrap);
  }

  if (editable) {
    const add = document.createElement('div');
    add.className = 'tl-inline-add';
    const label = addFieldInput('Field label', 'Year');
    add.append(
      label,
      btn('Add field', 'tl-btn tl-btn-primary', () => {
        const name = (label.querySelector('input') as HTMLInputElement).value.trim();
        if (!name) return;
        const key = uniqueId(
          slugify(name, 'field'),
          (state.pack.detailFields ?? []).map((field) => field.key)
        );
        state.pack.detailFields = [...(state.pack.detailFields ?? []), { key, label: name }];
        commitPack();
        renderManage();
      })
    );
    panel.appendChild(add);
  }
  return panel;
}

function itemsPanel(editable: boolean) {
  const panel = document.createElement('section');
  panel.className = 'tl-panel';
  const head = document.createElement('div');
  head.className = 'tl-panel-head';
  const h2 = document.createElement('h2');
  h2.textContent = `Items (${state.pack.items.length})`;
  head.appendChild(h2);
  if (editable) head.appendChild(btn('Add item', 'tl-btn tl-btn-primary', () => openEditor(null)));
  panel.appendChild(head);

  if (!state.pack.items.length) {
    const empty = document.createElement('p');
    empty.className = 'tl-empty';
    empty.textContent = 'No items yet. Add competitors, then rank them.';
    panel.appendChild(empty);
    return panel;
  }

  const wrap = document.createElement('div');
  wrap.className = 'tl-table-wrap';
  const table = document.createElement('table');
  table.className = 'tl-table';
  table.appendChild(tableHead(['Item', 'Tier', '']));
  const body = document.createElement('tbody');
  state.pack.items.forEach((item, index) => {
    const tr = document.createElement('tr');
    if (item.id === state.selectedId) tr.classList.add('is-selected');
    const nameCell = document.createElement('td');
    const wrapCell = document.createElement('div');
    wrapCell.className = 'tl-item-cell';
    const name = document.createElement('span');
    name.textContent = item.name;
    wrapCell.append(thumbFor(item), name);
    nameCell.appendChild(wrapCell);

    const tierCell = document.createElement('td');
    const select = document.createElement('select');
    select.disabled = !editable;
    for (const tier of [...state.pack.tiers, { id: UNRANKED_TIER, label: 'Unranked' }]) {
      const option = document.createElement('option');
      option.value = tier.id;
      option.textContent = tier.label;
      if ((item.defaultTier || UNRANKED_TIER) === tier.id) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      item.defaultTier = select.value;
      commitPack();
    });
    tierCell.appendChild(select);

    const actions: [string, () => void, boolean][] = [
      ['↑', () => reorderItems(index, -1), index === 0 || !editable],
      ['↓', () => reorderItems(index, 1), index === state.pack.items.length - 1 || !editable],
      ['Edit', () => openEditor(item), !editable],
      ['Duplicate', () => duplicateItem(item), !editable],
      ['Delete', () => deleteItem(item.id), !editable],
    ];
    tr.append(nameCell, tierCell, actionCell(actions));
    tr.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button, select, input')) return;
      state.selectedId = item.id;
      renderManage();
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  panel.appendChild(wrap);
  return panel;
}

function dangerPanel() {
  const panel = document.createElement('section');
  panel.className = 'tl-panel';
  const h2 = document.createElement('h2');
  h2.textContent = 'List actions';
  const actions = document.createElement('div');
  actions.className = 'tl-row-actions';
  actions.appendChild(btn('Duplicate list', 'tl-btn', () => forkCurrent(' (copy)')));
  if (isTemplateCopy()) {
    actions.appendChild(btn('Reset to template', 'tl-btn', resetCurrent));
  } else {
    actions.appendChild(btn('Delete list', 'tl-btn tl-btn-danger', deleteCurrentPack));
  }
  panel.append(h2, actions);
  return panel;
}

function tableHead(labels: string[]) {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  for (const label of labels) {
    const th = document.createElement('th');
    th.textContent = label;
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function cellInput(type: string, value: string, editable: boolean, onChange: (value: string) => void) {
  const td = document.createElement('td');
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.disabled = !editable;
  input.addEventListener('change', () => onChange(input.value.trim()));
  td.appendChild(input);
  return td;
}

function actionCell(actions: [string, () => void, boolean][]) {
  const td = document.createElement('td');
  const wrap = document.createElement('div');
  wrap.className = 'tl-row-actions';
  for (const [label, onClick, disabled] of actions) {
    wrap.appendChild(btn(label, `tl-btn tl-btn-sm${label === 'Delete' ? ' tl-btn-danger' : ''}`, onClick, disabled));
  }
  td.appendChild(wrap);
  return td;
}

function addFieldInput(labelText: string, placeholder: string) {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  label.append(span, input);
  return label;
}

function updateTier(index: number, patch: Partial<TierDef>) {
  const current = state.pack.tiers[index];
  if (!current) return;
  state.pack.tiers[index] = { ...current, ...patch };
  commitPack();
}

function reorderTiers(index: number, delta: number) {
  state.pack.tiers = moveIndex(state.pack.tiers, index, delta);
  commitPack();
  renderManage();
}

function deleteTier(index: number) {
  const tier = state.pack.tiers[index];
  if (!tier || state.pack.tiers.length <= 1) return;
  if (!confirm(`Delete the “${tier.label}” tier? Items in it move to Unranked.`)) return;
  state.pack.items.forEach((item) => {
    if (item.defaultTier === tier.id) item.defaultTier = UNRANKED_TIER;
  });
  state.pack.tiers.splice(index, 1);
  commitPack();
  renderManage();
}

function updateField(index: number, patch: Partial<DetailField>) {
  const fields = state.pack.detailFields ?? [];
  const current = fields[index];
  if (!current) return;
  fields[index] = { ...current, ...patch };
  state.pack.detailFields = fields;
  commitPack();
}

function reorderFields(index: number, delta: number) {
  state.pack.detailFields = moveIndex(state.pack.detailFields ?? [], index, delta);
  commitPack();
  renderManage();
}

function deleteField(index: number) {
  const fields = state.pack.detailFields ?? [];
  const field = fields[index];
  if (!field) return;
  if (!confirm(`Remove the “${field.label}” field from items?`)) return;
  fields.splice(index, 1);
  state.pack.detailFields = fields;
  state.pack.items.forEach((item) => {
    if (item.meta) delete item.meta[field.key];
  });
  commitPack();
  renderManage();
}

function reorderItems(index: number, delta: number) {
  state.pack.items = moveIndex(state.pack.items, index, delta);
  commitPack();
  renderManage();
}

function duplicateItem(item: TierItem) {
  const copy: TierItem = {
    ...item,
    id: uniqueId(`item-${Date.now()}`, state.pack.items.map((entry) => entry.id)),
    name: `${item.name} (copy)`,
    tags: [...(item.tags ?? [])],
    meta: item.meta ? { ...item.meta } : undefined,
  };
  const index = state.pack.items.findIndex((entry) => entry.id === item.id);
  state.pack.items.splice(index + 1, 0, copy);
  state.selectedId = copy.id;
  commitPack();
  renderManage();
}

function deleteCurrentPack() {
  if (state.pack.kind !== 'user' || isTemplateCopy()) return;
  if (!confirm(`Delete “${state.pack.title}” from this browser?`)) return;
  saveStore((store) => {
    store.userPacks = store.userPacks.filter((pack) => pack.id !== state.pack.id);
    delete store.rankings[state.pack.id];
  });
  setView('rank');
  loadPack('furnaces');
}

function renderChrome() {
  $('pack-title').textContent = state.pack.title;
  $('pack-subtitle').textContent = state.pack.subtitle;
  const prompt = $('pack-prompt');
  if (state.pack.prompt) {
    prompt.hidden = false;
    prompt.textContent = state.pack.prompt;
  } else {
    prompt.hidden = true;
  }

  const furnace = $('furnace-controls');
  furnace.hidden = !state.pack.plugins?.includes('furnace-cost') || state.view !== 'rank';

  $('customize-btn').hidden = state.pack.kind !== 'official';
  fillPackSelect();
}

function firstVisibleId(pack: TierPack) {
  const tiers = [...pack.tiers.map((tier) => tier.id), UNRANKED_TIER];
  for (const tier of tiers) {
    const item = pack.items.find((entry) => (entry.defaultTier || UNRANKED_TIER) === tier);
    if (item) return item.id;
  }
  return pack.items[0]?.id ?? null;
}

function loadPack(id: string | null) {
  state.pack = resolvePack(id);
  applySavedRanking(state.pack);
  state.selectedId = firstVisibleId(state.pack);
  setUrlPack(pickerIdFor(state.pack));
  saveStore((store) => {
    store.lastPackId = pickerIdFor(state.pack);
  });
  renderChrome();
  if (state.view === 'manage') renderManage();
  else {
    renderBoard();
    renderDetails();
  }
}

function forkCurrent(titleSuffix = ' (custom)') {
  const forked = clonePack(state.pack, {
    id: newUserId(),
    kind: 'user',
    sourceId: state.pack.sourceId ?? state.pack.id,
    title: state.pack.title.endsWith(titleSuffix) ? state.pack.title : `${state.pack.title}${titleSuffix}`,
    updatedAt: new Date().toISOString(),
  });
  saveStore((store) => {
    store.userPacks.push(forked);
    const ranking = store.rankings[rankingKey(state.pack)];
    if (ranking) store.rankings[forked.id] = { ...ranking };
  });
  loadPack(forked.id);
  setView('manage');
}

function deleteItem(id: string) {
  if (!confirm('Delete this item from your list?')) return;
  state.pack.items = state.pack.items.filter((item) => item.id !== id);
  if (state.selectedId === id) state.selectedId = state.pack.items[0]?.id ?? null;
  commitPack();
  if (state.view === 'manage') renderManage();
  else {
    renderBoard();
    renderDetails();
  }
}

function openEditor(item: TierItem | null) {
  const dialog = $('item-editor') as HTMLDialogElement;
  $('item-editor-title').textContent = item ? 'Edit item' : 'Add item';
  ($('edit-id') as HTMLInputElement).value = item?.id ?? '';
  ($('edit-name') as HTMLInputElement).value = item?.name ?? '';
  ($('edit-emoji') as HTMLInputElement).value = item?.emoji ?? '';
  ($('edit-image') as HTMLInputElement).value = item?.image ?? '';
  ($('edit-accent') as HTMLInputElement).value = item?.accent ?? '#38bdf8';
  ($('edit-link') as HTMLInputElement).value = item?.link ?? '';
  ($('edit-description') as HTMLTextAreaElement).value = item?.description ?? '';
  ($('edit-tags') as HTMLInputElement).value = item?.tags?.join(', ') ?? '';

  const extra = $('edit-extra');
  extra.innerHTML = '';
  for (const field of state.pack.detailFields ?? []) {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = field.label;
    const input = field.key === 'steelman' || field.key === 'claim' || field.key === 'priceRationale'
      ? document.createElement('textarea')
      : document.createElement('input');
    input.id = `edit-meta-${field.key}`;
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.value = String(item?.meta?.[field.key] ?? '');
    label.append(span, input);
    extra.appendChild(label);
  }

  dialog.showModal();
  ($('edit-name') as HTMLInputElement).focus();
}

function readEditorItem(): TierItem | null {
  const name = ($('edit-name') as HTMLInputElement).value.trim();
  if (!name) return null;
  const existingId = ($('edit-id') as HTMLInputElement).value;
  const meta: Record<string, string | number> = {};
  for (const field of state.pack.detailFields ?? []) {
    const input = document.getElementById(`edit-meta-${field.key}`) as HTMLInputElement | HTMLTextAreaElement | null;
    const value = input?.value.trim() ?? '';
    if (!value) continue;
    meta[field.key] = field.key === 'afue' ? Number(value) : value;
  }
  const afueLabel = meta.afueLabel;
  if (typeof afueLabel === 'string') {
    const parsed = Number(String(afueLabel).replace(/[^\d.]/g, ''));
    if (Number.isFinite(parsed) && parsed > 1) meta.afue = parsed / 100;
    else if (Number.isFinite(parsed) && parsed > 0) meta.afue = parsed;
  }
  return {
    id: existingId || `item-${crypto.randomUUID?.() ?? Date.now()}`,
    name,
    emoji: ($('edit-emoji') as HTMLInputElement).value.trim() || undefined,
    image: ($('edit-image') as HTMLInputElement).value.trim() || undefined,
    accent: ($('edit-accent') as HTMLInputElement).value.trim() || undefined,
    link: ($('edit-link') as HTMLInputElement).value.trim() || undefined,
    description: ($('edit-description') as HTMLTextAreaElement).value.trim(),
    tags: ($('edit-tags') as HTMLInputElement).value.split(',').map((tag) => tag.trim()).filter(Boolean),
    defaultTier: state.pack.items.find((item) => item.id === existingId)?.defaultTier ?? UNRANKED_TIER,
    meta: Object.keys(meta).length ? meta : undefined,
  };
}

function exportPack() {
  if (state.view === 'rank') persistRankingFromDom();
  else persistRankingFromState();
  const payload = clonePack(state.pack);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.id.replace(/[^\w.-]+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importPackObject(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('Not an object');
  const data = raw as Partial<TierPack>;
  if (!data.title || !Array.isArray(data.items)) throw new Error('Need title and items[]');
  const items: TierItem[] = data.items.map((item, index) => {
    if (!item || typeof item !== 'object' || !item.name) throw new Error(`Item ${index + 1} needs a name`);
    return {
      id: String(item.id || `item-${index}`),
      name: String(item.name),
      emoji: item.emoji ? String(item.emoji) : undefined,
      image: item.image ? String(item.image) : undefined,
      accent: item.accent ? String(item.accent) : undefined,
      description: String(item.description ?? ''),
      link: item.link ? String(item.link) : undefined,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      defaultTier: String(item.defaultTier || UNRANKED_TIER),
      meta: item.meta && typeof item.meta === 'object' ? { ...item.meta } : undefined,
    };
  });
  const imported = clonePack(
    {
      id: newUserId(),
      title: String(data.title),
      subtitle: String(data.subtitle ?? 'Imported list'),
      kind: 'user',
      prompt: data.prompt ? String(data.prompt) : undefined,
      plugins: Array.isArray(data.plugins) ? data.plugins.filter((plugin) => plugin === 'furnace-cost') : [],
      tiers: Array.isArray(data.tiers) && data.tiers.length ? data.tiers.map((tier) => ({ ...tier })) : standardTiers,
      items,
      detailFields: Array.isArray(data.detailFields) ? data.detailFields.map((field) => ({ ...field })) : undefined,
      updatedAt: new Date().toISOString(),
    }
  );
  saveStore((store) => {
    store.userPacks.push(imported);
  });
  loadPack(imported.id);
  setView('manage');
}

function resetCurrent() {
  if (!confirm('Reset rankings (and restore template items if this is a template copy)?')) return;
  const sourceId = state.pack.sourceId;
  const shipped = sourceId ? findShippedPack(sourceId) : findShippedPack(state.pack.id);
  saveStore((store) => {
    delete store.rankings[rankingKey(state.pack)];
    if (shipped && state.pack.kind === 'user' && sourceId) {
      const restored = clonePack(shipped, {
        id: state.pack.id,
        kind: 'user',
        sourceId,
        updatedAt: new Date().toISOString(),
      });
      const idx = store.userPacks.findIndex((pack) => pack.id === state.pack.id);
      if (idx >= 0) store.userPacks[idx] = restored;
    }
  });
  loadPack(pickerIdFor(state.pack));
}

function bindOnce() {
  $('view-rank').addEventListener('click', () => setView('rank'));
  $('view-manage').addEventListener('click', () => setView('manage'));
  $('pack-select').addEventListener('change', (event) => {
    loadPack((event.target as HTMLSelectElement).value);
  });
  $('new-pack-btn').addEventListener('click', () => ($('new-pack-dialog') as HTMLDialogElement).showModal());
  $('new-pack-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = ($('new-pack-title') as HTMLInputElement).value.trim() || 'Untitled list';
    const subtitle = ($('new-pack-subtitle') as HTMLInputElement).value.trim();
    const created = clonePack({
      id: newUserId(),
      title,
      subtitle: subtitle || 'Your list — items stay in this browser.',
      kind: 'user',
      tiers: standardTiers,
      items: [],
      detailFields: [],
      updatedAt: new Date().toISOString(),
    });
    saveStore((store) => {
      store.userPacks.push(created);
    });
    ($('new-pack-dialog') as HTMLDialogElement).close();
    ($('new-pack-form') as HTMLFormElement).reset();
    loadPack(created.id);
    setView('manage');
  });
  $('customize-btn').addEventListener('click', () => forkCurrent());
  $('export-btn').addEventListener('click', exportPack);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    try {
      importPackObject(JSON.parse(await file.text()));
    } catch (error) {
      alert(`Could not import that file. ${error instanceof Error ? error.message : ''}`);
    }
  });
  $('reset-btn').addEventListener('click', resetCurrent);
  $('item-editor-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const next = readEditorItem();
    if (!next) return;
    const idx = state.pack.items.findIndex((item) => item.id === next.id);
    if (idx >= 0) state.pack.items[idx] = next;
    else state.pack.items.push(next);
    state.selectedId = next.id;
    ($('item-editor') as HTMLDialogElement).close();
    commitPack();
    if (state.view === 'manage') renderManage();
    else {
      renderBoard();
      renderDetails();
    }
  });
  $('editor-cancel').addEventListener('click', () => ($('item-editor') as HTMLDialogElement).close());
  $('new-pack-cancel').addEventListener('click', () => ($('new-pack-dialog') as HTMLDialogElement).close());
  $('gas-price').addEventListener('input', () => {
    saveStore((store) => {
      store.furnaceSettings.gasPrice = ($('gas-price') as HTMLInputElement).value;
    });
    renderDetails();
  });
  $('annual-btu').addEventListener('input', () => {
    saveStore((store) => {
      store.furnaceSettings.annualBTU = ($('annual-btu') as HTMLInputElement).value;
    });
    renderDetails();
  });
}

export function initTierList() {
  const settings = loadStore().furnaceSettings;
  ($('gas-price') as HTMLInputElement).value = settings.gasPrice;
  ($('annual-btu') as HTMLInputElement).value = settings.annualBTU;
  bindOnce();
  const requested = new URLSearchParams(window.location.search).get('pack');
  loadPack(requested);
}
