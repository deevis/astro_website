// Fail closed if a source export introduces individual forecast records.
const forbidden = new Set(['forecast', 'temperature_f', 'temperatures_f', 'prediction_id', 'reference_id', 'forecast_id', 'forecast_ids', 'records', 'largest_reference_z', 'predictions', 'forecasts', 'time']);
export function assertAggregatePayload(value, location = 'payload') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.has(key) || (key === 'reference' && typeof item === 'number')) throw new Error('Individual forecast field at ' + location + '.' + key);
    assertAggregatePayload(item, location + '.' + key);
  }
}
const summaryKeys = ['station','method','policy','built_at','events','source_rows','screening','first_date','last_date','audit_count','daily','coverage','source','release'];
const dailyKeys = new Set(['n','sum','absolute','squared','warmer','cooler','equal','within2','within5','lead_sum','offsets','date','horizon','quality','common','common_quality']);
const coverageKeys = new Set(['date','expected','references','invalid_reference','candidates','invalid_pairs']);
export function aggregateSummary(source) {
  const result = Object.fromEntries(summaryKeys.map(key => [key, source[key]]));
  for (const [kind, keys] of [['daily',dailyKeys],['coverage',coverageKeys]]) {
    for (const row of result[kind]) for (const key of Object.keys(row)) if (!keys.has(key)) throw new Error('Unexpected ' + kind + ' field: ' + key);
  }
  assertAggregatePayload(result);
  return result;
}
export function aggregateReport(source) {
  // These two sections contain source-record examples, not just statistics.
  const { extreme_inputs, quality_investigations, ...result } = source;
  assertAggregatePayload(result);
  return result;
}
