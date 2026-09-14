import type { TierPack } from './types';
import { UNRANKED_TIER, standardTiers } from './types';

export const economicSystemsPack: TierPack = {
  id: 'economic-systems',
  title: 'Economic Operating Systems',
  subtitle: 'Rank monetary regimes the way you would rank tools: by constraint, failure mode, and what they optimize for.',
  kind: 'official',
  prompt: 'All items start unranked. Drag them into S–D by how well you think the system stores value, coordinates trade, and resists political capture.',
  tiers: standardTiers,
  detailFields: [
    { key: 'era', label: 'Era' },
    { key: 'issuance', label: 'Issuance' },
    { key: 'constraint', label: 'Hard constraint' },
    { key: 'examples', label: 'Examples' },
  ],
  items: [
    {
      id: 'classical-gold',
      name: 'Classical Gold Standard',
      emoji: '🥇',
      accent: '#eab308',
      link: 'https://en.wikipedia.org/wiki/Gold_standard',
      description:
        'Domestic money is a claim on a fixed weight of gold, and cross-border settlement is gold itself. Trade imbalances are supposed to self-correct through specie flows, prices, and interest rates rather than a committee. The virtue is an external brake on dilution. The cost is deflationary adjustment, gold-mine luck, and painful rigidity when credit collapses.',
      defaultTier: UNRANKED_TIER,
      tags: ['commodity', 'hard money'],
      meta: {
        era: 'c. 1870–1914 (and earlier national variants)',
        issuance: 'Notes and deposits redeemable in gold',
        constraint: 'Physical gold stock and convertibility',
        examples: 'UK, US, France, Germany in the pre-WWI era',
      },
    },
    {
      id: 'bimetallism',
      name: 'Bimetallism',
      emoji: '⚖️',
      accent: '#94a3b8',
      link: 'https://en.wikipedia.org/wiki/Bimetallism',
      description:
        'Gold and silver are both legal money at a legally fixed ratio. In theory you get a broader metallic base than gold alone. In practice Gresham’s law takes over: the undervalued metal disappears and the overvalued one dominates. A cautionary tale about price-fixing two commodities and calling it a standard.',
      defaultTier: UNRANKED_TIER,
      tags: ['commodity'],
      meta: {
        era: '19th century US, France, Latin Monetary Union',
        issuance: 'Coinage of gold and silver at a statutory ratio',
        constraint: 'Two metals, one politically chosen price',
        examples: 'US Coinage Act of 1792; “free silver” debates',
      },
    },
    {
      id: 'bretton-woods',
      name: 'Bretton Woods',
      emoji: '🏛️',
      accent: '#38bdf8',
      link: 'https://en.wikipedia.org/wiki/Bretton_Woods_system',
      description:
        'A gold-dollar hybrid: the US promises gold to foreign official holders; everyone else pegs to the dollar. It bought postwar stability and dollar hegemony, then died of its own success — Triffin’s dilemma, overseas dollar claims, and the 1971 close of the gold window. A reminder that a peg is a political promise, not a law of nature.',
      defaultTier: UNRANKED_TIER,
      tags: ['peg', 'dollar'],
      meta: {
        era: '1944–1971',
        issuance: 'Dollar as reserve; others peg to USD',
        constraint: 'US gold convertibility for official accounts',
        examples: 'IMF/World Bank order; Nixon shock ends it',
      },
    },
    {
      id: 'fiat-independent-cb',
      name: 'Fiat + Independent Central Bank',
      emoji: '🏦',
      accent: '#64748b',
      link: 'https://en.wikipedia.org/wiki/Fiat_money',
      description:
        'The default OECD operating system: unbacked state money, a central bank with an inflation/employment mandate, and a floating currency. Flexibility in crises is the pitch. The recurring failure mode is fiscal dominance — debt, deficits, and politics eventually eat the “independence.” Ranking this is ranking the world you already live in.',
      defaultTier: UNRANKED_TIER,
      tags: ['fiat', 'status quo'],
      meta: {
        era: '1971–present',
        issuance: 'Central bank + banking system credit',
        constraint: 'Inflation target, credibility, politics',
        examples: 'Fed, ECB, BoE, BoJ',
      },
    },
    {
      id: 'currency-board',
      name: 'Currency Board',
      emoji: '📋',
      accent: '#22c55e',
      link: 'https://en.wikipedia.org/wiki/Currency_board',
      description:
        'Domestic notes are issued only against a foreign reserve currency, usually at a hard peg, with little or no discretionary policy. It imports someone else’s monetary credibility at the price of your own lender-of-last-resort. Works until a banking crisis demands the discretion you legally forbade.',
      defaultTier: UNRANKED_TIER,
      tags: ['peg', 'discipline'],
      meta: {
        era: '19th century colonies; modern Hong Kong, Estonia (1992–2011)',
        issuance: 'Local currency fully backed by FX reserves',
        constraint: 'Reserve coverage and the peg statute',
        examples: 'Hong Kong dollar; Argentina’s 1990s convertibility',
      },
    },
    {
      id: 'dollarization',
      name: 'Official Dollarization',
      emoji: '💵',
      accent: '#4ade80',
      link: 'https://en.wikipedia.org/wiki/Dollarization',
      description:
        'A country abolishes its own money and uses the dollar (or euro) outright. Inflationary finance becomes almost impossible; so does domestic monetary policy. You outsource the central bank and import US fiscal-monetary cycles whether they fit your economy or not. Honest about weakness; silent about sovereignty.',
      defaultTier: UNRANKED_TIER,
      tags: ['dollar', 'hard peg'],
      meta: {
        era: 'Modern (Ecuador 2000, El Salvador 2001, Panama long-standing)',
        issuance: 'None domestically — USD notes and US banks',
        constraint: 'US monetary policy and physical/digital dollar access',
        examples: 'Ecuador, El Salvador, Panama, Kosovo (euro)',
      },
    },
    {
      id: 'free-banking',
      name: 'Free Banking',
      emoji: '🏪',
      accent: '#c084fc',
      link: 'https://en.wikipedia.org/wiki/Free_banking',
      description:
        'Competing private banks issue notes, usually redeemable in a base money, with little or no central bank. Discipline comes from note-dueling, clearinghouses, and the risk of failure — not a mandate. Historical Scotland is the exhibit. The open question is whether modern payment systems and deposit insurance would let that discipline survive.',
      defaultTier: UNRANKED_TIER,
      tags: ['competitive', 'historical'],
      meta: {
        era: '18th–19th century Scotland, some US states, Canada',
        issuance: 'Private banknotes on a commodity or reserve base',
        constraint: 'Convertibility, clearing, bankruptcy',
        examples: 'Scottish free banking; Suffolk System',
      },
    },
    {
      id: 'mmt',
      name: 'MMT / Fiscal Dominance',
      emoji: '🖨️',
      accent: '#f97316',
      link: 'https://en.wikipedia.org/wiki/Modern_monetary_theory',
      description:
        'A currency issuer cannot “run out” of its own unit; taxes create demand for the unit; inflation, not solvency, is the binding limit. As a description of fiat plumbing this is often true. As an operating system it invites spending first and restraint later — and later is when the political coalition is weakest. Rank the theory, or rank what happens when the theory meets an election.',
      defaultTier: UNRANKED_TIER,
      tags: ['fiat', 'fiscal'],
      meta: {
        era: 'Academic 1990s–; policy-adjacent after 2008 and 2020',
        issuance: 'Treasury + central bank as a consolidated state',
        constraint: 'Real resources and inflation, not bond vigilantes (claimed)',
        examples: 'Job Guarantee proposals; COVID-era fiscal-monetary fusion',
      },
    },
    {
      id: 'cbdc',
      name: 'CBDC',
      emoji: '🪪',
      accent: '#818cf8',
      link: 'https://en.wikipedia.org/wiki/Central_bank_digital_currency',
      description:
        'Central-bank money issued as a digital bearer or account, potentially programmable: expiry dates, merchant allowlists, negative rates that actually stick. Efficiency and payment inclusion are the brochure. Surveillance, financial-system disintermediation, and freeze-at-a-keystroke politics are the load-bearing features. A ranking of CBDCs is a ranking of how much monetary optionality you want the state to have over you.',
      defaultTier: UNRANKED_TIER,
      tags: ['fiat', 'digital', 'state'],
      meta: {
        era: '2010s pilots–present',
        issuance: 'Direct central-bank digital liabilities',
        constraint: 'Policy rules, identity layer, political control',
        examples: 'e-CNY; wholesale vs retail CBDC pilots',
      },
    },
    {
      id: 'bitcoin-standard',
      name: 'Bitcoin Standard',
      emoji: '₿',
      accent: '#f7931a',
      link: 'https://bitcoin.org/bitcoin.pdf',
      description:
        'A bearer digital commodity with a hard cap, no issuer, and settlement that does not ask permission. The monetary policy is a schedule, not a committee. Volatility, energy use, and the awkward adolescence of a unit that is still mostly used as a reserve asset rather than a unit of account are the live objections. Rank it as money, as savings technology, or as an exit from the other nine.',
      defaultTier: UNRANKED_TIER,
      tags: ['hard money', 'digital'],
      meta: {
        era: '2009–present',
        issuance: 'Proof-of-work issuance to a 21 million cap',
        constraint: 'Protocol rules and hashpower, not a board',
        examples: 'Bitcoin; El Salvador legal tender (partial)',
      },
    },
  ],
};
