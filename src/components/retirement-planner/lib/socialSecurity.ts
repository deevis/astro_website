import { earningsLimits, nawiData } from './ssaData';
import type { EarningsYear } from './types';

export interface ProcessedEarningsYear {
  year: number;
  totalEarnings: number;
  earnings: number;
  limit: number;
  indexedEarnings?: number;
}

export interface PiaBreakdownTier {
  range: string;
  amount: number;
  percentage: string;
}

export interface BenefitScenario {
  label: string;
  earningsData: ProcessedEarningsYear[];
  aime: number;
  pia: number;
  breakdown: PiaBreakdownTier[];
  benefitsByAge: Record<number, number>;
}

export interface BreakEvenYearPoint {
  age: number;
  monthlyAmount: number;
  yearlyAmount: number;
  cumulativeTotal: number;
  yearlyInvestment: number;
  totalInvested: number;
  investmentBalance: number;
  totalWithInvestments: number;
}

export interface BreakEvenCrossover {
  earlierAge: number;
  laterAge: number;
  crossoverAge: number;
}

/** Full retirement age factors assume FRA 67 (simplified; matches showcase). */
const BENEFIT_FACTORS: Record<number, number> = {
  62: 0.7,
  63: 0.75,
  64: 0.8,
  65: 13 / 15,
  66: 14 / 15,
  67: 1.0,
  68: 1.08,
  69: 1.16,
  70: 1.24,
};

/** 2026 planning baseline. https://www.ssa.gov/oact/cola/bendpoints.html */
const BEND_POINT_1 = 1286;
const BEND_POINT_2 = 7749;

export function getNAWI(year: number): number {
  const table = nawiData as Record<number, number>;
  if (table[year] != null) return table[year];
  const years = Object.keys(table).map(Number);
  const latestYear = Math.max(...years);
  const latestNawi = table[latestYear];
  return latestNawi * Math.pow(1.025, year - latestYear);
}

export function getEarningsLimit(year: number): number {
  const table = earningsLimits as Record<number, number>;
  return table[year] ?? (year < 1951 ? 3000 : projectFutureEarningsLimit(year));
}

export function projectFutureEarningsLimit(futureYear: number): number {
  const table = earningsLimits as Record<number, number>;
  if (table[futureYear] != null) return table[futureYear];
  const latestYear = Math.max(...Object.keys(table).map(Number));
  const latestLimit = table[latestYear];
  return Math.round(latestLimit * Math.pow(1.025, futureYear - latestYear));
}

export function parseEarningsText(inputText: string): EarningsYear[] {
  const lines = inputText.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: EarningsYear[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d{4})[\s,]+(\$?-?[\d,]+(?:\.\d+)?)/);
    if (!match) continue;
    const year = Number(match[1]);
    const amount = Number(match[2].replace(/[,$]/g, ''));
    if (!Number.isFinite(year) || year < 1951 || year > 2100 || !Number.isFinite(amount) || amount < 0) continue;
    const existing = rows.findIndex((row) => row.year === year);
    if (existing >= 0) rows[existing] = { year, amount };
    else rows.push({ year, amount });
  }
  return rows;
}

export function processEarningsHistory(history: EarningsYear[]): ProcessedEarningsYear[] {
  let processed: ProcessedEarningsYear[] = history.map((row) => {
    const limit = getEarningsLimit(row.year);
    return {
      year: row.year,
      totalEarnings: row.amount,
      earnings: Math.min(row.amount, limit),
      limit,
    };
  });

  if (processed.length === 0) return [];

  processed.sort((a, b) => b.year - a.year);

  if (processed.length < 35) {
    const existingYears = new Set(processed.map((d) => d.year));
    const mostRecentYear = Math.max(...existingYears);
    let currentYear = mostRecentYear;
    while (processed.length < 35 && currentYear > 1950) {
      if (!existingYears.has(currentYear)) {
        processed.push({
          year: currentYear,
          totalEarnings: 0,
          earnings: 0,
          limit: getEarningsLimit(currentYear),
        });
      }
      currentYear--;
    }
  }

  return processed;
}

export function calculateAIME(earningsData: ProcessedEarningsYear[]): number {
  const top35 = earningsData.slice(0, 35);
  const total = top35.reduce((sum, entry) => sum + (entry.indexedEarnings ?? 0), 0);
  return Math.floor(total / (35 * 12));
}

