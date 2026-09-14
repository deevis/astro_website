/**
 * SECURE 2.0 RMD start ages and Uniform Lifetime Table (simplified).
 * Educational estimates only — not tax advice.
 */

/** Approximate birth year from current age. */
export function approxBirthYear(currentAge: number, asOfYear = new Date().getFullYear()): number {
  return asOfYear - currentAge;
}

/**
 * RMD required beginning age under SECURE 2.0.
 * Born 1951–1959 → 73; 1960+ → 75; earlier cohorts → 72.
 */
export function rmdStartAge(currentAge: number, asOfYear = new Date().getFullYear()): number {
  const birthYear = approxBirthYear(currentAge, asOfYear);
  if (birthYear >= 1960) return 75;
  if (birthYear >= 1951) return 73;
  return 72;
}

/**
 * IRS Uniform Lifetime Table factors (selected ages).
 * Source: IRS Publication 590-B style table (commonly published factors).
 */
const UNIFORM_LIFETIME: Record<number, number> = {
  72: 27.4,
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
  96: 8.4,
  97: 7.8,
  98: 7.3,
  99: 6.8,
  100: 6.4,
  101: 6.0,
  102: 5.6,
  103: 5.2,
  104: 4.9,
  105: 4.6,
  106: 4.3,
  107: 4.1,
  108: 3.9,
  109: 3.7,
  110: 3.5,
  111: 3.4,
  112: 3.3,
  113: 3.1,
  114: 3.0,
  115: 2.9,
  116: 2.8,
  117: 2.7,
  118: 2.5,
  119: 2.3,
  120: 2.0,
};

export function uniformLifetimeFactor(age: number): number {
  const rounded = Math.floor(age);
  if (UNIFORM_LIFETIME[rounded] != null) return UNIFORM_LIFETIME[rounded];
  if (rounded < 72) return UNIFORM_LIFETIME[72];
  if (rounded > 120) return UNIFORM_LIFETIME[120];
  // interpolate gaps if any
  for (let a = rounded; a <= 120; a++) {
    if (UNIFORM_LIFETIME[a] != null) return UNIFORM_LIFETIME[a];
  }
  return 2.0;
}

export function requiredMinimumDistribution(balance: number, age: number): number {
  if (balance <= 0) return 0;
  const factor = uniformLifetimeFactor(age);
  return balance / factor;
}
