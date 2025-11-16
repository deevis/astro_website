// Bitcoin Pricing Models Charts with Tab Switching
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

  // Check if we're on the pricing models page
  const firstTabContent = document.querySelector('.tab-content');
  if (!firstTabContent) {
    return; // Not on the pricing models page
  }

  // Store chart instances
  const charts = {};
  const pricingModels = new BitcoinPricingModels();

  // Chart configuration mapping
  const chartConfigs = {
    's2f': {
      modelName: 'stockToFlow',
      canvasId: 's2fChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'S2F Model Price', key: 's2f', borderColor: '#F59E0B', spanGaps: true }
      ]
    },
    's2fx': {
      modelName: 's2fx',
      canvasId: 's2fxChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'S2FX Model Price', key: 's2fx', borderColor: '#F59E0B', spanGaps: true }
      ]
    },
    'powerlaw': {
      modelName: 'powerLaw',
      canvasId: 'plChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'Power-Law Upper', key: 'upper', borderColor: '#10B981', spanGaps: true },
        { label: 'Power-Law Mid', key: 'center', borderColor: '#F59E0B', spanGaps: true },
        { label: 'Power-Law Lower', key: 'lower', borderColor: '#EF4444', spanGaps: true }
      ]
    },
    'rainbow': {
      modelName: 'rainbow',
      canvasId: 'rainbowChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'Rainbow Upper', key: 'upper', borderColor: '#EF4444', spanGaps: true },
        { label: 'Rainbow Center', key: 'center', borderColor: '#F59E0B', spanGaps: true },
        { label: 'Rainbow Lower', key: 'lower', borderColor: '#10B981', spanGaps: true }
      ]
    },
    'metcalfe': {
      modelName: 'metcalfe',
      canvasId: 'metcalfeChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'Metcalfe Model', key: 'metcalfe', borderColor: '#F59E0B', spanGaps: true }
      ]
    },
    'halving': {
      modelName: 'halving',
      canvasId: 'halvingChart',
      datasets: [
        { label: 'Actual BTC Price', key: 'actual', borderColor: '#3B82F6', spanGaps: false },
        { label: 'Halving Cycle Model', key: 'cycle', borderColor: '#F59E0B', spanGaps: true }
      ]
    }
  };

  // Function to create a chart
  async function createChart(tabId) {
    if (charts[tabId]) {
      return; // Chart already created
    }

    const config = chartConfigs[tabId];
    if (!config) {
      console.warn(`No chart config found for tab: ${tabId}`);
      return;
    }

    const canvas = document.getElementById(config.canvasId);
    if (!canvas) {
      console.warn(`Canvas not found: ${config.canvasId}`);
      return;
    }

    try {
      const modelData = await pricingModels.getModelData(config.modelName);
      
      if (!modelData || modelData.length === 0) {
        console.error(`No data returned for model: ${config.modelName}`);
        return;
      }

      const ctx = canvas.getContext('2d');
      
      const chartData = {
        datasets: config.datasets.map(dataset => ({
          label: dataset.label,
          data: modelData
            .map(d => ({ x: d.date, y: d[dataset.key] }))
            .filter(d => d.y != null && !isNaN(d.y) && d.y > 0),
          borderColor: dataset.borderColor,
          backgroundColor: dataset.borderColor + '20',
          spanGaps: dataset.spanGaps,
          tension: 0.1
        }))
      };

      charts[tabId] = new Chart(ctx, {
        type: 'line',
        data: chartData,
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
              radius: 0
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
    } catch (error) {
      console.error(`Error creating chart for ${tabId}:`, error);
    }
  }

  // Tab switching functionality
  function switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    // Reset all buttons to inactive state
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active', 'border-blue-500', 'text-blue-600', 'dark:text-blue-400');
      button.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });

    // Show selected tab content
    const selectedContent = document.getElementById(`tab-${tabId}`);
    if (selectedContent) {
      selectedContent.classList.remove('hidden');
    }

    // Set clicked button to active state
    const clickedButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (clickedButton) {
      clickedButton.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'dark:hover:text-gray-200');
      clickedButton.classList.add('active', 'border-blue-500', 'text-blue-600', 'dark:text-blue-400');
    }

    // Initialize chart for this tab if not already created
    createChart(tabId);
  }

  // Set up tab button event listeners
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = button.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
      }
    });
  });

  // Initialize the default tab (s2f)
  const defaultTab = 's2f';
  switchTab(defaultTab);
});
