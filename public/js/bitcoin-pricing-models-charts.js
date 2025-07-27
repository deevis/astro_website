// This script has been radically simplified to isolate and debug the chart hover issue.
// It removes all dependencies on the previous complex structure and uses a default configuration.

document.addEventListener('DOMContentLoaded', async () => {

  // Helper function to load scripts dynamically
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // --- Load Dependencies ---
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js');
    await loadScript('/js/bitcoin-pricing-models.js');
  } catch (error) {
    console.error("Failed to load chart dependencies. The chart cannot be rendered.", error);
    return;
  }

  // --- Target the S2F Chart Canvas ---
  const canvas = document.getElementById('s2fChart');
  if (!canvas) {
    // If the S2F chart isn't on the page, do nothing.
    return;
  }
  const ctx = canvas.getContext('2d');

  // --- Get and Verify Data ---
  const pricingModels = new BitcoinPricingModels();
  const modelData = await pricingModels.getModelData('stockToFlow');

  if (!modelData || modelData.length === 0) {
    console.error('No data was returned for the stockToFlow model. Chart cannot be rendered.');
    return;
  }

  console.log(`[Chart Script] Data received. Range: ${modelData[0].date.getFullYear()} to ${modelData[modelData.length - 1].date.getFullYear()}. Total points: ${modelData.length}`);

  // --- Create Chart with Simplified Configuration ---
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Actual BTC Price',
        data: modelData.map(d => ({ x: d.date, y: d.actual })),
        borderColor: '#3B82F6',
        spanGaps: false, // Do not connect gaps in the historical price data
      }, {
        label: 'S2F Model Price',
        data: modelData.map(d => ({ x: d.date, y: d.s2f })),
        borderColor: '#F59E0B',
        spanGaps: true, // Connect gaps for the continuous model price line
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'logarithmic',
        },
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'MMM dd, yyyy',
            // Let Chart.js automatically handle the display units
            unit: false
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
          }
        }
      },
      elements: {
        point: {
          radius: 0 // No points on the line for a cleaner look
        }
      },
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}); 