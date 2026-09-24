import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPlan, createDefaultPerson, createEmptyRealEstateProperty, createEmptyOtherPersonalAsset, mergePlanDefaults, syncRetirementDerivedFields, gramsToTroyOz, parseGoldAmountToTroyOz, describeBitcoinSellPlaybook, formatSpendBreakdown, nominalAnnualSpendAtAge, remainingWorkYears, workFractionInCalendarYear, type RetirementPlan, type Account } from './types';
import { projectCashflow as projectCashflowRaw } from './cashflow';
import { bitcoinModelAnnualReturn, bitcoinModelPriceUsd, scaledBitcoinModelPriceUsd, calendarYearToModelDate, BITCOIN_PRICING_MODEL_LABELS, AMALGAM_MODEL_IDS, amalgamMixId, type BitcoinPricingModelId } from './bitcoinPricingModels';
import { harvestAthAltsToCash, updateAltHighWaterMarks, accountPriceIndex } from './policies/athHarvest';
import { trimAltsToCash } from './policies/altTrim';
import { executeRmdPolicy } from './policies/rmdPolicy';
import { performRothConversion } from './policies/rothConversion';
import { contributeToAccount, withdrawWithDetail } from './accountOps';
import { estimateSaleTax, grossForTargetNet, longTermCapitalGainsTax } from './capitalGainsTax';
import { liquidateBitcoinToCash, previewBitcoinLiquidation } from './bitcoinLiquidation';
import {
  applyGridScenario,
  applySpendTarget,
  BITCOIN_GRID_CHOICES,
  buildMonteCarloGrid,
  GRID_CELL_COUNT,
  primarySsClaimAge,
  retirementAgeGridValues,
  spendGridTargets,
  ssClaimAgeGridValues,
} from './monteCarloGrid';
import { computeAnnualTax, socialSecurityTaxableFraction } from './tax/federalTaxEngine';
import { runMonteCarloBatch, runMonteCarloAsync, makeReturnSampler, createRng, summarizeEndingBalances, type FailureCase } from './monteCarloCore';
import { runMonteCarlo, cancelMonteCarlo } from './monteCarlo';
import { parseImportedPlan, exportPlanJson, savePlan, loadPlan, STORAGE_KEY } from './persistence';
import { rmdStartAge, requiredMinimumDistribution } from './rmd';
import { parseEarningsText, computePersonBenefits } from './socialSecurity';
import { analyzeRamp } from './rampAnalysis';
import { readyForProjection } from './planHealth';
import { buildScenarioStory } from './scenarioStory';

const TEST_AS_OF = new Date(2026, 0, 1);

function projectCashflow(
  plan: Parameters<typeof projectCashflowRaw>[0],
  options?: Parameters<typeof projectCashflowRaw>[1]
) {
  return projectCashflowRaw(plan, { stubFirstYearReturns: false, asOfDate: TEST_AS_OF, ...options });
}

function near(actual: number, expected: number, tolerance = 0.02) { assert.ok(Math.abs(actual - expected) < tolerance, actual + ' != ' + expected); }
function account(type: Account['type'], balance = 100000, extra: Partial<Account> = {}): Account {
 return { id: type, type, label: type, owner: 'primary', balance, annualContribution: 0, expectedReturn: 0, ...extra };
}
function plan(): RetirementPlan {
 const p = createEmptyPlan(); p.primary = { ...p.primary, currentAge: 60, retirementAge: 60, lifeExpectancy: 62 };
 p.assumptions.inflationRate = 0; p.assumptions.bitcoinPricingModel = 'expectedReturn'; p.assumptions.bitcoinReturn = 0;
 p.assumptions.useSpendFromPlan = true; p.assumptions.withdrawalRate = 0;
 p.taxStrategy.rothConversionPolicy = 'none'; p.taxStrategy.monthlyInsuranceUntilMedicare = 0; p.taxStrategy.monthlyMedicarePartB = 0; p.taxStrategy.downYearExpenseCut = 0;
 p.expenses = [{ id: 'living', label: 'Living', annualAmount: 10000, startAge: 18, endAge: null, category: 'general' }];
 p.accounts = [account('hysa', 100000)]; p.socialSecurity[0].futureWorkYears=0; return p;
}
function btc(price = 100000) { return account('bitcoin', price, { assetUnits: 1, spotPriceUsd: price, costBasisUsd: price }); }
function harvest(price: number, modify: (p: RetirementPlan) => void = () => {}) {
 const p = plan(); p.accounts = [btc(price)]; p.taxStrategy.athHarvestMaxSleeveFraction = 1; modify(p);
 const accounts = structuredClone(p.accounts);
 const result = harvestAthAltsToCash(p, accounts, p.primary.currentAge, 0, 0, { bitcoin: 100000 }, { bitcoin: 1 }, 0, 10000);
 return { p, accounts, result };
}

