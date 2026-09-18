export type PlaygroundCategoryId = 'simulation' | 'game' | 'article' | 'science' | 'graphics';

export const playgroundCategories: {
  id: PlaygroundCategoryId;
  label: string;
  blurb: string;
}[] = [
  { id: 'simulation', label: 'Simulations', blurb: 'Markets, hydrology, and agent worlds in motion.' },
  { id: 'game', label: 'Games', blurb: 'Playable experiments with a story or a score.' },
  { id: 'article', label: 'Interactive articles', blurb: 'History and ideas you can step through.' },
  { id: 'science', label: 'Math & Science', blurb: 'Statistics, solar cycles, fractals, and calculators.' },
  { id: 'graphics', label: 'Graphics', blurb: 'WebGL, canvas, shaders, and particle toys.' },
];

export type GameGenre = 'adventure' | 'strategy' | 'puzzle' | 'trainer';

export const gameGenres: { id: GameGenre; label: string; blurb: string }[] = [
  { id: 'adventure', label: 'Adventure', blurb: 'Worlds to wander.' },
  { id: 'strategy', label: 'Strategy', blurb: 'Cities, councils, consequences.' },
  { id: 'puzzle', label: 'Puzzle', blurb: 'Quiet concentration.' },
  { id: 'trainer', label: 'Trainer', blurb: 'Reflexes, memory, and math.' },
];

export interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  playLabel: string;
  bullets: string[];
  image?: string;
  genre: GameGenre;
}

