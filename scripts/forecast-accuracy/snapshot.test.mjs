import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { snapshotFetch } from './snapshot-fetch.mjs';
import { assertAggregatePayload, aggregateReport, aggregateSummary } from './aggregate-policy.mjs';
import { dailyLeadSummary } from './daily-inspector.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, 'public/articles/forecast-accuracy');
const source = path.resolve(process.env.FORECAST_ANALYSIS_ROOT || path.join(project, '../forecast-analysis'));
const original = path.join(source, 'dist');
const math = await import(pathToFileURL(path.join(source, 'src/lib/forecast_study_math.mjs')));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'snapshot.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json')));
const sourceCatalog = JSON.parse(fs.readFileSync(path.join(original, 'data/catalog.json')));
const read = name => fs.readFileSync(path.join(root, name));
const unpack = name => JSON.parse(gunzipSync(read(name + '.gz')));
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
test('all 70 stations and only manifested aggregate files are present', () => {
  assert.deepEqual(catalog.map(s => s.station.id), sourceCatalog.map(s => s.station.id));
  assert.equal(catalog.length, 70);
  assert.equal(catalog.some(s => s.station.id === 80), false);
  assert.deepEqual(manifest.summary_station_ids, catalog.map(s => s.station.id));
  assert.equal(manifest.individual_forecast_records_included, false);
  assert.equal(manifest.comparison_stations, 68);
  const files = walk(root).map(f=>path.relative(root,f).replaceAll('\\','/')).sort();
  assert.deepEqual(files,[...manifest.files.map(f=>f.path),'snapshot.json'].sort(),'No stale unlisted payloads');
  let bytes = 0;
  for (const file of manifest.files) {
    assert.ok(!file.path.includes('..') && !file.path.includes('\\'));
    assert.ok(!/(^|\/)(\.env|storage|node_modules|months)(\/|$)/.test(file.path));
    assert.ok(!/(pairs|outliers\.jsonl|extreme-inputs|STATION_OUTLIERS)/.test(file.path));
    const buffer = read(file.path);
    assert.equal(buffer.length, file.bytes, file.path);
    assert.equal(createHash('sha256').update(buffer).digest('hex'), file.sha256, file.path);
    bytes += buffer.length;
  }
  assert.equal(bytes, manifest.total_bytes);
  for (const entry of catalog) assert.deepEqual(Object.keys(entry.files), ['summary']);
});
test('every published JSON payload excludes original forecast fields', () => {
  for (const file of manifest.files.filter(f => /\.json(\.gz)?$/.test(f.path))) {
    const bytes = read(file.path);
    assertAggregatePayload(JSON.parse(file.path.endsWith('.gz') ? gunzipSync(bytes) : bytes), file.path);
  }
});
test('all station daily and coverage summaries match their complete source exports', () => {
  let total = 0;
  for (const entry of catalog) {
    const summary = unpack(entry.files.summary);
    const sourceSummary = JSON.parse(fs.readFileSync(path.join(original, entry.files.summary)));
    assert.deepEqual(summary.daily, sourceSummary.daily, entry.station.name + ' daily');
    assert.deepEqual(summary.coverage, sourceSummary.coverage, entry.station.name + ' coverage');
    assert.equal(summary.station.id, entry.station.id);
    assert.equal(summary.release, manifest.release);
    assert.equal(summary.first_date, entry.first_date);
    assert.equal(summary.last_date, entry.last_date);
    assert.ok(summary.last_date <= manifest.cutoff);
    const n = summary.daily.reduce((n,r)=>n+r.n,0);
    assert.equal(n, entry.pairs);
    total += n;
    assert.deepEqual([...new Set(summary.daily.map(r=>r.horizon))].sort((a,b)=>a-b), [24,48,72,96,120,144]);
  }
  assert.equal(total, manifest.pairs_summarized);
});
test('nationwide metrics survive removal of nested reading examples', () => {
  const report = unpack('data/cohort/station-outliers.json');
  const originalReport = JSON.parse(fs.readFileSync(path.join(original, 'data/cohort/station-outliers.json')));
  assert.deepEqual(report.scenarios, originalReport.scenarios);
  assert.deepEqual(report.coverage, originalReport.coverage);
  assert.deepEqual(report.comparison_station_ids, originalReport.comparison_station_ids);
  assert.ok(!('extreme_inputs' in report));
  assert.ok(!('quality_investigations' in report));
  assert.deepEqual(unpack('data/cohort/state-map-periods.json'), JSON.parse(fs.readFileSync(path.join(original,'data/cohort/state-map-periods.json'))));
});
test('export guard rejects individual readings, including nested examples', () => {
  assert.throws(()=>assertAggregatePayload({nested:{forecast:82}}),/Individual forecast/);
  assert.throws(()=>assertAggregatePayload({samples:[{reference_id:42}]}),/Individual forecast/);
  assert.throws(()=>aggregateSummary({daily:[{forecast:82}],coverage:[]}),/Unexpected daily field/);
  const report=aggregateReport({scenarios:{},extreme_inputs:{records:[{temperature_f:130}]},quality_investigations:[{largest_reference_z:[{prediction_id:42}]}]});
  assert.deepEqual(report,{scenarios:{}});
});
test('daily inspector preserves weighting, quality, common-hour and missing-data rules', () => {
  const date='2026-09-19';
  const data={daily:[
    {date,horizon:144,n:2,sum:4,absolute:6,squared:20,quality:'unflagged',common:true,common_quality:'suspect'},
    {date,horizon:144,n:1,sum:-5,absolute:5,squared:25,quality:'suspect',common:false,common_quality:'suspect'},
    {date,horizon:24,n:1,sum:2,absolute:2,squared:4,quality:'unflagged',common:true,common_quality:'unflagged'},
    {date:'2026-09-18',horizon:144,n:99,sum:99,absolute:99,squared:99,quality:'unflagged',common:true,common_quality:'unflagged'}
  ]};
  const strict=dailyLeadSummary(data,date,{quality:'strict',cohort:'available'},math);
  assert.deepEqual(strict[5],{horizon:144,n:2,total:3,excluded:1,absolute:3,bias:2,rms:Math.sqrt(10)});
  assert.equal(strict[1].absolute,null);
  const all=dailyLeadSummary(data,date,{quality:'all',cohort:'available'},math)[5];
  assert.equal(all.absolute,11/3);assert.equal(all.bias,-1/3);assert.equal(all.rms,Math.sqrt(15));
  assert.equal(dailyLeadSummary(data,date,{quality:'strict',cohort:'common'},math)[5].n,0);
  assert.equal(dailyLeadSummary(data,date,{quality:'all',cohort:'common'},math)[5].n,2);
  assert.equal(dailyLeadSummary(data,'2027-01-01',{quality:'all',cohort:'available'},math)[5].absolute,null);
});
test('every local HTML download, script and stylesheet resolves', () => {
  for (const file of ['index.html', 'stations.html', 'dataset.html']) {
    const html = read(file).toString();
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (/^(https?:|data:|#|\/)/.test(value)) continue;
      const url = value.split(/[?#]/)[0];
      if (!url) continue;
      const compressed = url.startsWith('data/') && /\.json$/.test(url) && url !== 'data/catalog.json';
      assert.ok(fs.existsSync(path.join(root, url + (compressed ? '.gz' : ''))), file + ': ' + url);
    }
  }
  for (const name of ['assets/app.js','assets/stations.js']) {
    assert.doesNotMatch(read(name).toString(),/prediction_id|reference_id|extreme-inputs\.json|outliers\.jsonl/);
  }
});
test('data loader handles static gzip, host-decoded assets and HTTP errors', async () => {
  const savedFetch = globalThis.fetch, payload = {station:1,counts:[1,2,3]};
  try {
    let called;
    globalThis.fetch = async url => { called=url; return new Response(gzipSync(JSON.stringify(payload))); };
    assert.deepEqual(await(await snapshotFetch('data/example.json')).json(),payload);
    assert.equal(called,'data/example.json.gz');
    globalThis.fetch = async()=>new Response(JSON.stringify(payload));
    assert.deepEqual(await(await snapshotFetch('data/example.json')).json(),payload);
    globalThis.fetch = async url=>{called=url;return new Response('{}');};
    await snapshotFetch('data/catalog.json');assert.equal(called,'data/catalog.json');
    globalThis.fetch = async()=>new Response('missing',{status:404});
    assert.equal((await snapshotFetch('data/missing.json')).status,404);
  } finally {globalThis.fetch=savedFetch;}
});
