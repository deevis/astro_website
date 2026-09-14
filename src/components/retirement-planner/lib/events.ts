import type { AccountType } from './types';

export type SimulationEventKind =
  | 'Contribution'
  | 'MarketGrowth'
  | 'AthHarvestSale'
  | 'Income'
  | 'SocialSecurity'
  | 'Expense'
  | 'ExpenseCut'
  | 'Rmd'
  | 'RothConversion'
  | 'SpendingWithdraw'
  | 'TaxEstimate'
  | 'PolicyNote';

export interface SimulationEventBase {
  kind: SimulationEventKind;
  age: number;
  calendarYear: number;
  policyId: string;
  reason: string;
}

export interface ContributionEvent extends SimulationEventBase {
  kind: 'Contribution';
  accountId: string;
  amount: number;
}

export interface MarketGrowthEvent extends SimulationEventBase {
  kind: 'MarketGrowth';
  accountId: string;
  accountType: AccountType;
  returnRate: number;
  gain: number;
  balanceAfter: number;
}

export interface AthHarvestSaleEvent extends SimulationEventBase {
  kind: 'AthHarvestSale';
  accountId: string;
  accountType: AccountType;
  grossUsd: number;
  gainUsd: number;
  taxUsd: number;
  netUsd: number;
  unitsSold?: number;
  priceUsd?: number | null;
}

export interface IncomeEvent extends SimulationEventBase {
  kind: 'Income';
  amount: number;
  label?: string;
}

export interface SocialSecurityEvent extends SimulationEventBase {
  kind: 'SocialSecurity';
  amount: number;
}

export interface ExpenseEvent extends SimulationEventBase {
  kind: 'Expense';
  amount: number;
}

export interface ExpenseCutEvent extends SimulationEventBase {
  kind: 'ExpenseCut';
  amount: number;
  cutFraction: number;
}

export interface RmdEvent extends SimulationEventBase {
  kind: 'Rmd';
  amount: number;
  appliedToSpending: number;
  surplus: number;
  owner: 'primary' | 'spouse';
}

export interface RothConversionEvent extends SimulationEventBase {
  kind: 'RothConversion';
  amount: number;
  estimatedTax: number;
}

export interface SpendingWithdrawEvent extends SimulationEventBase {
  kind: 'SpendingWithdraw';
  accountId: string;
  accountType: AccountType;
  amount: number;
}

export interface TaxEstimateEvent extends SimulationEventBase {
  kind: 'TaxEstimate';
  ordinaryTax: number;
  ltcgTax: number;
  totalTax: number;
  magi: number;
  taxableIncome: number;
  ssTaxableFraction: number;
}

export interface PolicyNoteEvent extends SimulationEventBase {
  kind: 'PolicyNote';
  note: string;
}

export type SimulationEvent =
  | ContributionEvent
  | MarketGrowthEvent
  | AthHarvestSaleEvent
  | IncomeEvent
  | SocialSecurityEvent
  | ExpenseEvent
  | ExpenseCutEvent
  | RmdEvent
  | RothConversionEvent
  | SpendingWithdrawEvent
  | TaxEstimateEvent
  | PolicyNoteEvent;

export interface YearEventLedger {
  age: number;
  calendarYear: number;
  events: SimulationEvent[];
}

export function createYearLedger(age: number, calendarYear: number): YearEventLedger {
  return { age, calendarYear, events: [] };
}

export function pushEvent(ledger: YearEventLedger, event: SimulationEvent): void {
  ledger.events.push(event);
}

/** Human-readable one-liners for UI audit rows. */
export function formatEventSummary(event: SimulationEvent): string {
  switch (event.kind) {
    case 'AthHarvestSale': {
      const label = event.policyId === 'alt-trim-policy' ? 'Alt trim' : 'ATH harvest';
      return `${label} ${event.accountType}: sold ${event.grossUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (tax ${event.taxUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}) — ${event.reason}`;
    }
    case 'RothConversion':
      return `Roth conversion ${event.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (est. tax ${event.estimatedTax.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}) — ${event.reason}`;
    case 'Rmd':
      return `RMD ${event.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} — ${event.reason}`;
    case 'ExpenseCut':
      return `Down-year expense cut ${event.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (${(event.cutFraction * 100).toFixed(0)}%) — ${event.reason}`;
    case 'SpendingWithdraw':
      return `Withdrew ${event.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} from ${event.accountType} — ${event.reason}`;
    case 'TaxEstimate':
      return `Est. tax ${event.totalTax.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (MAGI ${event.magi.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}) — ${event.reason}`;
    case 'PolicyNote':
      return event.note;
    default:
      return event.reason || event.kind;
  }
}
