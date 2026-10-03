export function dailyLeadSummary(data, date, filters, math) {
  const day = data.daily.filter(row => row.date === date);
  return math.HORIZONS.map(horizon => {
    const all = day.filter(row => row.horizon === horizon);
    const kept = all.filter(row => math.qualityMatches(row, filters));
    const stats = math.sumRows(kept), total = math.sumRows(all).n;
    return { horizon, n: stats.n, total, excluded: total - stats.n,
      absolute: math.value(stats), bias: math.value(stats,'sum'), rms: math.value(stats,'squared') };
  });
}
export function renderDailyInspector(controller, math) {
  const data = controller.activeData?.[0], date = controller.dateTarget.value;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const rows = dailyLeadSummary(data, date, controller.filters, math);
  const selected = rows.find(row => row.horizon === controller.lead);
  controller.inspectNoteTarget.textContent = data.station.name + ' · ' + date + ' · ' + selected.n.toLocaleString() + ' included pairs at ' + controller.lead / 24 + 'd; ' + selected.excluded.toLocaleString() + ' excluded by quality or common-hour selection. Daily aggregates only; individual forecast temperatures are not included.';
  const format = value => value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const options = controller.options('Daily mean difference (°F)');
  options.plugins.legend = { display: true, labels: { color: '#a3b2c5' } };
  options.plugins.tooltip.callbacks.label = ctx => ctx.dataset.label + ': ' + format(ctx.parsed.y) + ' °F · ' + rows[ctx.dataIndex].n.toLocaleString() + ' pairs';
  controller.chart('hourly','bar',rows.map(row => row.horizon / 24 + 'd'),[
    { label: 'Mean absolute difference', data: rows.map(row => row.absolute), backgroundColor: '#57dbc0', borderRadius: 3 },
    { label: 'Signed warm / cool difference', data: rows.map(row => row.bias), backgroundColor: '#f4ad71', borderRadius: 3 }
  ],options);
  controller.hoursTableTarget.innerHTML = '<table class="study-table"><thead><tr><th>Lead</th><th>Included pairs</th><th>Excluded pairs</th><th>Mean absolute °F</th><th>Signed bias °F</th><th>RMS °F</th></tr></thead><tbody>' +
    rows.map(row => '<tr><td>' + row.horizon / 24 + 'd</td><td>' + row.n.toLocaleString() + '</td><td>' + row.excluded.toLocaleString() + '</td><td>' + format(row.absolute) + '</td><td>' + format(row.bias) + '</td><td>' + format(row.rms) + '</td></tr>').join('') + '</tbody></table>';
}
