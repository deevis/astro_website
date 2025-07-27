// Bitcoin Pricing Models - Real Calculations
// Based on actual equations and principles

class BitcoinPricingModels {
  constructor() {
    this.priceData = [];
    this.halvingDates = [
      { date: '2012-11-28', block: 210000, reward: 25 },
      { date: '2016-07-09', block: 420000, reward: 12.5 },
      { date: '2020-05-11', block: 630000, reward: 6.25 },
      { date: '2024-04-20', block: 840000, reward: 3.125 },
      { date: '2028-05-03', block: 1050000, reward: 1.5625 },
      { date: '2032-04-27', block: 1260000, reward: 0.78125 }
    ];
    
    // Constants
    this.BLOCKS_PER_DAY = 144;
    this.DAYS_PER_YEAR = 365.25;
    this.BLOCKS_PER_HALVING = 210000;
    this.GENESIS_DATE = new Date('2009-01-03');
  }

  async loadPriceData() {
    try {
      const response = await fetch('/bitcoin/price_data.csv');
      
      if (!response.ok) {
        throw new Error('Failed to load price data: ' + response.status);
      }
      
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      
      const allData = lines.slice(1).map(line => {
        const [date, price, source] = line.split(',');
        return {
          // Force UTC parsing by adding a time and Z-qualifier.
          // Using noon (12:00) avoids timezone-related "day off" errors.
          date: new Date(date + 'T12:00:00Z'),
          price: parseFloat(price),
          source
        };
      });
      
      // Filter to weekly data (every 7th day) to reduce data points
      this.priceData = allData.filter((_, index) => index % 7 === 0);
      
      return this.priceData;
    } catch (error) {
      console.error('Error loading price data:', error);
      return [];
    }
  }

  // Calculate Bitcoin supply at given date
  calculateSupply(date) {
    const daysSinceGenesis = (date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
    const blockHeight = Math.floor(daysSinceGenesis * this.BLOCKS_PER_DAY);
    
    let totalSupply = 0;
    let currentReward = 50;
    let blocksProcessed = 0;
    
    while (blocksProcessed < blockHeight) {
      const blocksToNextHalving = this.BLOCKS_PER_HALVING - (blocksProcessed % this.BLOCKS_PER_HALVING);
      const blocksToProcess = Math.min(blocksToNextHalving, blockHeight - blocksProcessed);
      
      totalSupply += blocksToProcess * currentReward;
      blocksProcessed += blocksToProcess;
      
      if (blocksProcessed % this.BLOCKS_PER_HALVING === 0) {
        currentReward /= 2;
      }
    }
    
    return totalSupply;
  }

  // Calculate annual flow (new supply per year)
  calculateAnnualFlow(date) {
    const daysSinceGenesis = (date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
    const blockHeight = Math.floor(daysSinceGenesis * this.BLOCKS_PER_DAY);
    
    const halvingsPassed = Math.floor(blockHeight / this.BLOCKS_PER_HALVING);
    const currentReward = 50 / Math.pow(2, halvingsPassed);
    
    return currentReward * this.BLOCKS_PER_DAY * this.DAYS_PER_YEAR;
  }

  // Stock-to-Flow Model
  calculateStockToFlow() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    // Process historical data
    for (const dataPoint of this.priceData) {
      const supply = this.calculateSupply(dataPoint.date);
      const annualFlow = this.calculateAnnualFlow(dataPoint.date);
      const stockToFlow = supply / annualFlow;
      
      // PlanB's S2F formula: ln(Price) = 3.3 * ln(S2F) - 1.7  
      const modelPrice = Math.exp(3.3 * Math.log(stockToFlow) - 1.7);
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        s2f: Math.max(modelPrice, 0.01)
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const supply = this.calculateSupply(futureDate);
      const annualFlow = this.calculateAnnualFlow(futureDate);
      const stockToFlow = supply / annualFlow;
      const modelPrice = Math.exp(3.3 * Math.log(stockToFlow) - 1.7);
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        s2f: Math.max(modelPrice, 0.01)
      });
    }
    
