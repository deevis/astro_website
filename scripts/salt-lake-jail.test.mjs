import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demographicSeries, lineChart, chargeBars, dateLabel } from '../src/components/salt-lake-jail/charts.mjs';

const data=JSON.parse(readFileSync(new URL('../public/articles/salt-lake-jail/data.json',import.meta.url),'utf8'));
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);

test('the static payload contains only the declared aggregate schema',()=>{
  assert.deepEqual(Object.keys(data).sort(),['article','edition','fields','runs','version']);
  assert.equal(data.runs.length,220);
  assert.equal(data.runs[0].date,'2023-06-03');
  assert.equal(data.runs.at(-1).date,'2026-02-24');
  assert.equal(data.article.coverage.first_absent_citizen,'2026-03-01');
  assert.equal(new Set(data.runs.map(r=>r.date)).size,220);
  for(const run of data.runs){assert.deepEqual(Object.keys(run).sort(),['alert','date','total']);assert.ok(Number.isInteger(run.total)&&run.total>0);}
  for(const field of Object.values(data.fields)){
    assert.deepEqual(Object.keys(field).sort(),['categories','counts','title']);
    for(const category of field.categories)assert.deepEqual(Object.keys(category).sort(),['key','kind','label']);
    assert.equal(new Set(field.categories.map(c=>c.key)).size,field.categories.length);
    assert.equal(field.counts.length,data.runs.length);
    field.counts.forEach((row,i)=>{
      assert.equal(row.length,field.categories.length);
      assert.ok(row.every(n=>Number.isInteger(n)&&n>=0));
      assert.equal(row.reduce((a,b)=>a+b,0),data.runs[i].total);
    });
  }
});

test('all published monthly citizenship and COB means reproduce from the exported counts',()=>{
  const specifications=[['citizen','label:VENEZUELA','venezuela_pct'],['citizen','label:UNITED STATES','us_pct'],['cob','label:VENEZUELA','venezuela_cob_pct']];
  for(const [field,focus,column] of specifications){
    const rows=demographicSeries(data,{field,focus});
    for(const month of data.article.months){
      const subset=rows.filter(r=>r.date.startsWith(month.month));
      if(!subset.length){assert.equal(month[column],null);continue;}
      assert.equal(month.runs,subset.length);
      near(mean(subset.map(r=>r.value)),month[column]);
    }
  }
});

test('Q4 comparisons weight months equally, rather than pooling unequal numbers of snapshots',()=>{
  for(const year of [2023,2024,2025]){
    const period=data.article.periods[`${year}_Q4`];
    for(const [focus,column] of [['UNITED STATES','us_pct'],['VENEZUELA','venezuela_pct'],['MEXICO','mexico_pct'],['HONDURAS','honduras_pct']]){
      const rows=demographicSeries(data,{focus:'label:'+focus,start:`${year}-10-01`,end:`${year}-12-31`});
      assert.equal(rows.length,period.runs);
      near(mean(['10','11','12'].map(m=>mean(rows.filter(r=>r.date.startsWith(`${year}-${m}`)).map(r=>r.value)))),period[column]);
    }
  }
});

test('exclusions change the denominator for both fields and preserve source totals',()=>{
  for(const field of ['citizen','cob']){
    const group=data.fields[field],us=group.categories.findIndex(c=>c.key==='label:UNITED STATES'),vz=group.categories.findIndex(c=>c.key==='label:VENEZUELA');
    const rows=demographicSeries(data,{field,excluded:['label:UNITED STATES'],quality:'all'});
    rows.forEach((row,i)=>{
      assert.equal(row.full,data.runs[i].total);
      assert.equal(row.excluded,group.counts[i][us]);
      assert.equal(row.remaining,row.full-row.excluded);
      assert.equal(row.matching,group.counts[i][vz]);
      near(row.value,row.matching/row.remaining*100);
    });
    const counts=demographicSeries(data,{field,measure:'count',excluded:['label:UNITED STATES'],quality:'all'});
    counts.forEach((row,i)=>assert.equal(row.value,rows[i].matching));
  }
});

test('empty populations, excluded focus labels, and empty date ranges are not zero-percent claims',()=>{
  const excluded=data.fields.citizen.categories.map(c=>c.key);
  assert.ok(demographicSeries(data,{excluded}).every(r=>r.value===null&&r.remaining===0));
  assert.ok(demographicSeries(data,{excluded:['label:VENEZUELA']}).every(r=>r.matching===null&&r.value===null));
  assert.deepEqual(demographicSeries(data,{start:'2026-03-01'}),[]);
  assert.match(lineChart([]),/No values/);
});

test('coverage controls omit exactly flagged rosters and retain a single-day selection',()=>{
  const screened=demographicSeries(data),all=demographicSeries(data,{quality:'all'});
  assert.equal(all.length-screened.length,2);
  assert.ok(screened.every(r=>!r.alert));
  const rows=demographicSeries(data,{start:'2026-02-24',end:'2026-02-24'});
  assert.equal(rows.length,1);
  assert.doesNotMatch(lineChart(rows),/NaN|Infinity/);
});

test('charts break missing months and long gaps without drawing invented zeros',()=>{
  const svg=lineChart(data.article.months.map(r=>({date:r.month+'-15',value:r.venezuela_pct})),{ceiling:3});
  assert.equal((svg.match(/<polyline /g)||[]).length,2);
  assert.equal((svg.match(/<g data-point=/g)||[]).length,32);
  assert.equal((lineChart([{date:'2025-01-01',value:1},{date:'2025-03-01',value:2}]).match(/<polyline /g)||[]).length,2);
  assert.equal(dateLabel('2025-01'),'Jan 2025');
  assert.doesNotMatch(lineChart([{date:'2025-01-01',value:1}],{label:'<script>bad</script>'}),/<script>/);
});

test('charge comparisons use combined distinct-booking shares, not the sum of descriptions',()=>{
  const later=data.article.charges.find(r=>r.yr===2025);
  assert.ok(later.pct<later.old_pct+later.new_pct);
  assert.match(chargeBars(data.article.charges,'pct'),/7\.49%/);
  assert.doesNotMatch(chargeBars(data.article.charges,'pct'),/New description:/);
  assert.match(chargeBars(data.article.charges,'all'),/0\.00%/);
});
