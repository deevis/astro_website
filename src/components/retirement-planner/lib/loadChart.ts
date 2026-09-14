/** Lazy-load Chart.js from CDN (avoids adding a package while install locks are flaky). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChartInstance = any;

const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Chart?: any;
  }
}

let loading: Promise<NonNullable<typeof window.Chart>> | null = null;

export async function loadChartJs() {
  if (typeof window !== 'undefined' && window.Chart) return window.Chart;
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    if (window.Chart) {
      resolve(window.Chart);
      return;
    }
    const script = document.createElement('script');
    script.src = CHART_CDN;
    script.async = true;
    script.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('Chart.js failed to load'));
    };
    script.onerror = () => { script.remove(); reject(new Error('Charts could not load. Check your connection and retry.')); };
    const timeout = setTimeout(() => { script.remove(); reject(new Error('Charts timed out. Check your connection and retry.')); }, 10000);
    script.addEventListener('load', () => clearTimeout(timeout));
    script.addEventListener('error', () => clearTimeout(timeout));
    document.head.appendChild(script);
  });

  try { return await loading; } catch (error) { loading = null; throw error; }
}