export const games: GameEntry[] = [
  {
    id: 'paper-puppet',
    title: 'Paper Puppet',
    tagline: 'Pull a few strings.',
    description:
      'A paper character, some real-world rules, and your move. Walk, jump, pose the skeleton, go limp, and dodge obstacles.',
    href: '/playground/paper_puppet',
    image: '/html_showcase/paper_puppet/thumb.png',
    playLabel: 'Play Paper Puppet',
    genre: 'adventure',
    bullets: [
      'Walk, jump, and double jump',
      'Pose the skeleton, then drop it as ragdoll',
      'Obstacles, environments, and custom .puppet.json models',
    ],
  },
  {
    id: 'little-planet-worlds',
    title: 'Little Planet Worlds',
    tagline: 'A tiny planet. A whole adventure.',
    description:
      'Explore forests, villages, deserts and glaciers on a living sphere. Gather, craft, build a home, then find a passage to stranger worlds.',
    href: '/playground/little_planet_worlds',
    image: '/html_showcase/little_planet_worlds/thumb.png',
    playLabel: 'Play Little Planet Worlds',
    genre: 'adventure',
    bullets: [
      'WASD wander, double jump, globe map waypoints',
      'Inventory, crafting, and chapter missions',
      'Three authored worlds, then seeded frontiers',
    ],
  },
  {
    id: 'collapse',
    title: 'COLLAPSE',
    tagline: 'Build a civilization. Watch it turn.',
    description:
      'A historical strategy campaign: found cities, steer councils, spend divine favor, and live with the institutions you corrupt.',
    href: '/playground/collapse',
    image: '/html_showcase/collapse/thumb.png',
    playLabel: 'Play COLLAPSE',
    genre: 'strategy',
    bullets: [
      'Turn-based campaign on a living map',
      'Buildings, research, factions, and council debates',
      'From founding rites to the long decline',
    ],
  },
  {
    id: 'modular-math',
    title: 'Modular Math',
    tagline: 'Remainders, clocks, and wrap-around arithmetic.',
    description:
      'How fast can you find 47 mod 12? Train remainder fluency with clocks, weekdays, and a 45-second blitz.',
    href: '/apps/modular-math',
    image: '/images/games/modular-math.png',
    playLabel: 'Play Modular Math',
    genre: 'trainer',
    bullets: [
      'See numbers wrap a modulus like hours on a clock',
      'Easy, Standard, Clock, and timed Blitz modes',
      'Streaks and personal bests stay in your browser',
    ],
  },
  {
    id: 'memory-challenge',
    title: 'Memory Challenge',
    tagline: 'Memorize the numbers. Tap them in order.',
    description: 'A short-term memory drill that gets meaner each round — up through Nightmare.',
    href: '/apps/memory-challenge',
    image: '/images/games/memory-challenge.png',
    playLabel: 'Play Memory Challenge',
    genre: 'trainer',
    bullets: ['Four difficulties', 'Lives and streaks', 'How far can you go?'],
  },
  {
    id: 'reaction-trainer',
    title: 'Reaction Trainer',
    tagline: 'Tap on green. Choose left or right.',
    description: 'Measure raw reaction time, then switch to decision mode and keep a session history.',
    href: '/apps/reaction-trainer',
    image: '/images/games/reaction-trainer.png',
    playLabel: 'Play Reaction Trainer',
    genre: 'trainer',
    bullets: ['Reaction and decision modes', 'Session history', 'Consistency scoring'],
  },
  {
    id: 'cryptoquote',
    title: 'Cryptoquote',
    tagline: 'Decode the cipher. Save the quote.',
    description: 'Newspaper-style cryptograms: a daily puzzle, or encrypt your own and share it.',
    href: '/apps/cryptoquote',
    image: '/html_showcase/cryptoquote_generator/thumb.png',
    playLabel: 'Play Cryptoquote',
    genre: 'puzzle',
    bullets: ['Daily puzzle', 'Create and share', 'Classic substitution ciphers'],
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    tagline: 'Fill the grid. Every digit once.',
    description: 'Classic 9×9 Sudoku. Difficulty is how many squares you start with — Easy through Expert.',
    href: '/apps/sudoku',
    image: '/html_showcase/sudoku/thumb.png',
    playLabel: 'Play Sudoku',
    genre: 'puzzle',
    bullets: ['Easy, Medium, Hard, Expert', 'Daily puzzle', 'Notes, hints, and a unique grid'],
  },
  {
    id: 'logic-grid',
    title: 'Logic Grid',
    tagline: 'Cross out what isn’t true.',
    description:
      'Classic magazine logic problems: four people, three attributes, and a handful of clues. Easy through Nightmare by how firmly the clues nail the path.',
    href: '/apps/logic-grid',
    image: '/html_showcase/logic_grid/thumb.png',
    playLabel: 'Play Logic Grid',
    genre: 'puzzle',
    bullets: ['Easy 8, Medium 7, Hard 6, Nightmare 5', 'Daily puzzle', 'Hats, stalls, bands, mascots, and more'],
  },
];

export interface AppEntry {
  id: string;
  title: string;
  tagline: string;
  href: string;
  featured?: boolean;
  image?: string;
}

export const apps: AppEntry[] = [
  {
    id: 'retirement-planner',
    title: 'Retirement Planner',
    tagline: 'Social Security, accounts, and Monte Carlo — data stays in your browser.',
    href: '/apps/retirement-planner',
    image: '/images/apps/retirement-planner.png',
    featured: true,
  },
  {
    id: 'pink-noise',
    title: 'Pink Noise Generator',
    tagline: 'Craft pink, white, and brown noise for focus or sleep.',
    href: '/apps/pink-noise-generator',
    image: '/images/apps/pink-noise-generator.png',
  },
  {
    id: 'stopwatch-timer',
    title: 'Stopwatch & Timer',
    tagline: 'Laps to the hundredth, countdowns with custom alarms.',
    href: '/apps/stopwatch-timer',
    image: '/images/apps/stopwatch-timer.png',
  },
  {
    id: 'tier-list',
    title: 'Tier List',
    tagline: 'Rank furnaces, monetary systems, or your own roster. Saved in your browser.',
    href: '/apps/tier-list',
    image: '/images/apps/tier-list.png',
  },
];

export interface BitcoinEntry {
  id: string;
  title: string;
  tagline: string;
  href: string;
}

