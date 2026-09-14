// Chart.js tooltip/hover coordinates break when a parent uses CSS zoom
// (this site sets html { zoom: 0.8 } in Layout.astro). Chart.js computes
// event.x/y from offsetX, which Chrome reports in un-zoomed pixels, so the
// active point sits left of the cursor (~5 years on these charts).
//
// Patching Chart.helpers.getRelativePosition is not enough: the UMD build
// calls a closed-over copy. The supported workaround is a beforeEvent
// plugin that scales the already-computed event (Chart.js #7178).
(function installChartJsCssZoomHoverFix() {
  function pageCssZoom() {
    const raw = getComputedStyle(document.documentElement).zoom;
    const zoom = parseFloat(raw);
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  }

  function patch() {
    const Chart = window.Chart;
    if (!Chart || !Chart.register) return false;
    if (Chart.helpers && Chart.helpers.__cssZoomHoverPatched) return true;

    Chart.register({
      id: 'cssZoomHoverFix',
      beforeEvent(chart, args) {
        const event = args.event;
        if (!event || event.x == null || event.y == null) return;

        const zoom = pageCssZoom();
        if (zoom === 1) return;

        event.x = event.x / zoom;
        event.y = event.y / zoom;

        const area = chart.chartArea;
        if (area && args.inChartArea != null) {
          args.inChartArea =
            event.x >= area.left &&
            event.x <= area.right &&
            event.y >= area.top &&
            event.y <= area.bottom;
        }
      }
    });

    if (Chart.helpers) {
      Chart.helpers.__cssZoomHoverPatched = true;
    }
    return true;
  }

  if (patch()) return;

  const started = Date.now();
  const timer = setInterval(() => {
    if (patch() || Date.now() - started > 10000) {
      clearInterval(timer);
    }
  }, 20);
})();
