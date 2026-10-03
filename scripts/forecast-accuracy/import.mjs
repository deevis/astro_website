/**
 * Import aggregate-only data from the standalone study. No DB access or npm changes.
 * Run: node scripts/forecast-accuracy/import.mjs [path/to/forecast-analysis]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { aggregateSummary, aggregateReport, assertAggregatePayload } from './aggregate-policy.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const source = path.resolve(process.argv[2] || path.join(project, '../forecast-analysis'));
const dist = path.join(source, 'dist');
const output = path.join(project, 'public/articles/forecast-accuracy');
const articleUrl = '/articles/a-nationwide-dive-into-forecasting-accuracy';
const read = name => fs.readFileSync(path.join(dist, name));
const json = name => JSON.parse(read(name));
const written = new Set();
const put = (name, contents) => {
  const dest = path.resolve(output, name);
  if (!dest.startsWith(output + path.sep)) throw new Error('Output escaped article directory');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents); written.add(dest);
};
const putJson = (name, data) => {
  assertAggregatePayload(data);
  put(name + '.gz', gzipSync(JSON.stringify(data), { level: 9 }));
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catalog = json('data/catalog.json');
if (!catalog.length || catalog.some(entry => entry.station.id === 80)) throw new Error('Missing summaries or duplicate Salt Lake City #80 included.');
if (new Set(catalog.map(c => c.release)).size !== 1) throw new Error('Station summary releases differ.');
const report = aggregateReport(json('data/cohort/station-outliers.json'));
const periods = json('data/cohort/state-map-periods.json');
if (JSON.stringify(report.comparison_station_ids) !== JSON.stringify(periods.comparison_station_ids) ||
    Object.entries(report.source_generations).some(([id, generation]) => periods.source_generations[id] !== generation)) throw new Error('Nationwide summaries are from different builds.');
if (Math.max(...catalog.map(c => Date.parse(c.last_date))) !== Date.parse(periods.cutoff)) throw new Error('Station and map cutoffs differ.');
if (JSON.stringify(catalog.map(c => c.station.id)) !== JSON.stringify(report.coverage.map(c => c.station.id))) throw new Error('Catalog and nationwide station inventory differ.');
// Only read station summaries. Never read or copy monthly pairs, audit logs or forecast bundles.
for (const entry of catalog) putJson(entry.files.summary, aggregateSummary(json(entry.files.summary)));
const slimCatalog = catalog.map(entry => ({ ...entry, files: { summary: entry.files.summary } }));
assertAggregatePayload(slimCatalog);
put('data/catalog.json', JSON.stringify(slimCatalog));
putJson('data/cohort/station-outliers.json', report);
putJson('data/cohort/state-map-periods.json', periods);
for (const file of ['station-outliers.csv', 'station-coverage.csv']) put('data/cohort/' + file, read('data/cohort/' + file));
put('data/cohort/METHODS.md', fs.readFileSync(path.join(here, 'METHODS.md')));
put('assets/us-states.json', read('assets/us-states.json'));
put('assets/study.css', read('assets/study.css'));
put('assets/frame.js', fs.readFileSync(path.join(here, 'frame.js')));

const { build } = await import(pathToFileURL(path.join(source, 'node_modules/esbuild/lib/main.js')).href);
const modulePath = name => JSON.stringify(path.join(here, name).replaceAll('\\', '/'));
const fetchImport = modulePath('snapshot-fetch.mjs');
const adapted = new Set(['static-data.mjs', 'state-map.mjs', 'stations.js', 'forecast_study_controller.js']);
const replaceRequired = (text, before, after) => {
  if (!text.includes(before)) throw new Error('Chart source changed; missing adapter target: ' + before.slice(0,80));
  return text.replace(before, after);
};
const plugin = {
  name: 'article-summary-data',
  setup(builder) {
    builder.onLoad({ filter: /\.(m?js)$/ }, args => {
      const basename = path.basename(args.path);
      if (basename === 'study-tools.mjs') return { contents: 'export function registerStudyTools() {}', loader: 'js' };
      if (!adapted.has(basename)) return;
      let contents = fs.readFileSync(args.path, 'utf8');
      if (basename === 'static-data.mjs') return {
        contents: 'import { snapshotFetch } from ' + fetchImport + '; async function json(url,signal){const r=await snapshotFetch(url,{signal});if(!r.ok)throw Error("Station summaries could not be loaded.");return r.json()} export const loadCatalog=signal=>json("data/catalog.json",signal);export const loadSummary=(entry,signal)=>json(entry.files.summary,signal);',
        loader: 'js', resolveDir: path.dirname(args.path)
      };
      if (basename === 'forecast_study_controller.js') {
        contents = replaceRequired(contents, 'loadCatalog, loadSummary, loadDay', 'loadCatalog, loadSummary');
        const start = contents.indexOf('  async inspect() {'), end = contents.indexOf('  inspectLargest()', start);
        if (start < 0 || end < 0) throw new Error('Day inspector adapter target missing');
        contents = contents.slice(0,start) + '  inspect() { renderDailyInspector(this, {HORIZONS, qualityMatches, sumRows, value}) }\n\n' + contents.slice(end);
        contents = replaceRequired(contents, '.files.audit', '.files.summary');
        contents = contents.replace('flagged input records across', 'flagged inputs counted across');
        return { contents: 'import { renderDailyInspector } from ' + modulePath('daily-inspector.mjs') + ';\n' + contents, loader: 'js', resolveDir: path.dirname(args.path) };
      }
      if (basename === 'stations.js') {
        const first = contents.indexOf("  $('extremes').innerHTML ="), last = contents.indexOf("  $('rank-title')", first);
        if (first < 0 || last < 0) throw new Error('Raw audit panel adapter target missing');
        contents = contents.slice(0,first) + "  $('extremes').textContent='Quality flags are summarized in these charts. Individual readings and source-record audit logs remain in the originating archive and are not distributed with this article.'\n" + contents.slice(last);
      }
      return { contents: 'import { snapshotFetch as fetch } from ' + fetchImport + ';\n' + contents, loader: 'js', resolveDir: path.dirname(args.path) };
    });
  }
};
for (const [input, out] of [['main.js', 'app.js'], ['stations.js', 'stations.js']]) {
  const outfile = path.join(output, 'assets', out);
  await build({ entryPoints: [path.join(source, 'src', input)], outfile,
    bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'linked', plugins: [plugin] });
  written.add(outfile); written.add(outfile + '.LEGAL.txt');
}
const banner = '<div class="article-snapshot-banner"><a data-article-back href="' + articleUrl + '">← Back to the article</a><span>Snapshot through ' + escape(periods.cutoff) + ' · All ' + catalog.length + ' station summaries · No individual forecast records</span><a href="dataset.html#scope">About this edition</a></div>';
for (const page of ['index.html', 'stations.html']) {
  let html = fs.readFileSync(path.join(source, 'src', page), 'utf8');
  html = html.replace('</head>', '<link rel="stylesheet" href="assets/article.css"><script defer src="assets/frame.js"></script></head>').replace('<body>', '<body>' + banner);
  html = html.replaceAll('data/cohort/STATION_OUTLIERS.md', 'data/cohort/METHODS.md');
  html = html.replace('Explore individual forecasts ↗', 'Explore station summaries ↗');
  if (page === 'index.html') {
    html = html.replace('Download exclusion audit ↓', 'Download station summaries ↓')
      .replace('Follow a day through the forecasts.', 'Compare the leads for a day.')
      .replace('Hourly values and the exact forecast selected for each target time.', 'Daily mean differences and sample counts across all six leads. Quality and sample settings apply.')
      .replace('Selected historical forecast and zero-hour reference by target hour', 'Daily mean forecast differences by nominal lead')
      .replace('Loading recorded forecasts…', 'Loading station summaries…');
  }
  put(page, html);
}
put('assets/article.css', '.article-snapshot-banner{display:flex;gap:18px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:14px 24px;border-bottom:1px solid #29374a;font-size:12px;color:#a3b2c5}.article-snapshot-banner a{color:#57dbc0}.article-embedded .study-heading,.article-embedded .study-introduction{display:none}.article-embedded .app-main{padding-top:24px}.article-embedded .article-snapshot-banner [data-article-back]{display:none}.snapshot-downloads{line-height:1.8}.snapshot-downloads a{color:#57dbc0}.snapshot-downloads h1{font-size:clamp(28px,4vw,42px)}.snapshot-downloads h2{font-size:22px;margin-top:30px}.snapshot-downloads .study-panel{margin-top:24px}.snapshot-downloads ul{padding-left:22px}@media(max-width:640px){.article-snapshot-banner{padding:12px 16px;gap:8px}}');
const download = (file, label) => '<li><a download href="' + escape(file) + '">' + escape(label) + '</a></li>';
const histories = catalog.map(entry => '<tr><td><a href="index.html?station=' + entry.station.id + '">' + escape(entry.station.name) + ', ' + escape(entry.station.state) + ' #' + entry.station.id + '</a></td><td>' + entry.first_date + ' – ' + entry.last_date + '</td><td>' + entry.pairs.toLocaleString('en-US') + '</td><td><a download href="' + escape(entry.files.summary) + '.gz">Summary JSON.gz</a></td></tr>').join('');
put('dataset.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forecast study · Summary dataset</title><link rel="stylesheet" href="assets/study.css"><link rel="stylesheet" href="assets/article.css"></head><body>' + banner +
  '<main class="app-main weather-study snapshot-downloads"><h1>The summary dataset</h1><p>Aggregate statistics through <strong>' + periods.cutoff + '</strong>. This page does not query a database.</p><p><a href="stations.html">Nationwide analysis</a> · <a href="index.html">All-station explorer</a></p><section id="scope"><h2>What is included?</h2><p>Daily difference statistics, coverage and quality counts for all ' + catalog.length + ' retained station histories, plus nationwide and map summaries. ' + report.comparison_station_ids.length + ' stations qualify for completed-year peer rankings. Duplicate Salt Lake City #80 is excluded.</p><p><strong>No original forecast data is distributed.</strong> This edition omits forecast temperatures, hourly pairs, prediction/reference IDs, forecast bundles and reading-level audit records, including raw examples embedded in the originating outlier report. The day inspector uses aggregate means and counts.</p><p>The published statistics preserve the full source summaries; dates are not randomly sampled or invented. Mean differences compare forecasts with stored near-term forecasts, not observations.</p></section><h2>Nationwide downloads</h2><ul>' +
  download('data/cohort/station-outliers.csv', 'All leads and quality views · CSV') +
  download('data/cohort/station-coverage.csv', 'Station coverage · CSV') +
  download('data/cohort/station-outliers.json.gz', 'Nationwide analytical summaries · JSON.gz') +
  download('data/cohort/state-map-periods.json.gz', 'Map periods and station-month summaries · JSON.gz') +
  download('data/cohort/METHODS.md', 'Methods and data scope · Markdown') +
  download('snapshot.json', 'Provenance, file sizes and SHA-256 hashes · JSON') +
  '</ul><h2>Every station</h2><p>Each file contains daily aggregates grouped by forecast lead, quality and common-hour cohort, plus calendar-hour coverage. The pair count describes inputs summarized, not individual records included in this download.</p><div class="study-table-scroll"><table class="study-table"><thead><tr><th>Station</th><th>Local date range</th><th>Pairs summarized</th><th>Download</th></tr></thead><tbody>' + histories + '</tbody></table></div><p>JSON.gz files are losslessly gzip-compressed; decompress with an archive utility to read the JSON. The interactive charts load each selected station on demand and decompress it automatically in a current browser. Local collection dates follow the station’s timezone.</p></main></body></html>');

// Article card artwork is an actual chart derived from the retained completed-year comparison.
const math = await import(pathToFileURL(path.join(source, 'src/lib/state-map-math.mjs')).href);
const states = math.aggregateStates(report.scenarios['strict-144'], report.coverage);
const geometry = json('assets/us-states.json');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">A nationwide dive into forecasting accuracy</title><desc id="desc">Mean absolute differences from the near-term forecast at six days, 33 shared months in 2023–2025. Brighter colors show larger differences.</desc><rect width="1200" height="675" fill="#0b1523"/><text x="52" y="64" fill="#57dbc0" font-family="sans-serif" font-size="17" letter-spacing="3">FORECASTS, IN HINDSIGHT</text><text x="52" y="112" fill="#e9f0f6" font-family="sans-serif" font-size="36" font-weight="600">A nationwide view</text><g transform="translate(80 118) scale(.85)">' + geometry.states.map(s => '<path d="' + s.path + '" fill="' + (math.stateColor(states.get(s.abbr)?.mad, 6) || '#253347') + '" stroke="#0b1523" stroke-width="1.5"/>').join('') + '</g><text x="52" y="646" fill="#a3b2c5" font-family="sans-serif" font-size="18">6 days ahead · mean absolute difference · 2023–2025 shared months</text></svg>';
const image = path.join(project, 'public/images/articles/forecast-accuracy.svg');
fs.mkdirSync(path.dirname(image), { recursive: true });
fs.writeFileSync(image, svg);
const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
  if (entry.isSymbolicLink()) throw new Error('Unexpected linked file in article assets');
  return entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)];
});
// Remove previous editions' raw files, not merely their links. Only this exact generated
// article directory is owned by the importer; source data and other site files are untouched.
if (fs.realpathSync(output).toLowerCase() !== path.resolve(project, 'public/articles/forecast-accuracy').toLowerCase()) throw new Error('Unexpected article output location');
let pruned = 0;
for (const file of walk(output)) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(output + path.sep)) throw new Error('Prune escaped article directory');
  if (!written.has(resolved) && path.basename(file) !== 'snapshot.json') { fs.unlinkSync(resolved); pruned++; }
}
const payloads = [...written].sort().map(file => {
  const bytes = fs.readFileSync(file);
  return { path: path.relative(output, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const snapshot = {
  schema_version: 2, release: catalog[0].release, cutoff: periods.cutoff, reference: 'Stored near-term forecast, not observations',
  summary_station_ids: catalog.map(s => s.station.id), nationwide_histories: report.coverage.length, comparison_stations: report.comparison_station_ids.length,
  source_predictions: report.source_predictions, pairs_summarized: catalog.reduce((n, s) => n + s.pairs, 0),
  individual_forecast_records_included: false,
  data_policy: 'All-station daily and nationwide aggregates only. No forecast temperatures, hourly pairs, reading-level audits, raw outlier examples, DB or private files.',
  generated_at: new Date().toISOString(), files: payloads, total_bytes: payloads.reduce((n, f) => n + f.bytes, 0)
};
put('snapshot.json', JSON.stringify(snapshot, null, 2));
console.log(JSON.stringify({ output: path.relative(project, output), stations: catalog.length, files: payloads.length + 1, bytes: snapshot.total_bytes, cutoff: periods.cutoff, obsolete_files_removed: pruned }, null, 2));
