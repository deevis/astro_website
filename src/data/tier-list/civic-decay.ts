import type { TierPack } from './types';
import { UNRANKED_TIER, standardTiers } from './types';

export const civicDecayPack: TierPack = {
  id: 'civic-decay',
  title: 'Civic Decay Mechanisms',
  subtitle: 'A cynical starter list. Rank by how much internal damage you think each mechanism does.',
  kind: 'template',
  prompt:
    'Nothing is pre-ranked. This is a template, not a verdict. Edit names, rewrite claims, add sources, or delete anything. Your copy stays in this browser.',
  tiers: standardTiers,
  detailFields: [
    { key: 'domain', label: 'Domain' },
    { key: 'claim', label: 'Claim in one line' },
    { key: 'steelman', label: 'Steelman' },
  ],
  items: [
    {
      id: 'central-banking',
      name: 'Central Banking',
      emoji: '🏦',
      accent: '#eab308',
      description:
        'A monopoly issuer that can expand credit, backstop losses, and hide the bill in prices and currency depreciation. The alleged long-run damage is fiscal illusion: wars, entitlements, and asset bubbles become cheaper to start than to refuse, because the cost is pushed onto holders of cash and future taxpayers.',
      defaultTier: UNRANKED_TIER,
      tags: ['money'],
      meta: {
        domain: 'Money & credit',
        claim: 'Monopoly credit creation makes political overreach feel free.',
        steelman: 'A lender of last resort can abort panics that a rigid metallic system would turn into depressions.',
      },
    },
    {
      id: 'welfare-growth',
      name: 'Ever-Growing Welfare Programs',
      emoji: '🧾',
      accent: '#38bdf8',
      description:
        'Transfer programs that expand in scope, duration, and constituency until the fiscal burden and the dependency ratio feed each other. The claimed mechanism is ratchet politics: benefits are easy to add, humiliating to cut, and eventually crowd out family, work, and local mutual aid as the default safety net.',
      defaultTier: UNRANKED_TIER,
      tags: ['fiscal', 'incentives'],
      meta: {
        domain: 'Fiscal & incentives',
        claim: 'Transfers ratchet up, work and family ratchet down.',
        steelman: 'Industrial societies produce genuine destitution and disability that kin networks cannot always cover.',
      },
    },
    {
      id: 'divorce-norms',
      name: 'Normalization of Divorce',
      emoji: '💔',
      accent: '#f472b6',
      description:
        'No-fault exit plus cultural acceptance that marriage is a revocable lifestyle contract. The alleged compounding effect is weaker household formation, more father-absent homes, and a generation that treats permanence as naive — which then shows up in fertility, savings, and trust.',
      defaultTier: UNRANKED_TIER,
      tags: ['family'],
      meta: {
        domain: 'Family',
        claim: 'Easy exit turns marriage from an institution into a vibe.',
        steelman: 'Trapping people in violent or dead marriages is its own cruelty; exit rights protect the vulnerable.',
      },
    },
    {
      id: 'feminization',
      name: 'Feminization of Institutions',
      emoji: '🦢',
      accent: '#c084fc',
      description:
        'A claim about elite taste and institutional temperament: conflict-avoidance, safetyism, and prestige through care/harm language crowding out risk, standards, and dissent. Ranked here as a cultural selection pressure on schools, HR, media, and bureaucracies — not as a ranking of women.',
      defaultTier: UNRANKED_TIER,
      tags: ['culture', 'institutions'],
      meta: {
        domain: 'Institutions & culture',
        claim: 'Care/harm prestige replaces competence and conflict as the house style.',
        steelman: 'Many “feminized” norms are just lower-violence coordination; the alternative can be brute status contests.',
      },
    },
    {
      id: 'mass-illegal-immigration',
      name: 'Mass Illegal Immigration',
      emoji: '🚧',
      accent: '#fb923c',
      description:
        'Sustained unlawful inflows plus selective non-enforcement. The alleged damage is not “people moving”; it is the demonstration that law is optional, the wage and housing pressure on the existing poor, and the political temptation to import a constituency faster than it assimilates into high-trust norms.',
      defaultTier: UNRANKED_TIER,
      tags: ['borders', 'law'],
      meta: {
        domain: 'Borders & law',
        claim: 'Unenforced borders teach everyone else that rules are for suckers.',
        steelman: 'Labor demand, asylum claims, and sending-country collapse are real; enforcement theater is not a policy.',
      },
    },
    {
      id: 'democratic-socialism',
      name: 'Democratic Socialism',
      emoji: '🌹',
      accent: '#ef4444',
      description:
        'Electoral politics aimed at politicizing investment, prices, and employment under a moral banner. The claimed failure mode is the same as other socialisms, slower: capital flight, shortage, and a class of administrators who never face a P&L. Democracy here is the delivery vehicle, not the constraint.',
      defaultTier: UNRANKED_TIER,
      tags: ['politics', 'economy'],
      meta: {
        domain: 'Political economy',
        claim: 'Voting to allocate capital still has to obey scarcity.',
        steelman: 'Nordic social insurance rode on markets, oil, and culture; the slogan and the actual model are not the same.',
      },
    },
    {
      id: 'youth-gender-medicine',
      name: 'Youth Gender Medicine in Schools',
      emoji: '🚸',
      accent: '#22d3ee',
      description:
        'Social transition, concealment from parents, and medical pathways presented to minors as identity-affirming care. The cynical ranking treats this as an institutional capture of schools and clinics: irreversible interventions on a cohort that cannot consent like adults, amid rapidly shifting evidence and social contagion dynamics.',
      defaultTier: UNRANKED_TIER,
      tags: ['medicine', 'youth', 'schools'],
      meta: {
        domain: 'Medicine & schools',
        claim: 'Minors are a capture surface for an ideologically loaded medical fashion.',
        steelman: 'Some adolescents have severe dysphoria; watchful waiting and therapy are not the same as malice.',
      },
    },
    {
      id: 'abortion-norms',
      name: 'Normalization of Abortion',
      emoji: '⚖️',
      accent: '#94a3b8',
      description:
        'Legal and cultural treatment of abortion as routine healthcare rather than a tragic edge case. The alleged civilizational cost is a cheapened view of dependent human life, a substitute for family formation, and a politics that cannot say what a person is without a poll.',
      defaultTier: UNRANKED_TIER,
      tags: ['family', 'law'],
      meta: {
        domain: 'Law & family',
        claim: 'If the weakest dependents are optional, so is everyone else.',
        steelman: 'Forcing birth after rape, danger, or nonviable pregnancy is a different moral object than a slogan about “life.”',
      },
    },
    {
      id: 'identity-politics',
      name: 'Identity Politics',
      emoji: '🏷️',
      accent: '#a78bfa',
      description:
        'Status and spoils allocated by demographic category rather than by conduct, contract, or merit. The claimed solvent is that it trains people to see fellow citizens as teams, makes equal rules look like oppression, and rewards grievance entrepreneurship over competence.',
      defaultTier: UNRANKED_TIER,
      tags: ['politics', 'culture'],
      meta: {
        domain: 'Politics & culture',
        claim: 'Category conflict is a renewable political resource.',
        steelman: 'Ignoring real historical caste and current discrimination just launders the existing hierarchy.',
      },
    },
    {
      id: 'election-integrity',
      name: 'Weak Election Integrity',
      emoji: '🗳️',
      accent: '#64748b',
      description:
        'No voter ID, unsupervised mail ballots, long curing windows, and legal fights that treat chain-of-custody as a vibe. The item is the procedure set, not a specific year’s conspiracy. The alleged damage is that losers stop accepting counts, winners stop fearing fraud, and legitimacy becomes a partisan prior.',
      defaultTier: UNRANKED_TIER,
      tags: ['elections'],
      meta: {
        domain: 'Elections',
        claim: 'If the count is hard to audit, consent of the counted is cosplay.',
        steelman: 'ID and mail restrictions can also be turnout filters; most audited US races do not show outcome-changing fraud.',
      },
    },
    {
      id: 'career-politicians',
      name: 'Career Politicians',
      emoji: '👔',
      accent: '#2dd4bf',
      description:
        'Office as a lifelong profession with staff, donors, and a revolving door. The claimed mechanism is that the job selects for coalition maintenance and media survival, not for leaving. Term limits are the usual patch; the deeper issue is that governing becomes a guild with its own children.',
      defaultTier: UNRANKED_TIER,
      tags: ['politics'],
      meta: {
        domain: 'Politics',
        claim: 'Permanent incumbents optimize for remaining, not for finishing.',
        steelman: 'Legislation is a skilled trade; amateurs get rolled by staff, agencies, and lobbyists even faster.',
      },
    },
    {
      id: 'lobbyists',
      name: 'Lobbyists',
      emoji: '🤝',
      accent: '#f59e0b',
      description:
        'Concentrated interests hiring access to write the rules that diffuse voters will never read. Regulation, tax code, and appropriations become a market. The cynical view is that this is not corruption at the edge of the system — it is how a large state necessarily allocates favors.',
      defaultTier: UNRANKED_TIER,
      tags: ['politics', 'law'],
      meta: {
        domain: 'Politics & law',
        claim: 'Concentrated benefits beat scattered taxpayers every time.',
        steelman: 'Complex law needs specialists; banning lobbyists just moves the meeting into former-staffer consultancies.',
      },
    },
  ],
};