export function calculatePIA(aime: number): { pia: number; breakdown: PiaBreakdownTier[] } {
  const breakdown: PiaBreakdownTier[] = [];
  let pia = 0;

  if (aime <= BEND_POINT_1) {
    pia = aime * 0.9;
    breakdown.push({
      range: `$0 to $${BEND_POINT_1}`,
      amount: pia,
      percentage: '90%',
    });
  } else if (aime <= BEND_POINT_2) {
    pia = BEND_POINT_1 * 0.9 + (aime - BEND_POINT_1) * 0.32;
    breakdown.push({
      range: `$0 to $${BEND_POINT_1}`,
      amount: BEND_POINT_1 * 0.9,
      percentage: '90%',
    });
    breakdown.push({
      range: `$${BEND_POINT_1} to $${aime.toFixed(2)}`,
      amount: (aime - BEND_POINT_1) * 0.32,
      percentage: '32%',
    });
  } else {
    pia =
      BEND_POINT_1 * 0.9 +
      (BEND_POINT_2 - BEND_POINT_1) * 0.32 +
      (aime - BEND_POINT_2) * 0.15;
    breakdown.push({
      range: `$0 to $${BEND_POINT_1}`,
      amount: BEND_POINT_1 * 0.9,
      percentage: '90%',
    });
    breakdown.push({
      range: `$${BEND_POINT_1} to $${BEND_POINT_2}`,
      amount: (BEND_POINT_2 - BEND_POINT_1) * 0.32,
      percentage: '32%',
    });
    breakdown.push({
      range: `$${BEND_POINT_2} to $${aime.toFixed(2)}`,
      amount: (aime - BEND_POINT_2) * 0.15,
      percentage: '15%',
    });
  }

  return { pia: Math.floor(pia * 10 + 1e-8) / 10, breakdown };
}

export function calculateBenefitsByAge(pia: number): Record<number, number> {
  const benefits: Record<number, number> = {};
  for (let age = 62; age <= 70; age++) {
    benefits[age] = pia * (BENEFIT_FACTORS[age] ?? 1);
  }
  return benefits;
}

export function calculateScenario(
  data: ProcessedEarningsYear[],
  label: string,
  currentAge: number,
  asOfYear = new Date().getFullYear()
): BenefitScenario {
  const birthYear = asOfYear - currentAge;
  const indexingYear = birthYear + 60;
  const indexingNawi = getNAWI(indexingYear);

  const indexedData = data.map((entry) => {
    let indexedEarnings: number;
    if (entry.year < indexingYear) {
      indexedEarnings = entry.earnings * (indexingNawi / getNAWI(entry.year));
    } else {
      indexedEarnings = entry.earnings;
    }
    return { ...entry, indexedEarnings };
  });

  const earningsData = [...indexedData].sort(
    (a, b) => (b.indexedEarnings ?? 0) - (a.indexedEarnings ?? 0)
  );
  const aime = calculateAIME(earningsData);
  const { pia, breakdown } = calculatePIA(aime);
  const benefitsByAge = calculateBenefitsByAge(pia);

  return { label, earningsData, aime, pia, breakdown, benefitsByAge };
}

export interface PersonBenefitResult {
  base: BenefitScenario;
  withFuture: BenefitScenario | null;
  claimAgeMonthly: number;
}

export function computePersonBenefits(options: {
  currentAge: number;
  earningsHistory: EarningsYear[];
  claimAge: number;
  futureWorkYears: number;
  futureAnnualEarnings: number;
}): PersonBenefitResult | null {
  const {
    currentAge,
    earningsHistory,
    claimAge,
    futureWorkYears,
    futureAnnualEarnings,
  } = options;

  if (!currentAge || earningsHistory.length === 0) return null;

  const processed = processEarningsHistory(earningsHistory);
  if (processed.length === 0) return null;

  const base = calculateScenario(processed, 'Current earnings only', currentAge);

  let withFuture: BenefitScenario | null = null;
  if (futureWorkYears > 0 && futureAnnualEarnings > 0) {
    const mostRecentYear = Math.max(...processed.map((d) => d.year));
    const futureData: ProcessedEarningsYear[] = [];
    for (let i = 1; i <= futureWorkYears; i++) {
      const futureYear = Math.max(mostRecentYear, new Date().getFullYear() - 1) + i;
      const limit = projectFutureEarningsLimit(futureYear);
      futureData.push({
        year: futureYear,
        totalEarnings: futureAnnualEarnings,
        earnings: Math.min(futureAnnualEarnings, limit),
        limit,
      });
    }
    withFuture = calculateScenario(
      [...processed, ...futureData],
      'Including future work',
      currentAge
    );
  }

  const scenario = withFuture ?? base;
  const clampedClaim = Math.min(70, Math.max(62, Math.round(claimAge)));
  const claimAgeMonthly = scenario.benefitsByAge[clampedClaim] ?? scenario.pia;

  return { base, withFuture, claimAgeMonthly };
}