    return results;
  }

  // Power Law Model
  calculatePowerLaw() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    // Power law regression parameters (fitted to historical data)
    const a = 5.84; // slope
    const b = -17.01; // intercept
    const sigma = 0.4; // standard deviation
    
    for (const dataPoint of this.priceData) {
      const daysSinceGenesis = (dataPoint.date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const logDays = Math.log10(daysSinceGenesis);
      const logPrice = a * logDays + b;
      const modelPrice = Math.pow(10, logPrice);
      
      const upperRail = Math.pow(10, logPrice + 2 * sigma);
      const lowerRail = Math.pow(10, logPrice - 2 * sigma);
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        center: modelPrice,
        upper: upperRail,
        lower: lowerRail
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const daysSinceGenesis = (futureDate - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const logDays = Math.log10(daysSinceGenesis);
      const logPrice = a * logDays + b;
      const modelPrice = Math.pow(10, logPrice);
      
      const upperRail = Math.pow(10, logPrice + 2 * sigma);
      const lowerRail = Math.pow(10, logPrice - 2 * sigma);
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        center: modelPrice,
        upper: upperRail,
        lower: lowerRail
      });
    }
    
    return results;
  }

  // Rainbow Chart (Log Regression)
  calculateRainbowChart() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    // Rainbow chart parameters
    const slope = 5.8;
    const intercept = -17.3;
    const bandWidth = 0.5;
    
    for (const dataPoint of this.priceData) {
      const daysSinceGenesis = (dataPoint.date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const logDays = Math.log10(daysSinceGenesis);
      const logPrice = slope * logDays + intercept;
      const centerPrice = Math.pow(10, logPrice);
      
      const lowerBand = Math.pow(10, logPrice - 2 * bandWidth);
      const upperBand = Math.pow(10, logPrice + 2 * bandWidth);
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        center: centerPrice,
        lower: lowerBand,
        upper: upperBand
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const daysSinceGenesis = (futureDate - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const logDays = Math.log10(daysSinceGenesis);
      const logPrice = slope * logDays + intercept;
      const centerPrice = Math.pow(10, logPrice);
      
      const lowerBand = Math.pow(10, logPrice - 2 * bandWidth);
      const upperBand = Math.pow(10, logPrice + 2 * bandWidth);
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        center: centerPrice,
        lower: lowerBand,
        upper: upperBand
      });
    }
    
    return results;
  }

  // Metcalfe's Law (simplified - using transaction count as proxy)
  calculateMetcalfeLaw() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    // Metcalfe coefficient (fitted to historical data)
    const metcalfeCoeff = 0.0000000002;
    
    for (let i = 0; i < this.priceData.length; i++) {
      const dataPoint = this.priceData[i];
      
      // Estimate network users based on time (growing exponentially)
      const daysSinceGenesis = (dataPoint.date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const estimatedUsers = Math.pow(daysSinceGenesis / 365, 2.1) * 100000;
      
      // Metcalfe's law: Value proportional to users²
      const metcalfeValue = metcalfeCoeff * estimatedUsers * estimatedUsers;
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        metcalfe: Math.max(metcalfeValue, 0.01)
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const daysSinceGenesis = (futureDate - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const estimatedUsers = Math.pow(daysSinceGenesis / 365, 2.1) * 100000;
      const metcalfeValue = metcalfeCoeff * estimatedUsers * estimatedUsers;
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        metcalfe: Math.max(metcalfeValue, 0.01)
      });
    }
    
    return results;
  }

  // Halving Cycle Model
  calculateHalvingCycle() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    for (const dataPoint of this.priceData) {
      const daysSinceGenesis = (dataPoint.date - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const blockHeight = Math.floor(daysSinceGenesis * this.BLOCKS_PER_DAY);
      
      // Find current halving cycle
      const currentCycle = Math.floor(blockHeight / this.BLOCKS_PER_HALVING);
      const cycleProgress = (blockHeight % this.BLOCKS_PER_HALVING) / this.BLOCKS_PER_HALVING;
      
      // Cycle pattern: accumulation -> run-up -> peak -> crash
      let cycleFactor = 1;
      if (cycleProgress < 0.7) {
        // Accumulation phase
        cycleFactor = 1 + cycleProgress * 0.5;
      } else if (cycleProgress < 0.85) {
        // Run-up phase
        cycleFactor = 1.35 + (cycleProgress - 0.7) * 20;
      } else {
        // Peak and crash
        cycleFactor = 4.35 - (cycleProgress - 0.85) * 25;
      }
      
      // Base price grows with each cycle
      const basePriceGrowth = Math.pow(10, currentCycle * 1.5);
      const cyclePrice = basePriceGrowth * cycleFactor;
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        cycle: Math.max(cyclePrice, 0.01)
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const daysSinceGenesis = (futureDate - this.GENESIS_DATE) / (1000 * 60 * 60 * 24);
      const blockHeight = Math.floor(daysSinceGenesis * this.BLOCKS_PER_DAY);
      
      const currentCycle = Math.floor(blockHeight / this.BLOCKS_PER_HALVING);
      const cycleProgress = (blockHeight % this.BLOCKS_PER_HALVING) / this.BLOCKS_PER_HALVING;
      
      let cycleFactor = 1;
      if (cycleProgress < 0.7) {
        cycleFactor = 1 + cycleProgress * 0.5;
      } else if (cycleProgress < 0.85) {
        cycleFactor = 1.35 + (cycleProgress - 0.7) * 20;
      } else {
        cycleFactor = 4.35 - (cycleProgress - 0.85) * 25;
      }
      
      const basePriceGrowth = Math.pow(10, currentCycle * 1.5);
      const cyclePrice = basePriceGrowth * cycleFactor;
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        cycle: Math.max(cyclePrice, 0.01)
      });
    }
    
    return results;
  }

  // S2FX Cross-Asset Model
  calculateS2FX() {
    const results = [];
    const futureWeeks = 260; // 5 years * 52 weeks
    
    // S2FX phases based on market cap clusters
    const phases = [
      { minCap: 0, maxCap: 1e9, value: 1 },        // Phase 1: Proof of concept
      { minCap: 1e9, maxCap: 1e11, value: 100 },   // Phase 2: Payments
      { minCap: 1e11, maxCap: 1e13, value: 10000 }, // Phase 3: E-gold
      { minCap: 1e13, maxCap: 1e15, value: 1000000 }, // Phase 4: Financial asset
      { minCap: 1e15, maxCap: 1e17, value: 100000000 } // Phase 5: Store of value
    ];
    
    for (const dataPoint of this.priceData) {
      const supply = this.calculateSupply(dataPoint.date);
      const marketCap = dataPoint.price * supply;
      
      // Find current phase
      let currentPhase = phases[0];
      for (const phase of phases) {
        if (marketCap >= phase.minCap && marketCap < phase.maxCap) {
          currentPhase = phase;
          break;
        }
      }
      
      // S2FX value based on phase
      const s2fxValue = currentPhase.value;
      
      results.push({
        date: dataPoint.date,
        actual: dataPoint.price,
        s2fx: s2fxValue
      });
    }
    
    // Generate future predictions with consistent weekly intervals
    const lastDate = new Date(this.priceData[this.priceData.length - 1].date);
    for (let i = 1; i <= futureWeeks; i++) {
      // Add exactly 7 days * weeks to maintain consistent spacing
      const futureDate = new Date(lastDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
      
      const supply = this.calculateSupply(futureDate);
      const estimatedPrice = 300000; // Assume current phase value
      const marketCap = estimatedPrice * supply;
      
      let currentPhase = phases[phases.length - 1];
      for (const phase of phases) {
        if (marketCap >= phase.minCap && marketCap < phase.maxCap) {
          currentPhase = phase;
          break;
        }
      }
      
      results.push({
        date: new Date(futureDate),
        actual: null,
        s2fx: currentPhase.value
      });
    }
    
    return results;
  }

  // Main method to get model data
  async getModelData(modelName) {
    if (this.priceData.length === 0) {
      await this.loadPriceData();
    }
    
    switch (modelName) {
      case 'stockToFlow':
        return this.calculateStockToFlow();
      case 'powerLaw':
        return this.calculatePowerLaw();
      case 'rainbow':
        return this.calculateRainbowChart();
      case 'metcalfe':
        return this.calculateMetcalfeLaw();
      case 'halving':
        return this.calculateHalvingCycle();
      case 's2fx':
        return this.calculateS2FX();
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.BitcoinPricingModels = BitcoinPricingModels;
} 