test('harvesting qualifies at exact ATH and both sides of the 5% boundary', () => {
 for (const price of [100000, 95000, 110000]) assert.ok(harvest(price).result.totalNet > 0);
 assert.equal(harvest(94999).result.totalNet, 0);
});
test('zero tolerance qualifies equality but no pullback', () => {
 assert.ok(harvest(100000, p => p.taxStrategy.athHarvestNearAthFraction = 0).result.totalNet > 0);
 assert.equal(harvest(99999, p => p.taxStrategy.athHarvestNearAthFraction = 0).result.totalNet, 0);
});
test('harvest cap, tax, units and net cash reconcile', () => {
 const { accounts, result } = harvest(100000, p => { p.taxStrategy.athHarvestMaxSleeveFraction = 0.16; p.accounts[0].costBasisUsd = 20000; });
 near(result.totalGross, 16000); near(result.bitcoinBtc!, 0.16); near(accounts[0].assetUnits!, 0.84);
 near(accounts.reduce((s,a)=>s+a.balance,0) + result.totalTax, 100000);
 near(result.totalNet, accounts.find(a=>a.type==='hysa')!.balance);
});
test('buffer target is obeyed even below the RAMP minimum', () => {
 assert.equal(harvest(100000, p => p.taxStrategy.athHarvestBufferYears=0).result.totalNet, 0);
 near(harvest(100000, p => p.taxStrategy.athHarvestBufferYears=1).result.totalNet,10000);
});
test('disabled, working and pre-SS windows suppress harvest; full retirement allows it', () => {
 assert.equal(harvest(100000,p=>p.taxStrategy.athHarvestEnabled=false).result.totalNet,0);
 assert.equal(harvest(100000,p=>p.primary.retirementAge=65).result.totalNet,0);
 assert.equal(harvest(100000,p=>p.primary.currentAge=70).result.totalNet,0);
 assert.ok(harvest(100000,p=>{p.primary.currentAge=70;p.taxStrategy.athHarvestWindow='retirement';}).result.totalNet>0);
});
test('full cash buffer causes no sale', () => {
 const p=plan(); const accounts=[btc(),account('hysa',40000)];
 assert.equal(harvestAthAltsToCash(p,accounts,60,0,0,{bitcoin:100000},{},0,10000).totalGross,0);
});
test('crypto high-water mark tracks price returns, independent of deposits and sales', () => {
 const accounts=[account('crypto',30000)]; const high={crypto:1}; const index={crypto:1.2};
 updateAltHighWaterMarks(accounts,high,index); assert.equal(high.crypto,1.2);
 accounts[0].balance=1000; assert.equal(accountPriceIndex(accounts[0],index),1.2);
 index.crypto=1.1; updateAltHighWaterMarks(accounts,high,index); assert.equal(high.crypto,1.2);
});
test('a repeated near-ATH year can refill reserves without moving the peak downward', () => {
 const p=plan(); p.accounts=[btc()]; p.assumptions.bitcoinHistoricalAthUsd=100000;p.taxStrategy.athHarvestBufferYears=1;p.taxStrategy.athHarvestMaxSleeveFraction=1;
 const result=projectCashflow(p); assert.ok(result.years.every(y=>y.athHarvest));
});
test('unit-priced contributions buy units and increase basis before growth', () => {
 for(const type of ['bitcoin','gold','silver'] as const) {
 const p=plan(); p.primary.retirementAge=61; p.primary.birthMonth=1; p.primary.lifeExpectancy=60;p.expenses=[];
 p.accounts=[account(type,1000,{spotPriceUsd:100,assetUnits:10,annualContribution:200,costBasisUsd:800})];
 const result=projectCashflow(p); near(result.years[0].portfolioTotal,1200); near(result.years[0].contributions,200);
 assert.equal(result.years[0].portfolioReturn,0);
 }
});
test('contribution basis and withdrawal units stay in sync',()=>{
 const a=btc(); contributeToAccount(a,10000); near(a.assetUnits!,1.1);near(a.costBasisUsd!,110000);
 const out=withdrawWithDetail([a],['bitcoin'],55000);near(a.assetUnits!,0.55);near(a.costBasisUsd!,55000);near(out.total,55000);
});
test('every Bitcoin price model gives full first-year growth and preserves each account anchor',()=>{
 for(const id of Object.keys(BITCOIN_PRICING_MODEL_LABELS).filter(id=>id!=='expectedReturn') as BitcoinPricingModelId[]) {
 const p=plan();p.expenses=[];p.primary.lifeExpectancy=60;p.taxStrategy.athHarvestEnabled=false;p.assumptions.bitcoinPricingModel=id;
 p.accounts=[btc(100000),{...btc(200000),id:'btc2'}];
 const r=bitcoinModelAnnualReturn(id,new Date().getFullYear())!;
 const out=projectCashflow(p);near(out.endingBalance,300000*(1+r));
 for(const event of out.years[0].events.filter(e=>e.kind==='MarketGrowth')) near(event.returnRate,r);
 }
});
test('dollar-only Bitcoin follows the model and warns that market ATH needs a spot',()=>{
 const p=plan();p.expenses=[];p.primary.lifeExpectancy=60;p.assumptions.bitcoinPricingModel='powerLaw';p.accounts=[account('bitcoin')];
 const out=projectCashflow(p);near(out.endingBalance,100000*(1+bitcoinModelAnnualReturn('powerLaw',new Date().getFullYear())!));assert.ok(out.warnings.some(w=>w.includes('spot price')));
});
test('fixed Bitcoin return uses Assumptions even when account return differs',()=>{
 const p=plan();p.expenses=[];p.primary.lifeExpectancy=60;p.accounts=[{...btc(),expectedReturn:0.99}];p.assumptions.bitcoinReturn=0.1;
 near(projectCashflow(p).endingBalance,110000);
 const sampler=makeReturnSampler({...p,assumptions:{...p.assumptions,bitcoinVolatility:0}},createRng(12));near(sampler.sample(0,p.accounts).byAccountId!.bitcoin,0.1);
});
test('modeled price preview agrees with the projection',()=>{
 const p=plan();p.expenses=[];p.taxStrategy.athHarvestEnabled=false;p.accounts=[btc()];p.assumptions.bitcoinPricingModel='amalgam';
 const year=new Date().getFullYear(); const expected=scaledBitcoinModelPriceUsd('amalgam',calendarYearToModelDate(year+3),100000,calendarYearToModelDate(year))!;
 near(projectCashflow(p).years[2].bitcoinPriceUsd!,expected);
});
test('default amalgam is an equal-weight average of all six models',()=>{
 const date=calendarYearToModelDate(2026);
 const prices=AMALGAM_MODEL_IDS.map(id=>bitcoinModelPriceUsd(id,date)!);
 near(bitcoinModelPriceUsd('amalgam',date)!,prices.reduce((s,p)=>s+p,0)/prices.length);
});
test('amalgam mix can select and weight a subset of models',()=>{
 const date=calendarYearToModelDate(2026);
 const mix=[{id:'rainbow' as const,enabled:true,weight:2},{id:'halving' as const,enabled:true,weight:1}];
 const rainbow=bitcoinModelPriceUsd('rainbow',date)!;
 const halving=bitcoinModelPriceUsd('halving',date)!;
 near(bitcoinModelPriceUsd('amalgam',date,mix)!,(2*rainbow+halving)/3);
 assert.equal(amalgamMixId(mix),'amalgam:rainbow*2+halving*1');
});
test('projection follows a custom amalgam mix',()=>{
 const p=plan();p.expenses=[];p.taxStrategy.athHarvestEnabled=false;p.accounts=[btc()];
 p.assumptions.bitcoinPricingModel='amalgam';
 p.assumptions.bitcoinAmalgamMix=[{id:'rainbow',enabled:true,weight:2},{id:'halving',enabled:true,weight:1}];
 const year=new Date().getFullYear();
 const expected=scaledBitcoinModelPriceUsd('amalgam',calendarYearToModelDate(year+3),100000,calendarYearToModelDate(year),p.assumptions.bitcoinAmalgamMix)!;
 near(projectCashflow(p).years[2].bitcoinPriceUsd!,expected);
 const equal=scaledBitcoinModelPriceUsd('amalgam',calendarYearToModelDate(year+3),100000,calendarYearToModelDate(year))!;
 assert.ok(Math.abs(expected-equal)>1);
});
test('plans without an amalgam mix default to equal-weight all models',()=>{
 const raw=plan() as RetirementPlan & { assumptions: { bitcoinAmalgamMix?: unknown } };
 delete raw.assumptions.bitcoinAmalgamMix;
 const out=parseImportedPlan(JSON.stringify(raw));
 assert.equal(out.assumptions.bitcoinAmalgamMix!.length,6);
 assert.ok(out.assumptions.bitcoinAmalgamMix!.every(row=>row.enabled && row.weight===1));
});
test('capital-gains tax is continuous across a bracket boundary',()=>{
 const low=estimateSaleTax({proceeds:49450,balanceBefore:100000,costBasisUsd:0,type:'bitcoin',filing:'single',taxableIncome:0});
 const high=estimateSaleTax({proceeds:49451,balanceBefore:100000,costBasisUsd:0,type:'bitcoin',filing:'single',taxableIncome:0});
 assert.ok(high.net>low.net); near(high.tax-low.tax,0.15);
 const gross=grossForTargetNet({targetNet:50000,balance:100000,costBasisUsd:0,type:'bitcoin',filing:'single',taxableIncome:0,maxGross:100000});
 near(estimateSaleTax({proceeds:gross,balanceBefore:100000,costBasisUsd:0,type:'bitcoin',filing:'single',taxableIncome:0}).net,50000);
});
test('Social Security taxable income ramps gradually instead of jumping at thresholds',()=>{
 near(socialSecurityTaxableFraction('single',25001,20000)*20000,0.5);
 near(socialSecurityTaxableFraction('single',34001,20000)*20000,4500.85);
 near(socialSecurityTaxableFraction('married',32001,20000)*20000,0.5);
});
test('RMD surplus is preserved when no taxable account exists',()=>{
 const p=plan(); const accounts=[account('traditionalIra',100000)];
 const result=executeRmdPolicy(p,accounts,75,75,null,null,0);
 assert.ok(result.rmd>0);near(accounts.reduce((s,a)=>s+a.balance,0),100000);near(accounts.find(a=>a.type==='hysa')!.balance,result.surplus);
});
test('RMD is based on prior year balance, not current year growth',()=>{
 const p=plan();p.primary={...p.primary,currentAge:75,retirementAge:65,lifeExpectancy:75};p.accounts=[account('traditionalIra',100000,{expectedReturn:0.2})];p.expenses=[];
 near(projectCashflow(p).years[0].rmd,requiredMinimumDistribution(100000,75));
});
test('RMD reinvestment adds brokerage basis',()=>{
 const p=plan();const accounts=[account('traditionalIra'),account('brokerage',0,{costBasisUsd:0})];
 const out=executeRmdPolicy(p,accounts,75,75,null,null,0);near(accounts[1].costBasisUsd!,out.surplus);
});
test('Roth conversion preserves the source owner',()=>{
 const p=plan();p.taxStrategy.rothConversionPolicy='fillBracket';const accounts=[account('traditionalIra',10000,{owner:'spouse'}),account('hysa')];
 const out=performRothConversion(p,accounts,60,0,0,0,0,0);assert.ok(out.converted>0);near(accounts.find(a=>a.type==='rothIra'&&a.owner==='spouse')!.balance,out.converted);
});
test('custom Roth schedule cannot bypass zero bracket headroom',()=>{
 const p=plan();p.taxStrategy.rothConversionPolicy='customSchedule';p.taxStrategy.customConversionByYear=[{year:new Date().getFullYear(),amount:10000}];
 const accounts=[account('traditionalIra'),account('hysa')];const out=performRothConversion(p,accounts,60,0,0,1000000,0,0);assert.equal(out.converted,0);
});
test('projection horizon includes a younger spouse remaining lifetime',()=>{
 const p=plan();p.spouse={...createDefaultPerson(),currentAge:50,lifeExpectancy:90};p.filingStatus='married';
 assert.equal(projectCashflow(p).maxAge,100);
});
test('retirement stops earnings and contributions at the selected age',()=>{
 const p=plan();p.primary.retirementAge=61;p.primary.birthMonth=1;p.accounts[0].annualContribution=1000;p.income=[{id:'salary',label:'Salary',owner:'primary',annualAmount:30000,startAge:18,endAge:null,taxable:true,endsAtRetirement:true}];
 const result=projectCashflow(syncRetirementDerivedFields(p));assert.equal(result.years[0].income,30000);assert.equal(result.years[1].income,0);assert.equal(result.years[1].contributions,0);
});
test('real estate and other-asset costs feed projected spending',()=>{
 const p=plan();const home=createEmptyRealEstateProperty();home.propertyTaxAnnual=2000;home.insuranceAnnual=1000;
 const car=createEmptyOtherPersonalAsset();car.annualCost=1000;p.realEstate=[home];p.otherAssets=[car];
 near(projectCashflow(p).years[0].expenses,14000);
});
test('Medicare ends the insurance gap and harvest uses actual annual expenses',()=>{
 const p=plan();p.primary.currentAge=65;p.primary.lifeExpectancy=65;p.accounts=[btc()];p.assumptions.bitcoinHistoricalAthUsd=100000;p.taxStrategy.monthlyInsuranceUntilMedicare=1000;p.taxStrategy.athHarvestMaxSleeveFraction=1;p.taxStrategy.athHarvestBufferYears=1;
 const result=projectCashflow(p);near(result.years[0].expenses,10000);near(result.years[0].cryptoHarvestToCash,10000);
});
test('plan projections do not mutate input and remain finite across account types',()=>{
 const p=plan();p.accounts=['traditionalIra','rothIra','traditional401k','roth401k','brokerage','hysa','cd','bond','crypto','bitcoin','gold','silver'].map((type)=>account(type as Account['type']));const before=JSON.stringify(p);
 const out=projectCashflow(p);assert.equal(JSON.stringify(p),before);assert.ok(out.years.every(y=>Number.isFinite(y.portfolioTotal)&&y.portfolioTotal>=0));
 assert.ok(analyzeRamp(p));assert.equal(readyForProjection(p),true);
});
test('seeded Monte Carlo is reproducible with ordered percentiles and reconciled histogram',()=>{
 const p=plan();const opts={runs:100,seed:42,asOfDate:new Date('2026-09-13T12:00:00')};
 const a=runMonteCarloBatch(p,opts);const b=runMonteCarloBatch(p,opts);
 assert.deepEqual(a,b);assert.equal(a.runs,100);assert.equal(a.histogram.reduce((s,bin)=>s+bin.count,0),100);assert.ok(a.p10.every((n,i)=>n<=a.p50[i]&&a.p50[i]<=a.p90[i]));
});
test('async fallback produces identical results to synchronous Monte Carlo',async()=>{
 const p=plan();const opts={runs:100,seed:42,asOfDate:new Date('2026-09-13T12:00:00')};
 const a=runMonteCarloBatch(p,opts);const b=await runMonteCarloAsync(p,opts);assert.deepEqual(a,b);
});
test('fallback simulation cancellation settles the promise and a fresh run succeeds',async()=>{
 const p=plan();const pending=runMonteCarlo(p,{runs:1000,seed:1});cancelMonteCarlo();await assert.rejects(pending,{name:'AbortError'});
 assert.equal((await runMonteCarlo(p,{runs:100,seed:2})).runs,100);
});
test('export and import round-trip accounts, ATH settings and custom schedule',()=>{
 const p=plan();p.accounts=[btc()];p.taxStrategy.athHarvestNearAthFraction=.03;p.taxStrategy.athHarvestWindow='retirement';assert.deepEqual(parseImportedPlan(exportPlanJson(p)),p);
});
test('malformed imports fail before replacing a plan',()=>{
 for(const input of ['null','[]','{}',JSON.stringify({...plan(),accounts:{}}),JSON.stringify({...plan(),accounts:[null]}),JSON.stringify({...plan(),accounts:[account('bitcoin',-1)]}),JSON.stringify({...plan(),assumptions:{...plan().assumptions,bitcoinPricingModel:'unknown'}})]) assert.throws(()=>parseImportedPlan(input));
});
test('legacy imports get defaults for the new harvesting controls',()=>{
 const p:any=plan();p.schemaVersion=1;delete p.taxStrategy.athHarvestNearAthFraction;delete p.taxStrategy.athHarvestWindow;
 const out=parseImportedPlan(JSON.stringify(p));assert.equal(out.schemaVersion,2);assert.equal(out.taxStrategy.athHarvestNearAthFraction,.05);
});
test('storage failures propagate and corrupt stored JSON is not silently accepted',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{bad',setItem:()=>{throw new Error('Quota exceeded')},removeItem:()=>{}}});
 try {assert.throws(()=>savePlan(plan()),/Could not save/);assert.throws(()=>loadPlan());} finally {if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});
test('gold unit parsing converts grams and accepts troy ounces',()=>{near(parseGoldAmountToTroyOz('31.1034768g')!,1);near(parseGoldAmountToTroyOz('2 oz t')!,2);assert.equal(parseGoldAmountToTroyOz('invalid'),null);});
test('SSA history parses and delaying a claim increases the monthly benefit',()=>{
 const history=parseEarningsText('2023 50000\n2024 60000\n2025 65000');assert.equal(history.length,3);
 const base={currentAge:60,earningsHistory:history,futureWorkYears:0,futureAnnualEarnings:0};
 assert.ok(computePersonBenefits({...base,claimAge:70})!.claimAgeMonthly>computePersonBenefits({...base,claimAge:62})!.claimAgeMonthly);
});
test('RMD cohort ages stay consistent',()=>{assert.equal(rmdStartAge(66,2026),75);assert.equal(rmdStartAge(67,2026),73);});

test('federal taxes are funded from the portfolio and grossed up for traditional withdrawals',()=>{
 const p=plan();p.primary.lifeExpectancy=60;p.accounts=[account('traditionalIra',200000)];p.expenses[0].annualAmount=60000;
 const y=projectCashflow(p).years[0];assert.ok(y.estimatedTax>0);near(y.portfolioTotal,200000-60000-y.estimatedTax);assert.ok(y.events.some(e=>e.reason==='Federal tax payment'));
});
test('non-taxable income is not included in federal taxable wages',()=>{
 const p=plan();p.primary.lifeExpectancy=60;p.income=[{id:'gift',label:'Non-taxable income',annualAmount:60000,startAge:60,endAge:null,owner:'primary',taxable:false,endsAtRetirement:false}];
 const y=projectCashflow(p).years[0];assert.equal(y.income,60000);assert.equal(y.estimatedTax,0);
});
test('a single pension can continue after retirement and both spouses salaries can stop independently',()=>{
 const p=plan();p.income=[{id:'pension',label:'Pension',annualAmount:20000,startAge:60,endAge:null,owner:'primary',taxable:true,endsAtRetirement:false}];
 const synced=syncRetirementDerivedFields(p);assert.equal(projectCashflow(synced).years[0].income,20000);
 p.spouse={...createDefaultPerson(),currentAge:58,retirementAge:59,birthMonth:1};p.filingStatus='married';
 p.income=[{...p.income[0],id:'a',endsAtRetirement:true},{...p.income[0],id:'b',owner:'spouse',startAge:18,endsAtRetirement:true}];
 const both=syncRetirementDerivedFields(p);assert.ok(both.income.every(i=>i.endsAtRetirement));const out=projectCashflow(both);assert.equal(out.years[0].income,20000);assert.equal(out.years[1].income,0);
});
test('changing claim age refreshes an already calculated Social Security benefit',()=>{
 const p=plan();p.socialSecurity[0].earningsHistory=parseEarningsText('2024 50000\n2025 60000');p.socialSecurity[0].estimatedMonthlyBenefit=1;p.socialSecurity[0].claimAge=62;
 const early=syncRetirementDerivedFields(p).socialSecurity[0].estimatedMonthlyBenefit!;p.socialSecurity[0].claimAge=70;
 const late=syncRetirementDerivedFields(p).socialSecurity[0].estimatedMonthlyBenefit!;assert.ok(late>early);
});


test('2026 tax tables, inflation and IRMAA boundaries are consistent', () => {
 const base={filing:'single' as const,inflationFactor:1,wagesAndOtherIncome:66500,traditionalWithdrawals:0,rothConversion:0,rmd:0,socialSecurityGross:0,ltcgGains:0,collectiblesGains:0};
 const tax=computeAnnualTax(base);near(tax.taxableIncome,50400);near(tax.ordinaryTax,5800);near(tax.marginalOrdinaryRate,0.12);
 const inflated=computeAnnualTax({...base,inflationFactor:2,wagesAndOtherIncome:133000});near(inflated.ordinaryTax,11600);near(inflated.marginalOrdinaryRate,0.12);
 assert.equal(computeAnnualTax({...base,wagesAndOtherIncome:109000}).irmaaTier,0);
 assert.equal(computeAnnualTax({...base,wagesAndOtherIncome:109001}).irmaaTier,1);
 near(longTermCapitalGainsTax('single',49450,1000),150);
});

test('sequence risk rates count the complete retirement horizon and stay within 0–100%', async () => {
 const {computeSequenceRiskReport,aggregateSequenceRisk}=await import('./sequenceRisk');
 const p=plan();p.primary.lifeExpectancy=80;p.accounts=[account('brokerage',1000000,{costBasisUsd:1000000})];
 const report=computeSequenceRiskReport(projectCashflow(p),60);
 assert.equal(report.retiredYearCount,21);assert.equal(report.forcedSaleYears,21);
 const total=aggregateSequenceRisk([report,report]);near(total.forcedSaleYearRate,1);assert.ok(total.runwayExhaustionRate<=1);
});

test('optimizer uses matched paths when comparing unchanged savings plans', async () => {
 const {runRetirementOptimizer}=await import('./retirementOptimizer');
 const p=plan();p.primary.currentAge=70;p.primary.retirementAge=70;p.primary.lifeExpectancy=72;
 const out=await runRetirementOptimizer(p,{seed:72});
 assert.deepEqual(out.ages.map(a=>a.retirementAge),[70]);assert.equal(out.savingsRelevance?.deltaSuccessRate,0);assert.equal(out.seed,72);
});


test('Bitcoin without a spot price never mistakes its account-value index for the market ATH', () => {
 const p=plan();p.accounts=[account('bitcoin',100000)];p.taxStrategy.athHarvestWindow='retirement';p.taxStrategy.athHarvestMaxSleeveFraction=1;
 const out=projectCashflow(p);
 assert.ok(out.years.every(y=>!y.athHarvest));
});


test('harvest withholding reconciles to actual annual tax without destroying extra cash', () => {
 const p=plan();p.primary.lifeExpectancy=60;p.accounts=[btc(120000)];p.accounts[0].costBasisUsd=0;p.taxStrategy.athHarvestBufferYears=10;p.taxStrategy.athHarvestMaxSleeveFraction=1;
 const row=projectCashflow(p).years[0];
 const tax=row.events.find(e=>e.kind==='TaxEstimate');assert.ok(tax?.kind==='TaxEstimate');
 near(row.portfolioTotal,120000-row.expenses-tax.totalTax);
});

test('brokerage sales funding Roth conversion report their realized gains', () => {
 const p=plan();p.taxStrategy.rothConversionPolicy='fillBracket';p.accounts=[account('traditionalIra',100000),account('brokerage',100000,{costBasisUsd:0})];
 const out=performRothConversion(p,structuredClone(p.accounts),60,0,0,0,0,0);
 assert.ok(out.converted>0);assert.ok((out.taxFundingGains??0)>0);near(out.taxFundingGains??0,out.estimatedTax);
});

test('collectibles use unused standard deduction and a 28% maximum, not a flat minimum', () => {
 const tax=computeAnnualTax({filing:'single',inflationFactor:1,wagesAndOtherIncome:0,traditionalWithdrawals:0,rothConversion:0,rmd:0,socialSecurityGross:0,ltcgGains:0,collectiblesGains:26100});
 near(tax.collectiblesTax,1000);near(tax.totalTax,1000);
});


test('RAMP cancellation does not present a partial sample as a completed analysis', async () => {
 const {analyzeRampAveragePath}=await import('./rampAnalysis');let cancel=false;
 await assert.rejects(analyzeRampAveragePath(plan(),{runs:50,seed:1,onProgress:p=>{if(p.completed>0)cancel=true;},shouldCancel:()=>cancel}),{name:'AbortError'});
 const out=await analyzeRampAveragePath(plan(),{runs:50,seed:1});assert.equal(out.mcRuns,50);
});


test('SSA data uses published wage limits and indexes rather than outdated future guesses', async () => {
 const {getEarningsLimit,getNAWI,calculatePIA}=await import('./socialSecurity');
 assert.equal(getEarningsLimit(1980),25900);assert.equal(getEarningsLimit(2025),176100);assert.equal(getEarningsLimit(2026),184500);
 assert.ok(getEarningsLimit(2027)>184500);near(getNAWI(2024),69846.57);near(calculatePIA(1286).pia,1157.4);
});

test('SSA paste accepts currency formatting and does not count duplicate years twice', () => {
 assert.deepEqual(parseEarningsText('2023 $60,000.00\n2024,65000\n2023\t$62,000.00'),[{year:2023,amount:62000},{year:2024,amount:65000}]);
});

test('balanced trim sells overweight bitcoin versus the rest of the portfolio', () => {
 const p=plan();
 p.bitcoinStrategy.sellPolicy='allocationTrim';
 p.bitcoinStrategy.maxAltShareOfNonAlt=0.35;
 p.bitcoinStrategy.trimMaxSleeveFraction=0.08;
 p.bitcoinStrategy.trimWhenCashBelowYears=0;
 p.accounts=[btc(100000),account('brokerage',100000)];
 const accounts=structuredClone(p.accounts);
 const result=trimAltsToCash(p,accounts,60,0,0,0,10000);
 near(result.totalGross,8000);
 near(accounts.find(a=>a.type==='bitcoin')!.balance,92000);
 assert.ok(accounts.some(a=>a.type==='hysa' && a.balance>0));
});

test('balanced trim sells when HYSA is thin even far from ATH', () => {
 const p=plan();
 p.bitcoinStrategy.sellPolicy='allocationTrim';
 p.bitcoinStrategy.maxAltShareOfNonAlt=10;
 p.bitcoinStrategy.trimMaxSleeveFraction=0.08;
 p.bitcoinStrategy.trimWhenCashBelowYears=2;
 p.assumptions.bitcoinHistoricalAthUsd=100000;
 p.accounts=[account('bitcoin',20000,{assetUnits:1,spotPriceUsd:20000,costBasisUsd:20000}),account('brokerage',200000),account('hysa',0)];
 const accounts=structuredClone(p.accounts);
 const trim=trimAltsToCash(p,accounts,60,0,0,0,10000);
 near(trim.totalGross,1600);
 assert.equal(harvestAthAltsToCash(p,structuredClone(p.accounts),60,0,0,{bitcoin:100000},{bitcoin:1},0,10000).totalGross,0);
 const row=projectCashflow(p).years[0];
 assert.ok(row.altTrim);
 assert.equal(row.athHarvest,false);
 assert.ok(row.cryptoHarvestToCash>0);
});

test('default near-ATH playbook does not trim an overweight grind', () => {
 const p=plan();
 p.taxStrategy.athHarvestEnabled=false;
 p.accounts=[btc(100000),account('brokerage',100000),account('hysa',0)];
 assert.equal(trimAltsToCash(p,structuredClone(p.accounts),60,0,0,0,10000).totalGross,0);
 const out=projectCashflow(p);
 assert.ok(out.years.every(y=>!y.altTrim));
});

test('balanced trim anytime window can sell before retirement', () => {
 const p=plan();
 p.primary.currentAge=50; p.primary.retirementAge=60; p.primary.lifeExpectancy=50;
 p.bitcoinStrategy.sellPolicy='allocationTrim';
 p.bitcoinStrategy.trimWindow='anytime';
 p.bitcoinStrategy.trimWhenCashBelowYears=0;
 p.bitcoinStrategy.trimMaxSleeveFraction=0.08;
 p.accounts=[btc(100000),account('brokerage',100000)];
 assert.ok(trimAltsToCash(p,structuredClone(p.accounts),50,0,0,0,10000).totalGross>0);
 p.bitcoinStrategy.trimWindow='retirement';
 assert.equal(trimAltsToCash(p,structuredClone(p.accounts),50,0,0,0,10000).totalGross,0);
});

test('balanced trim does not sell when allocation and HYSA are on target', () => {
 const p=plan();
 p.bitcoinStrategy.sellPolicy='allocationTrim';
 p.bitcoinStrategy.maxAltShareOfNonAlt=0.35;
 p.bitcoinStrategy.trimWhenCashBelowYears=2;
 p.accounts=[btc(20000),account('brokerage',100000),account('hysa',50000)];
 assert.equal(trimAltsToCash(p,structuredClone(p.accounts),60,0,0,0,10000).totalGross,0);
});

test('allocation-trim playbook skips near-ATH harvest even at the peak', () => {
 assert.equal(harvest(100000,p=>{p.bitcoinStrategy.sellPolicy='allocationTrim';}).result.totalNet,0);
});

test('saved plans without bitcoinStrategy default to near-ATH harvest', () => {
 const raw=plan() as RetirementPlan & { bitcoinStrategy?: unknown };
 delete raw.bitcoinStrategy;
 const out=parseImportedPlan(JSON.stringify(raw));
 assert.equal(out.bitcoinStrategy.sellPolicy,'athHarvest');
 assert.equal(out.bitcoinStrategy.trimMaxSleeveFraction,0.08);
});

test('nominal spend at start uses current-age expenses and Medicare-gap insurance', () => {
 const p=plan();
 p.primary.currentAge=60; p.primary.retirementAge=60; p.primary.medicareStartAge=65; p.primary.lifeExpectancy=90;
 p.taxStrategy.monthlyInsuranceUntilMedicare=500;
 p.taxStrategy.monthlyMedicarePartB=200;
 p.expenses=[{id:'living',label:'Living',annualAmount:40000,retirementAnnualAmount:30000,startAge:18,endAge:null,category:'general'}];
 const start=nominalAnnualSpendAtAge(p,60);
 near(start.total,30000+6000);
 near(start.insurance,6000);
 assert.ok(start.lines.some((l)=>!l.upcoming && /Medicare-gap/.test(l.label) && Math.abs(l.amount-6000)<0.02));
 assert.ok(start.lines.some((l)=>l.upcoming && /Part B/.test(l.label) && Math.abs(l.amount-2400)<0.02));
 p.primary.currentAge=50; p.primary.retirementAge=60;
 const working=nominalAnnualSpendAtAge(p,50);
 near(working.total,40000);
 assert.equal(working.insurance,0);
 assert.ok(working.lines.some((l)=>l.upcoming && /Medicare-gap/.test(l.label)));
 assert.ok(working.lines.some((l)=>l.upcoming && /Part B/.test(l.label)));
});

test('Medicare Part B is an out-of-pocket expense after eligibility', () => {
 const p=plan();
 p.primary.currentAge=65; p.primary.retirementAge=65; p.primary.medicareStartAge=65; p.primary.lifeExpectancy=66;
 p.taxStrategy.monthlyInsuranceUntilMedicare=0;
 p.taxStrategy.monthlyMedicarePartB=200;
 p.expenses=[];
 const year0=projectCashflow(p).years[0];
 near(year0.expenses,2400);
});

test('ending-balance summary reports quartiles, mean and sample standard deviation', () => {
 const stats=summarizeEndingBalances([0,10,20,30,40]);
 near(stats.p25,10);
 near(stats.p50,20);
 near(stats.p75,30);
 near(stats.mean,20);
 near(stats.stdev,Math.sqrt(250),0.001);
});

test('bitcoin playbook summary names the selected sell policy', () => {
 const p=plan(); p.accounts=[btc()];
 p.bitcoinStrategy.sellPolicy='athAndTrim';
 const out=describeBitcoinSellPlaybook(p);
 assert.match(out.title,/Both/);
 assert.ok(out.details.some((line)=>/Near-ATH harvest/.test(line)));
 assert.ok(out.details.some((line)=>/Balanced trim/.test(line)));
});

test('liquidating bitcoin today splits net proceeds between HYSA and brokerage', () => {
 const p=plan();
 p.accounts=[btc(100000),account('brokerage',10000,{costBasisUsd:10000}),account('hysa',5000)];
 p.accounts[0].costBasisUsd=40000;
 const preview=previewBitcoinLiquidation(p,0.7);
 assert.equal(p.accounts.find(a=>a.type==='bitcoin')!.balance,100000);
 assert.ok(preview.gross>preview.net);
 near(preview.toHysa+preview.toBrokerage,preview.net);
 near(preview.toHysa,preview.net*0.7);
 const {plan:out,summary}=liquidateBitcoinToCash(p,0.7);
 const btcAcct=out.accounts.find(a=>a.type==='bitcoin')!;
 assert.equal(btcAcct.balance,0);
 assert.equal(btcAcct.assetUnits,0);
 const hysa=out.accounts.find(a=>a.type==='hysa')!;
 const brk=out.accounts.find(a=>a.type==='brokerage')!;
 near(hysa.balance,5000+summary.toHysa);
 near(brk.balance,10000+summary.toBrokerage);
 near(brk.costBasisUsd??0,10000+summary.toBrokerage);
 const year0=projectCashflow(out).years[0];
 near(year0.bitcoin,0);
});

test('liquidating bitcoin creates missing HYSA and brokerage destinations', () => {
 const p=plan();
 p.accounts=[btc(50000)];
 p.accounts[0].costBasisUsd=50000;
 const {plan:out,summary}=liquidateBitcoinToCash(p,0.4);
 near(summary.tax,0);
 near(summary.net,50000);
 assert.ok(out.accounts.some(a=>a.type==='hysa' && Math.abs(a.balance-20000)<0.02));
 assert.ok(out.accounts.some(a=>a.type==='brokerage' && Math.abs(a.balance-30000)<0.02));
});

test('Monte Carlo grid is a 6×6 cartesian product with two locked leftover axes', () => {
 const p=plan();
 p.primary.currentAge=50; p.primary.retirementAge=57;
 p.expenses[0].annualAmount=60000;
 p.socialSecurity[0].claimAge=67;
 const ages=retirementAgeGridValues(57,50);
 assert.deepEqual(ages,[55,56,57,58,59,60]);
 assert.deepEqual(retirementAgeGridValues(57,56),[56,57,58,59,60,61]);
 assert.deepEqual(retirementAgeGridValues(57,57),[57,58,59,60,61,62]);
 assert.deepEqual(retirementAgeGridValues(57,60),[60,61,62,63,64,65]);
 assert.deepEqual(spendGridTargets(60000),[45000,50000,55000,60000,65000,70000]);
 assert.deepEqual(ssClaimAgeGridValues(67),[65,66,67,68,69,70]);
 assert.deepEqual(ssClaimAgeGridValues(62),[62,63,64,65,66,67]);
 assert.deepEqual(ssClaimAgeGridValues(70),[65,66,67,68,69,70]);
 assert.deepEqual(ssClaimAgeGridValues(63),[62,63,64,65,66,67]);
 const lockedBtc=buildMonteCarloGrid(p,{inelastic:'bitcoin',lockedBitcoinId:'hold'});
 assert.equal(lockedBtc.cells.length,GRID_CELL_COUNT);
 assert.equal(lockedBtc.rowAxis,'retirementAge');
 assert.equal(lockedBtc.colAxis,'spend');
 assert.deepEqual(lockedBtc.locked.map((l)=>l.axis).sort(),['bitcoin','ssClaimAge']);
 assert.ok(lockedBtc.cells.every((c)=>c.scenario.bitcoinId==='hold'));
 assert.ok(lockedBtc.cells.every((c)=>c.scenario.ssClaimAge===67));
 assert.deepEqual([...new Set(lockedBtc.cells.map((c)=>c.scenario.retirementAge))].sort((a,b)=>a-b),ages);
 const lockedAge=buildMonteCarloGrid(p,{inelastic:'retirementAge'});
 assert.ok(lockedAge.cells.every((c)=>c.scenario.retirementAge===57));
 assert.equal(lockedAge.rowAxis,'bitcoin');
 assert.equal(lockedAge.rows.find((r)=>r.id==='sell-0')?.shortLabel,'Sell BTC - 100% HYSA 0% Brokerage');
 assert.equal(lockedAge.rows.find((r)=>r.id==='sell-100')?.shortLabel,'Sell BTC - 0% HYSA 100% Brokerage');
 assert.equal(new Set(lockedAge.cells.map((c)=>c.scenario.bitcoinId)).size,BITCOIN_GRID_CHOICES.length);
 const lockedSpend=buildMonteCarloGrid(p,{inelastic:'spend'});
 assert.ok(lockedSpend.cells.every((c)=>c.scenario.spendTarget===60000));
 const swapped=buildMonteCarloGrid(p,{rowAxis:'spend',colAxis:'retirementAge',lockedBitcoinId:'hold'});
 assert.equal(swapped.rowAxis,'spend');
 assert.equal(swapped.colAxis,'retirementAge');
 assert.equal(swapped.inelastic,'bitcoin');
 assert.ok(swapped.cells.every((c)=>c.scenario.bitcoinId==='hold'));
 const btcAge=buildMonteCarloGrid(p,{rowAxis:'bitcoin',colAxis:'retirementAge'});
 assert.equal(btcAge.inelastic,'spend');
 assert.ok(btcAge.cells.every((c)=>c.scenario.spendTarget===60000));
 const ssSpend=buildMonteCarloGrid(p,{rowAxis:'ssClaimAge',colAxis:'spend',lockedBitcoinId:'hold'});
 assert.equal(ssSpend.rowAxis,'ssClaimAge');
 assert.equal(ssSpend.colAxis,'spend');
 assert.ok(ssSpend.rows.find((r)=>r.id==='ss-67')?.isDefault);
 assert.ok(ssSpend.cells.every((c)=>c.scenario.retirementAge===57));
 assert.ok(ssSpend.cells.every((c)=>c.scenario.bitcoinId==='hold'));
 assert.deepEqual([...new Set(ssSpend.cells.map((c)=>c.scenario.ssClaimAge))].sort((a,b)=>a-b),ssClaimAgeGridValues(67));
 const currentSpendCol=lockedBtc.cols.find((c)=>c.id==='spend:0');
 near(currentSpendCol?.spendTotal??0,60000);
 assert.ok(currentSpendCol?.isDefault);
 assert.equal(lockedBtc.cols.filter((c)=>c.isDefault).length,1);
 assert.ok(lockedBtc.rows.find((r)=>r.id==='age-57')?.isDefault);
 assert.equal(lockedBtc.rows.filter((r)=>r.isDefault).length,1);
 assert.ok(currentSpendCol?.spendLines?.some((l)=>l.label==='Living' && Math.abs(l.amount-60000)<0.02));
 const lowSpendCol=lockedBtc.cols.find((c)=>c.id==='spend:-15000');
 near(lowSpendCol?.spendTotal??0,45000);
 assert.ok(lockedSpend.locked.find((l)=>l.axis==='spend')?.spendLines?.some((l)=>l.label==='Living'));
});

test('start-of-plan spend breakdown lists housing and named expenses', () => {
 const p=plan();
 p.primary.currentAge=50; p.primary.retirementAge=60; p.taxStrategy.monthlyInsuranceUntilMedicare=0;
 p.expenses=[
  {id:'living',label:'Living',annualAmount:40000,startAge:18,endAge:null,category:'general'},
  {id:'travel',label:'Travel',annualAmount:8000,startAge:18,endAge:null,category:'travel'},
 ];
 const home=createEmptyRealEstateProperty('primaryResidence');
 home.mortgagePaymentAnnual=12000; home.propertyTaxAnnual=3000; home.insuranceAnnual=1000;
 p.realEstate=[home];
 const out=nominalAnnualSpendAtAge(p,50);
 near(out.total,40000+8000+16000);
 near(out.housing,16000);
 assert.ok(out.lines.some((l)=>l.kind==='expense' && l.label==='Living' && Math.abs(l.amount-40000)<0.02));
 assert.ok(out.lines.some((l)=>l.kind==='expense' && l.label==='Travel' && Math.abs(l.amount-8000)<0.02));
 assert.ok(out.lines.some((l)=>l.kind==='housing' && /Housing/.test(l.label) && Math.abs(l.amount-16000)<0.02));
 assert.match(formatSpendBreakdown(out.lines,out.total),/Living/);
 assert.match(formatSpendBreakdown(out.lines,out.total),/Housing/);
});

test('grid spend targets reshape current-age expenses', () => {
 const p=plan();
 p.primary.currentAge=50; p.primary.retirementAge=60;
 p.expenses=[{id:'living',label:'Living',annualAmount:60000,retirementAnnualAmount:50000,startAge:18,endAge:null,category:'general'}];
 p.taxStrategy.monthlyInsuranceUntilMedicare=0;
 const out=applySpendTarget(p,45000);
 near(nominalAnnualSpendAtAge(out,50).total,45000);
 near(out.expenses[0].annualAmount,45000);
 near(out.expenses[0].retirementAnnualAmount??0,37500);
});

test('grid scenarios apply retirement age, spend, bitcoin sale, and SS claim age independently', () => {
 const p=plan();
 p.primary.currentAge=50; p.primary.retirementAge=57; p.primary.lifeExpectancy=90;
 p.accounts=[btc(100000),account('hysa',10000),account('brokerage',10000,{costBasisUsd:10000})];
 p.accounts[0].costBasisUsd=100000;
 p.expenses=[{id:'living',label:'Living',annualAmount:60000,startAge:18,endAge:null,category:'general'}];
 p.socialSecurity=[{...p.socialSecurity[0],owner:'primary',claimAge:67},{...p.socialSecurity[0],owner:'spouse',claimAge:64}];
 const hold=applyGridScenario(p,{bitcoinId:'hold',retirementAge:59,spendTarget:55000,ssClaimAge:70});
 assert.equal(hold.primary.retirementAge,59);
 assert.equal(hold.socialSecurity[0].futureWorkYears,9);
 assert.equal(hold.socialSecurity.find((s)=>s.owner==='primary')?.claimAge,70);
 assert.equal(hold.socialSecurity.find((s)=>s.owner==='spouse')?.claimAge,64);
 near(nominalAnnualSpendAtAge(hold,50).total,55000);
 assert.ok(hold.accounts.find((a)=>a.type==='bitcoin')!.balance>0);
 const sold=applyGridScenario(p,{bitcoinId:'sell-100',retirementAge:57,spendTarget:60000});
 assert.equal(sold.accounts.find((a)=>a.type==='bitcoin')!.balance,0);
 assert.ok(sold.accounts.find((a)=>a.type==='brokerage')!.balance>10000);
 assert.equal(p.accounts.find((a)=>a.type==='bitcoin')!.balance,100000);
 assert.equal(p.socialSecurity.find((s)=>s.owner==='primary')?.claimAge,67);
 assert.equal(primarySsClaimAge(p),67);
});

test('salary is prorated from today through the birth month in the retirement year', () => {
  const asOf = new Date(2026, 8, 13);
  const p = plan();
  p.primary.currentAge = 57;
  p.primary.retirementAge = 58;
  p.primary.lifeExpectancy = 90;
  p.primary.birthMonth = 5;
  p.accounts[0].annualContribution = 12000;
  p.income = [{
    id: 'salary',
    label: 'Salary',
    owner: 'primary',
    annualAmount: 255000,
    startAge: 18,
    endAge: null,
    taxable: true,
    endsAtRetirement: true,
  }];
  const yearMs2026 = new Date(2027, 0, 1).getTime() - new Date(2026, 0, 1).getTime();
  const yearMs2027 = new Date(2028, 0, 1).getTime() - new Date(2027, 0, 1).getTime();
  const frac2026 = (new Date(2027, 0, 1).getTime() - asOf.getTime()) / yearMs2026;
  const frac2027 = (new Date(2027, 4, 1).getTime() - new Date(2027, 0, 1).getTime()) / yearMs2027;
  near(remainingWorkYears(57, 58, 5, asOf), frac2026 + frac2027, 1e-9);
  near(workFractionInCalendarYear(57, 58, 5, asOf, 2026), frac2026, 1e-9);
  near(workFractionInCalendarYear(57, 58, 5, asOf, 2027), frac2027, 1e-9);
  assert.equal(workFractionInCalendarYear(57, 58, 5, asOf, 2028), 0);
  const out = projectCashflow(syncRetirementDerivedFields(p), { asOfDate: asOf });
  near(out.years[0].income, 255000 * frac2026, 0.5);
  near(out.years[1].income, 255000 * frac2027, 0.5);
  assert.equal(out.years[2].income, 0);
  near(out.years[0].contributions, 12000 * frac2026, 0.5);
  near(out.years[1].contributions, 12000 * frac2027, 0.5);
  assert.equal(out.years[2].contributions, 0);
});

test('already-retired ages produce no leftover salary even before the next birthday', () => {
  const asOf = new Date(2026, 0, 15);
  assert.equal(remainingWorkYears(58, 58, 5, asOf), 0);
  assert.equal(workFractionInCalendarYear(58, 58, 5, asOf, 2026), 0);
});

test('scenario story chapters cover Roth conversions, sales, and insurance', () => {
  const scenario: FailureCase = {
    kind: 'average',
    runIndex: 3,
    depletedAge: null,
    firstShortfallAge: null,
    endingBalance: 2_000_000,
    peakPortfolio: 2_100_000,
    peakAge: 70,
    maxDrawdownPct: 0.12,
    earlyRetirementCumulative: 0.2,
    earlyRetirementYears: 5,
    worstYear: { age: 62, portfolioReturn: -0.08 },
    bestYear: { age: 68, portfolioReturn: 0.18 },
    longestNegativeStreak: 1,
    recessionYears: 2,
    boomYears: 3,
    circumstances: ['Middle of the pack.'],
    timeline: [
      {
        age: 58,
        calendarYear: 2027,
        portfolio: 1_800_000,
        portfolioReturn: 0.07,
        marketReturn: 0.08,
        bitcoinReturn: null,
        cryptoReturn: null,
        goldReturn: null,
        silverReturn: null,
        marketContribution: 0.06,
        bitcoinContribution: 0,
        cryptoContribution: 0,
        goldContribution: 0,
        silverContribution: 0,
        withdrawal: 40000,
        shortfall: 0,
        expenses: 90000,
        incomePlusSs: 50000,
        contributions: 0,
        rmd: 0,
        rothConversion: 80000,
        estimatedTax: 18000,
        downYear: false,
        expenseCut: 0,
        spend: { general: 70000, travel: 5000, healthInsurance: 15000, total: 90000 },
        accountsStart: [
          { id: 'btc', type: 'bitcoin', label: 'Bitcoin', owner: 'primary', balanceUsd: 100000, units: 1, priceUsd: 100000 },
        ],
        accountsEnd: [
          { id: 'btc', type: 'bitcoin', label: 'Bitcoin', owner: 'primary', balanceUsd: 60000, units: 0.5, priceUsd: 120000 },
        ],
        events: [
          { kind: 'RothConversion', age: 58, calendarYear: 2027, policyId: 'roth', reason: 'Fill 22% bracket', amount: 80000, estimatedTax: 17600 },
          { kind: 'AthHarvestSale', age: 58, calendarYear: 2027, policyId: 'ath-harvest-policy', reason: 'Near ATH', accountId: 'btc', accountType: 'bitcoin', grossUsd: 60000, gainUsd: 10000, taxUsd: 1500, netUsd: 58500, unitsSold: 0.5, priceUsd: 120000 },
          { kind: 'Income', age: 58, calendarYear: 2027, policyId: 'engine', reason: 'Salary', amount: 50000, label: 'Salary' },
        ],
      },
    ],
  };
  const story = buildScenarioStory(scenario);
  assert.equal(story.chapters.length, 1);
  const text = [story.heading, ...story.intro, ...story.chapters[0]!.lines, ...story.closer].map((l) => typeof l === 'string' ? l : l.text).join('\n');
  assert.match(text, /Roth conversions moved/);
  assert.match(text, /traditional accounts into Roth/);
  assert.match(text, /0\.5 BTC/);
  assert.match(text, /\$120,000/);
  assert.match(text, /Health insurance premiums/);
  assert.match(text, /Salary/);
});