export function calculateBreakEvenData(
  benefitsByAge: Record<number, number>,
  selectedAges: number[],
  lifeExpectancy: number,
  colaRate: number,
  investmentPercentage = 0,
  expectedYield = 0
): Record<number, BreakEvenYearPoint[]> {
  const data: Record<number, BreakEvenYearPoint[]> = {};

  for (const retirementAge of selectedAges) {
    const monthlyBenefit = benefitsByAge[retirementAge];
    if (monthlyBenefit == null) continue;

    const yearlyData: BreakEvenYearPoint[] = [];
    let cumulativeTotal = 0;
    let investmentBalance = 0;
    let totalInvested = 0;

    for (let age = retirementAge; age <= lifeExpectancy; age++) {
      const yearsFromStart = age - retirementAge;
      const adjustedMonthlyBenefit = monthlyBenefit * Math.pow(1 + colaRate, yearsFromStart);
      const yearlyAmount = adjustedMonthlyBenefit * 12;
      cumulativeTotal += yearlyAmount;

      let yearlyInvestment = 0;
      if (investmentPercentage > 0) {
        yearlyInvestment = yearlyAmount * investmentPercentage;
        totalInvested += yearlyInvestment;
        investmentBalance = investmentBalance * (1 + expectedYield);
        investmentBalance += yearlyInvestment * (1 + expectedYield / 2);
      }

      yearlyData.push({
        age,
        monthlyAmount: adjustedMonthlyBenefit,
        yearlyAmount,
        cumulativeTotal,
        yearlyInvestment,
        totalInvested,
        investmentBalance,
        totalWithInvestments: cumulativeTotal + investmentBalance,
      });
    }

    data[retirementAge] = yearlyData;
  }

  return data;
}

export function findBreakEvenCrossovers(
  analysisData: Record<number, BreakEvenYearPoint[]>,
  selectedAges: number[],
  useInvestments = false
): BreakEvenCrossover[] {
  const results: BreakEvenCrossover[] = [];
  const sorted = [...selectedAges].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const age1 = sorted[i];
      const age2 = sorted[j];
      const data1 = analysisData[age1];
      const data2 = analysisData[age2];
      if (!data1 || !data2) continue;

      const startAge = Math.max(age1, age2);
      const endAge = Math.min(
        data1[data1.length - 1]?.age ?? 0,
        data2[data2.length - 1]?.age ?? 0
      );

      for (let currentAge = startAge + 1; currentAge <= endAge; currentAge++) {
        const point1 = data1.find((d) => d.age === currentAge);
        const point2 = data2.find((d) => d.age === currentAge);
        const prevPoint1 = data1.find((d) => d.age === currentAge - 1);
        const prevPoint2 = data2.find((d) => d.age === currentAge - 1);
        if (!point1 || !point2 || !prevPoint1 || !prevPoint2) continue;

        const total = (p: BreakEvenYearPoint) =>
          useInvestments ? p.totalWithInvestments : p.cumulativeTotal;

        const t1c = total(point1);
        const t2c = total(point2);
        const t1p = total(prevPoint1);
        const t2p = total(prevPoint2);

        // Later claimer (age2) surpasses earlier claimer (age1)
        const crossed = t2p <= t1p && t2c > t1c;
        if (!crossed) continue;

        let crossoverAge = currentAge;
        const prevGap = Math.abs(t1p - t2p);
        const currentGap = Math.abs(t1c - t2c);
        if (prevGap + currentGap > 0) {
          crossoverAge = Math.round(currentAge - 1 + prevGap / (prevGap + currentGap));
        }

        results.push({
          earlierAge: age1,
          laterAge: age2,
          crossoverAge,
        });
        break;
      }
    }
  }

  return results;
}

export function money(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