export const bitcoinResources: BitcoinEntry[] = [
  {
    id: 'tutorial',
    title: 'Bitcoin Tutorial',
    tagline: 'Modules from “what is money?” through Bitcoin’s design, with quizzes.',
    href: '/bitcoin-tutorial',
  },
  {
    id: 'blockchain',
    title: 'Blockchain Walkthrough',
    tagline: 'Hashing, blocks, and immutability — run the demos as you go.',
    href: '/bitcoin-blockchain-tutorial',
  },
  {
    id: 'dca',
    title: 'DCA What-If',
    tagline: 'Replay dollar-cost averaging against real historical prices.',
    href: '/bitcoin-dca-what-if',
  },
  {
    id: 'wallets',
    title: 'Hardware Wallet Showdown',
    tagline: 'Security scores, prices, and features side by side.',
    href: '/bitcoin-hardware-wallet-showdown',
  },
  {
    id: 'op-return',
    title: 'OP_RETURN Explorer',
    tagline: 'A timeline of large OP_RETURN payloads on-chain.',
    href: '/bitcoin-large-op-returns-explorer',
  },
  {
    id: 'bip-110',
    title: 'BIP 110 Miner Support',
    tagline: 'Who is signaling, and how the miner set looks today.',
    href: '/bip-110-miner-support',
  },
  {
    id: 'library',
    title: 'Resource Library',
    tagline: 'Books, podcasts, wallets, node software, and papers.',
    href: '/bitcoin-resources',
  },
];

export interface ToolEntry {
  id: string;
  title: string;
  tagline: string;
  href: string;
  group: 'encode' | 'data' | 'time' | 'reference';
}

export const developerToolGroups: { id: ToolEntry['group']; label: string }[] = [
  { id: 'encode', label: 'Encode & convert' },
  { id: 'data', label: 'Data & tokens' },
  { id: 'time', label: 'Time' },
  { id: 'reference', label: 'Lookup & compare' },
];

export const developerTools: ToolEntry[] = [
  { id: 'json', title: 'JSON Formatter', tagline: 'Format, validate, convert hashes and dicts.', href: '/tools/json-formatter', group: 'data' },
  { id: 'base64', title: 'Base64', tagline: 'Encode and decode in the browser.', href: '/tools/base64', group: 'encode' },
  { id: 'escape', title: 'String Escape', tagline: 'URL, HTML, JS, and XML escaping.', href: '/tools/string-escape', group: 'encode' },
  { id: 'hex', title: 'Hex Converter', tagline: 'Hex ↔ text for OP_RETURN payloads.', href: '/tools/hex-converter', group: 'encode' },
  { id: 'hash', title: 'Hash (SHA-2)', tagline: 'SHA-256, SHA-384, and SHA-512.', href: '/tools/hash', group: 'encode' },
  { id: 'uuid', title: 'UUID Generator', tagline: 'Generate v4 and v7 identifiers.', href: '/tools/uuid', group: 'data' },
  { id: 'jwt', title: 'JWT Decoder', tagline: 'Decode header and payload, check expiry.', href: '/tools/jwt', group: 'data' },
  { id: 'time', title: 'Time Converter', tagline: 'ISO 8601, Unix epoch, and timezones.', href: '/tools/time', group: 'time' },
  { id: 'qr', title: 'QR Code', tagline: 'Generate or scan from image or camera.', href: '/tools/qr-code', group: 'reference' },
  { id: 'language-showdown', title: 'Language Showdown', tagline: 'Syntax and idioms, side by side.', href: '/language-showdown', group: 'reference' },
];

/** UTC day number — stable for a calendar day, independent of build time once evaluated in the browser. */
export function utcDayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function sliderStartIndex(length: number, salt = 0, date = new Date()): number {
  if (length <= 0) return 0;
  return (utcDayNumber(date) + salt) % length;
}

export function gameTitleKey(title: string) {
  return title
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/:.*$/, '')
    .replace(/[^a-z0-9]+/g, '');
}
