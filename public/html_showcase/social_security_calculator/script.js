let earningsData = [];
let benefitChart = null;

// Social Security earnings limits and future projections
// Historical data up to 2024 from SSA.gov
// 2025-2029 projections based on SSA's intermediate assumptions from October 2023
// 2030-2040 projections calculated using historical 2.5% average annual increase
// Last updated: January 2024
const earningsLimits = {
    2040: 251700,
    2039: 245600,
    2038: 239600,
    2037: 233800,
    2036: 228100,
    2035: 222500,
    2034: 217100,
    2033: 211800,
    2032: 206600,
    2031: 201600,
    2030: 196800,
    2029: 192000,
    2028: 187200,
    2027: 182400,
    2026: 177600,
    2025: 172800,
    2024: 168600,
    2023: 160200,
    2022: 147000,
    2021: 142800,
    2020: 137700,
    2019: 132900,
    2018: 128400,
    2017: 127200,
    2016: 118500,
    2015: 118500,
    2014: 117000,
    2013: 113700,
    2012: 110100,
    2011: 106800,
    2010: 106800,
    2009: 106800,
    2008: 102000,
    2007: 97500,
    2006: 94200,
    2005: 90000,
    2004: 87900,
    2003: 87000,
    2002: 84900,
    2001: 80400,
    2000: 76200,
    1999: 72600,
    1998: 68400,
    1997: 65400,
    1996: 62700,
    1995: 61200,
    1994: 60600,
    1993: 57600,
    1992: 55500,
    1991: 53400,
    1990: 51300,
};

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    
    // Handle different onclick patterns for tabs
    const tabButton = document.querySelector(`button[onclick*="'${tabName}'"]`);
    if (tabButton) {
        tabButton.classList.add('active');
    }
}

function showTabIfEnabled(tabName) {
    const tabButton = document.getElementById(tabName + 'Tab');
    if (!tabButton.classList.contains('disabled')) {
        showTab(tabName);
    }
}

function enableTabs() {
    const resultsTab = document.getElementById('resultsTab');
    const comparisonTab = document.getElementById('comparisonTab');
    
    resultsTab.classList.remove('disabled');
    comparisonTab.classList.remove('disabled');
    
    // Update onclick handlers
    resultsTab.setAttribute('onclick', "showTab('results')");
    comparisonTab.setAttribute('onclick', "showTab('comparison')");
}

function getEarningsLimit(year) {
    return earningsLimits[year] || 51300;
}

function processInput() {
    const inputText = document.getElementById('csvInput').value.trim();
    const currentAge = parseInt(document.getElementById('currentAge').value);
    const futureWorkYears = parseInt(document.getElementById('futureWorkYears').value) || 0;
    const futureAnnualEarnings = parseFloat(document.getElementById('futureAnnualEarnings').value) || 0;

    if (!currentAge) {
        displayError('Please enter your current age');
        return;
    }

    if (!inputText) {
        displayError('Please enter earnings data');
        return;
    }

    // Split input text into lines
    const lines = inputText.split('\n');

    // Process existing data
    let processedData = lines.map(line => {
        let parts = line.includes('\t') ? line.split('\t') : line.split(',');
        
        const yearNum = parseInt(parts[0].trim());
        const earnings = parseFloat(parts[1].trim().replace(/[,$]/g, '')) || 0;
        const limit = getEarningsLimit(yearNum);
        
        return {
            year: yearNum,
            totalEarnings: earnings,
            earnings: Math.min(earnings, limit),
            limit: limit
        };
    });

    // Sort by year descending to get most recent years
    processedData.sort((a, b) => b.year - a.year);

    // If less than 35 years, fill in missing years with zeros
    if (processedData.length < 35) {
        const existingYears = new Set(processedData.map(d => d.year));
        const mostRecentYear = Math.max(...existingYears);
        
        // Fill backwards from most recent year until we have 35 years
        let currentYear = mostRecentYear;
        while (processedData.length < 35 && currentYear > 1950) {
            if (!existingYears.has(currentYear)) {
                processedData.push({
                    year: currentYear,
                    totalEarnings: 0,
                    earnings: 0,
                    limit: getEarningsLimit(currentYear)
                });
            }
            currentYear--;
        }
    }

    // Create base scenario
    const baseScenario = calculateScenario(processedData, "Current Earnings Only");
        
    // Create future earnings data
    let futureData = [];
    if (futureWorkYears > 0 && futureAnnualEarnings > 0) {
        const mostRecentYear = Math.max(...processedData.map(d => d.year));
        for (let i = 1; i <= futureWorkYears; i++) {
            const futureYear = mostRecentYear + i;
            const projectedLimit = projectFutureEarningsLimit(mostRecentYear, futureYear);
            futureData.push({
                year: futureYear,
                totalEarnings: futureAnnualEarnings,
                earnings: Math.min(futureAnnualEarnings, projectedLimit),
                limit: projectedLimit
            });
        }
    }

    // Create future scenario
    const futureScenario = calculateScenario([...processedData, ...futureData], 
        "Including Future Work");

    clearError();
    enableTabs();
    displayResults(baseScenario, futureScenario);
    showTab('results');
}

function calculateScenario(data, label) {
    // Sort by earnings and take top 35
    const earningsData = [...data].sort((a, b) => b.earnings - a.earnings);
    const aime = calculateAIME(earningsData);
    const {pia, breakdown} = calculatePIA(aime);
    const benefitsByAge = calculateBenefitsByAge(pia);
    
    return {
        label,
        earningsData,
        aime,
        pia,
        breakdown,
        benefitsByAge
    };
}

function displayError(message) {
    const errorDiv = document.getElementById('errorMessage') || createErrorDiv();
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function clearError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function createErrorDiv() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorMessage';
    errorDiv.style.color = 'red';
    errorDiv.style.marginTop = '10px';
    document.querySelector('.input-section').appendChild(errorDiv);
    return errorDiv;
}

function displayEarningsTable() {
    const top35 = earningsData.slice(0, 35);
    let tableHtml = '<h2>Top 35 Earning Years</h2>';
    if (earningsData.length < 35) {
        tableHtml += `<p class="note">Note: Only ${earningsData.length} years of earnings provided. 
                    Remaining years filled with $0 earnings for calculation purposes.</p>`;
    }
    tableHtml += '<table><tr><th>Year</th><th>Total Earnings</th><th>SS Eligible Earnings</th><th>Year Limit</th></tr>';
    
    top35.forEach(entry => {
        const overLimit = entry.totalEarnings > entry.limit;
        const totalClass = overLimit ? 'earnings-over-limit' : '';
        const zeroEarnings = entry.totalEarnings === 0 ? 'zero-earnings' : '';
        tableHtml += `<tr class="${zeroEarnings}">
            <td>${entry.year}</td>
            <td class="${totalClass}">$${entry.totalEarnings.toLocaleString()}</td>
            <td>$${entry.earnings.toLocaleString()}</td>
            <td>$${entry.limit.toLocaleString()}</td>
        </tr>`;
    });
    
    tableHtml += '</table>';
    document.getElementById('earningsTable').innerHTML = tableHtml;
}

function calculateAIME(earningsData) {
    const top35 = earningsData.slice(0, 35);
    const totalEarnings = top35.reduce((sum, entry) => sum + entry.earnings, 0);
    return totalEarnings / (35 * 12);
}

function calculatePIA(aime) {
    const bendPoint1 = 1115;
    const bendPoint2 = 6721;
    
    let pia = 0;
    let breakdown = [];
    
    if (aime <= bendPoint1) {
        pia = aime * 0.9;
        breakdown.push({range: `$0 to $${bendPoint1}`, amount: pia, percentage: "90%"});
    } else if (aime <= bendPoint2) {
        pia = (bendPoint1 * 0.9) + ((aime - bendPoint1) * 0.32);
        breakdown.push({range: `$0 to $${bendPoint1}`, amount: bendPoint1 * 0.9, percentage: "90%"});
        breakdown.push({range: `$${bendPoint1} to $${aime.toFixed(2)}`, amount: (aime - bendPoint1) * 0.32, percentage: "32%"});
    } else {
        pia = (bendPoint1 * 0.9) + ((bendPoint2 - bendPoint1) * 0.32) + ((aime - bendPoint2) * 0.15);
        breakdown.push({range: `$0 to $${bendPoint1}`, amount: bendPoint1 * 0.9, percentage: "90%"});
        breakdown.push({range: `$${bendPoint1} to $${bendPoint2}`, amount: (bendPoint2 - bendPoint1) * 0.32, percentage: "32%"});
        breakdown.push({range: `$${bendPoint2} to $${aime.toFixed(2)}`, amount: (aime - bendPoint2) * 0.15, percentage: "15%"});
    }
    
    return {pia, breakdown};
}


function calculateBenefitsByAge(pia) {
    const reductionRates = {
        62: 0.70,
        63: 0.75,
        64: 0.80,
        65: 0.867,
        66: 0.933,
        67: 1.00,
        68: 1.08,
        69: 1.16,
        70: 1.24
    };
    
    let benefits = {};
    for (let age = 62; age <= 70; age++) {
        benefits[age] = pia * reductionRates[age];
    }
    
    return benefits;
}

function generateAIMEDetails(scenario) {
    return `
        <p>Average Indexed Monthly Earnings (AIME): $${scenario.aime.toFixed(2)}</p>
        <p>Based on top 35 years of earnings</p>
        <p>Total indexed earnings: $${(scenario.aime * 35 * 12).toLocaleString()}</p>
    `;
}

function generatePIADetails(scenario) {
    let html = `<p>Primary Insurance Amount (PIA): $${scenario.pia.toFixed(2)}</p>`;
    html += '<table><tr><th>Earnings Range</th><th>Percentage</th><th>Amount</th></tr>';
    scenario.breakdown.forEach(tier => {
        html += `<tr>
            <td>${tier.range}</td>
            <td>${tier.percentage}</td>
            <td>$${tier.amount.toFixed(2)}</td>
        </tr>`;
    });
    html += '</table>';
    return html;
}

function generateBenefitsTable(scenario) {
    let html = '<table><tr><th>Retirement Age</th><th>Monthly Benefit</th><th>Adjustment</th></tr>';
    
    Object.entries(scenario.benefitsByAge).forEach(([age, benefit]) => {
        const adjustment = age < 67 ? "Reduction" : age > 67 ? "Increase" : "Full Retirement Age";
        html += `<tr>
            <td>${age}</td>
            <td>$${benefit.toFixed(2)}</td>
            <td>${adjustment}</td>
        </tr>`;
    });
    
    html += '</table>';
    return html;
}

function projectFutureEarningsLimit(baseYear, futureYear) {
    // First check if we have the year in our earningsLimits
    if (earningsLimits[futureYear]) {
        return earningsLimits[futureYear];
    }
    
    // If we don't have the year, use the latest known year as base
    const latestYear = Math.max(...Object.keys(earningsLimits).map(Number));
    const latestLimit = earningsLimits[latestYear];
    
    // Project forward using 2.5% annual increase from the latest known year
    const yearsOut = futureYear - latestYear;
    const projectedLimit = latestLimit * Math.pow(1.025, yearsOut);
    return Math.round(projectedLimit);
}

function calculateAndDisplayBenefits() {
    const aime = calculateAIME();
    const {pia, breakdown} = calculatePIA(aime);
    
    // Display AIME details
    document.getElementById('aimeDetails').innerHTML = `
        <p>Average Indexed Monthly Earnings (AIME): $${aime.toFixed(2)}</p>
        <p>Based on top 35 years of earnings</p>
        <p>Total indexed earnings: $${(aime * 35 * 12).toLocaleString()}</p>
    `;

    // Display PIA details
    let piaHtml = `<p>Primary Insurance Amount (PIA): $${pia.toFixed(2)}</p>`;
    piaHtml += '<table><tr><th>Earnings Range</th><th>Percentage</th><th>Amount</th></tr>';
    breakdown.forEach(tier => {
        piaHtml += `<tr>
            <td>${tier.range}</td>
            <td>${tier.percentage}</td>
            <td>$${tier.amount.toFixed(2)}</td>
        </tr>`;
    });
    piaHtml += '</table>';
    document.getElementById('piaDetails').innerHTML = piaHtml;

    // Calculate and display benefits by age
    const ages = Array.from({length: 9}, (_, i) => i + 62);
    const benefits = ages.map(age => ({
        age,
        benefit: calculateBenefitByAge(pia, age)
    }));

    let benefitTableHtml = '<table><tr><th>Retirement Age</th><th>Monthly Benefit</th><th>Adjustment</th></tr>';
    benefits.forEach(({age, benefit}) => {
        const adjustment = age < 67 ? "Reduction" : age > 67 ? "Increase" : "Full Retirement Age";
        benefitTableHtml += `<tr>
            <td>${age}</td>
            <td>$${benefit.toFixed(2)}</td>
            <td>${adjustment}</td>
        </tr>`;
    });
    benefitTableHtml += '</table>';
    document.getElementById('benefitTable').innerHTML = benefitTableHtml;

    // Update chart
    if (benefitChart) {
        benefitChart.destroy();
    }

    const ctx = document.getElementById('benefitChart').getContext('2d');
    benefitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ages,
            datasets: [{
                label: 'Monthly Benefit Amount',
                data: benefits.map(b => b.benefit),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Estimated Monthly Benefits by Retirement Age'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Monthly Benefit ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Retirement Age'
                    }
                }
            }
        }
    });
}

function displayResults(baseScenario, futureScenario) {
    // Get the values we need for the summary
    const currentAge = parseInt(document.getElementById('currentAge').value);
    const futureWorkYears = parseInt(document.getElementById('futureWorkYears').value) || 0;
    const futureAnnualEarnings = parseFloat(document.getElementById('futureAnnualEarnings').value) || 0;

    // Store the preferred scenario for break-even analysis
    // Use future scenario if it has meaningful future work, otherwise use base scenario
    const scenarioForBreakEven = futureWorkYears > 0 && futureAnnualEarnings > 0 ? futureScenario : baseScenario;
    storeScenarioData(scenarioForBreakEven);

    document.getElementById('results').innerHTML = `
        ${generateSummary(baseScenario, futureScenario, currentAge, futureWorkYears, futureAnnualEarnings)}
        ${generateTableExplanation()}
        <div class="scenario-comparison">
            <div class="scenario">
                <h3>${baseScenario.label}</h3>
                <div class="calculation-details">
                    <h4>Earnings Used in Calculation</h4>
                    ${generateEarningsTable(baseScenario.earningsData)}
                </div>
                <div class="calculation-details">
                    <h4>AIME Calculation</h4>
                    ${generateAIMEDetails(baseScenario)}
                </div>
                <div class="calculation-details">
                    <h4>PIA Calculation</h4>
                    ${generatePIADetails(baseScenario)}
                </div>
                <div class="calculation-details">
                    <h4>Monthly Benefits</h4>
                    ${generateBenefitsTable(baseScenario)}
                </div>
            </div>
            <div class="scenario">
                <h3>${futureScenario.label}</h3>
                <div class="calculation-details">
                    <h4>Earnings Used in Calculation</h4>
                    ${generateEarningsTable(futureScenario.earningsData)}
                </div>
                <div class="calculation-details">
                    <h4>AIME Calculation</h4>
                    ${generateAIMEDetails(futureScenario)}
                </div>
                <div class="calculation-details">
                    <h4>PIA Calculation</h4>
                    ${generatePIADetails(futureScenario)}
                </div>
                <div class="calculation-details">
                    <h4>Monthly Benefits</h4>
                    ${generateBenefitsTable(futureScenario)}
                </div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="benefitComparisonChart"></canvas>
        </div>
    `;

    displayComparisonChart(baseScenario, futureScenario);
}

function generateEarningsTable(earningsData) {
    // Sort by year descending
    const sortedData = [...earningsData].sort((a, b) => b.year - a.year);
    const top35 = sortedData.slice(0, 35);
    
    let html = '<table><tr><th>Year</th><th>Total Earnings</th><th>SS Eligible Earnings</th><th>Year Limit</th></tr>';
    
    top35.forEach(entry => {
        const overLimit = entry.totalEarnings > entry.limit;
        const totalClass = overLimit ? 'earnings-over-limit' : '';
        const zeroEarnings = entry.totalEarnings === 0 ? 'zero-earnings' : '';
        const futureYear = entry.year > new Date().getFullYear() ? 'future-year' : '';
        
        html += `<tr class="${zeroEarnings} ${futureYear}">
            <td>${entry.year}</td>
            <td class="${totalClass}">$${entry.totalEarnings.toLocaleString()}</td>
            <td>$${entry.earnings.toLocaleString()}</td>
            <td>$${entry.limit.toLocaleString()}</td>
        </tr>`;
    });
    
    html += '</table>';
    return html;
}


function displayComparisonChart(baseScenario, futureScenario) {
    const ctx = document.getElementById('benefitComparisonChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(baseScenario.benefitsByAge),
            datasets: [{
                label: baseScenario.label,
                data: Object.values(baseScenario.benefitsByAge),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: futureScenario.label,
                data: Object.values(futureScenario.benefitsByAge),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Benefits Comparison by Retirement Age'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Monthly Benefit ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Retirement Age'
                    }
                }
            }
        }
    });
}

function generateTableExplanation() {
    return `
        <div class="table-explanation">
            <h3>📊 Understanding Your Earnings Tables</h3>
            <div class="explanation-grid">
                <div class="explanation-item">
                    <span class="color-indicator red-indicator"></span>
                    <div class="explanation-text">
                        <strong>Red rows ($0 earnings):</strong> These years hurt your Social Security benefits because the system uses your highest 35 earning years. If you don't have 35 years of work, these $0 years are included in the calculation, lowering your average.
                    </div>
                </div>
                <div class="explanation-item">
                    <span class="color-indicator blue-indicator"></span>
                    <div class="explanation-text">
                        <strong>Blue rows (future years):</strong> These are projected earnings from your additional work years. They can replace some of your lowest earning years (including $0 years), potentially increasing your benefits.
                    </div>
                </div>
                <div class="explanation-item">
                    <span class="color-indicator normal-indicator"></span>
                    <div class="explanation-text">
                        <strong>Regular rows:</strong> Your actual historical earnings from your Social Security statement. The system ranks all years and uses the highest 35 for benefit calculations.
                    </div>
                </div>
            </div>
            <p class="key-insight"><strong>💡 Key Insight:</strong> Additional work years that earn more than your current lowest years (especially $0 years) will improve your Social Security benefits by raising your 35-year average.</p>
        </div>
    `;
}

// Add to script.js
function generateSummary(baseScenario, futureScenario, currentAge, futureWorkYears, futureAnnualEarnings) {
    const fraAmount = {
        base: baseScenario.benefitsByAge['67'],
        future: futureScenario.benefitsByAge['67']
    };
    
    // Calculate total additional indexed earnings
    const baseIndexedEarnings = baseScenario.aime * 35 * 12;
    const futureIndexedEarnings = futureScenario.aime * 35 * 12;
    const additionalEarnings = futureIndexedEarnings - baseIndexedEarnings;
    
    // Calculate monthly benefit difference
    const monthlyIncrease = fraAmount.future - fraAmount.base;
    
    return `
        <div class="summary-box">
            <p>If you were to keep working the next ${futureWorkYears} years, 
            from age ${currentAge} to age ${currentAge + futureWorkYears}, 
            and earned $${futureAnnualEarnings.toLocaleString()}/year, 
            you would accumulate an additional $${Math.round(additionalEarnings).toLocaleString()} 
            of indexed earnings, resulting in an additional $${monthlyIncrease.toFixed(2)}/month 
            at full retirement age ($${fraAmount.base.toFixed(2)} vs $${fraAmount.future.toFixed(2)}).</p>
        </div>
    `;
}

// Theme Toggle functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    // Check for saved theme preference or default to 'light'
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Break-even analysis functionality
let breakEvenChart = null;
let breakEvenChartFullscreen = null;
let currentScenarioData = null;
let lastChartData = null;

function generateBreakEvenAnalysis() {
    if (!currentScenarioData) {
        alert('Please calculate your benefits first in the "View Results" tab.');
        return;
    }

    const lifeExpectancy = parseInt(document.getElementById('lifeExpectancy').value);
    const colaRate = parseFloat(document.getElementById('colaRate').value) / 100;
    
    // Get investment parameters
    const enableInvestment = document.getElementById('enableInvestment').checked;
    const investmentPercentage = enableInvestment ? parseFloat(document.getElementById('investmentPercentage').value) / 100 : 0;
    const expectedYield = enableInvestment ? parseFloat(document.getElementById('expectedYield').value) / 100 : 0;
    
    // Get ages from input fields
    const selectedAges = [];
    for (let i = 1; i <= 4; i++) {
        const ageInput = document.getElementById(`compareAge${i}`);
        const age = parseInt(ageInput.value);
        if (age && age >= 62 && age <= 70 && !selectedAges.includes(age)) {
            selectedAges.push(age);
        }
    }
    
    if (selectedAges.length === 0) {
        alert('Please enter at least one valid retirement age between 62-70.');
        return;
    }

    // Sort ages for consistent display
    selectedAges.sort((a, b) => a - b);

    const analysisData = calculateBreakEvenData(selectedAges, lifeExpectancy, colaRate, investmentPercentage, expectedYield);
    displayBreakEvenChart(analysisData, selectedAges, lifeExpectancy, enableInvestment);
    displayBreakEvenSummary(analysisData, selectedAges, enableInvestment);
}

function calculateBreakEvenData(selectedAges, lifeExpectancy, colaRate, investmentPercentage = 0, expectedYield = 0) {
    const data = {};
    
    selectedAges.forEach(retirementAge => {
        const monthlyBenefit = currentScenarioData.benefitsByAge[retirementAge];
        const yearlyData = [];
        let cumulativeTotal = 0;
        let investmentBalance = 0;
        let totalInvested = 0;
        
        for (let age = retirementAge; age <= lifeExpectancy; age++) {
            const yearsFromStart = age - retirementAge;
            const adjustedMonthlyBenefit = monthlyBenefit * Math.pow(1 + colaRate, yearsFromStart);
            const yearlyAmount = adjustedMonthlyBenefit * 12;
            
            cumulativeTotal += yearlyAmount;
            
            // Calculate investment portion
            let yearlyInvestment = 0;
            if (investmentPercentage > 0) {
                // Amount invested this year
                yearlyInvestment = yearlyAmount * investmentPercentage;
                totalInvested += yearlyInvestment;
                
                // Grow existing investment balance
                investmentBalance = investmentBalance * (1 + expectedYield);
                
                // Add new investment (assuming invested throughout the year, so average growth of half a year)
                investmentBalance += yearlyInvestment * (1 + expectedYield / 2);
            }
            
            yearlyData.push({
                age: age,
                monthlyAmount: adjustedMonthlyBenefit,
                yearlyAmount: yearlyAmount,
                cumulativeTotal: cumulativeTotal,
                yearlyInvestment: yearlyInvestment,
                totalInvested: totalInvested,
                investmentBalance: investmentBalance,
                totalWithInvestments: cumulativeTotal + investmentBalance
            });
        }
        
        data[retirementAge] = yearlyData;
    });
    
    return data;
}

function displayBreakEvenChart(analysisData, selectedAges, lifeExpectancy, enableInvestment = false) {
    if (breakEvenChart) {
        breakEvenChart.destroy();
    }

    const ctx = document.getElementById('breakEvenChart').getContext('2d');
    const ages = [];
    for (let age = Math.min(...selectedAges); age <= lifeExpectancy; age++) {
        ages.push(age);
    }

    const datasets = [];
    
    // Generate colors dynamically for any number of ages
    const colorPalette = [
        { bar: 'rgba(255, 99, 132, 0.6)', line: 'rgb(255, 99, 132)', investment: 'rgb(255, 99, 132, 0.8)' },   // Red
        { bar: 'rgba(54, 162, 235, 0.6)', line: 'rgb(54, 162, 235)', investment: 'rgb(54, 162, 235, 0.8)' },   // Blue
        { bar: 'rgba(75, 192, 192, 0.6)', line: 'rgb(75, 192, 192)', investment: 'rgb(75, 192, 192, 0.8)' },   // Teal
        { bar: 'rgba(255, 206, 86, 0.6)', line: 'rgb(255, 206, 86)', investment: 'rgb(255, 206, 86, 0.8)' },   // Yellow
        { bar: 'rgba(153, 102, 255, 0.6)', line: 'rgb(153, 102, 255)', investment: 'rgb(153, 102, 255, 0.8)' }, // Purple
        { bar: 'rgba(255, 159, 64, 0.6)', line: 'rgb(255, 159, 64)', investment: 'rgb(255, 159, 64, 0.8)' }    // Orange
    ];
    
    const colors = {};
    selectedAges.forEach((age, index) => {
        colors[age] = colorPalette[index % colorPalette.length];
    });

    // Add bar datasets (yearly amounts)
    selectedAges.forEach(retirementAge => {
        const yearlyAmounts = ages.map(age => {
            const dataPoint = analysisData[retirementAge]?.find(d => d.age === age);
            return dataPoint ? dataPoint.yearlyAmount : 0;
        });

        datasets.push({
            type: 'bar',
            label: `Age ${retirementAge} - Yearly Amount`,
            data: yearlyAmounts,
            backgroundColor: colors[retirementAge].bar,
            borderColor: colors[retirementAge].line,
            borderWidth: 1,
            yAxisID: 'y'
        });
    });

    // Add line datasets (cumulative SS totals)
    selectedAges.forEach(retirementAge => {
        const cumulativeTotals = ages.map(age => {
            const dataPoint = analysisData[retirementAge]?.find(d => d.age === age);
            return dataPoint ? dataPoint.cumulativeTotal : null;
        });

        datasets.push({
            type: 'line',
            label: `Age ${retirementAge} - SS Only`,
            data: cumulativeTotals,
            borderColor: colors[retirementAge].line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.1,
            yAxisID: 'y1',
            pointRadius: 1,
            borderDash: enableInvestment ? [5, 5] : []
        });
    });

    // Add investment line datasets if enabled
    if (enableInvestment) {
        selectedAges.forEach(retirementAge => {
            const totalWithInvestments = ages.map(age => {
                const dataPoint = analysisData[retirementAge]?.find(d => d.age === age);
                return dataPoint ? dataPoint.totalWithInvestments : null;
            });

            datasets.push({
                type: 'line',
                label: `Age ${retirementAge} - With Investments`,
                data: totalWithInvestments,
                borderColor: colors[retirementAge].investment,
                backgroundColor: 'transparent',
                borderWidth: 4,
                tension: 0.1,
                yAxisID: 'y1',
                pointRadius: 2
            });
        });
    }

    const chartTitle = enableInvestment ? 
        'Social Security Benefits: With Investment Option' : 
        'Social Security Benefits: Yearly Amounts vs. Cumulative Totals';

    const chartConfig = {
        type: 'bar',
        data: {
            labels: ages,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Age ${tooltipItems[0].label}`;
                        },
                        label: function(context) {
                            // Return empty to suppress individual labels - we'll handle grouping in afterBody
                            return '';
                        },
                        afterBody: function(tooltipItems) {
                            // Group tooltip items by retirement age for better organization
                            let result = [];
                            
                            // Get unique retirement ages from dataset labels
                            const retirementAges = new Set();
                            tooltipItems.forEach(item => {
                                const match = item.dataset.label.match(/Age (\d+)/);
                                if (match) {
                                    retirementAges.add(parseInt(match[1]));
                                }
                            });
                            
                            // Group items by retirement age
                            Array.from(retirementAges).sort((a, b) => a - b).forEach(retAge => {
                                const ageItems = tooltipItems.filter(item => 
                                    item.dataset.label.includes(`Age ${retAge}`)
                                );
                                
                                if (ageItems.length > 0) {
                                    result.push(`--- Retire at Age ${retAge} ---`);
                                    ageItems.forEach(item => {
                                        const value = item.parsed.y !== null ? item.parsed.y : item.parsed.y1;
                                        const label = item.dataset.label.replace(`Age ${retAge} - `, '');
                                        result.push(`${label}: $${value.toLocaleString()}`);
                                    });
                                    result.push(''); // Add spacing between age groups
                                }
                            });
                            
                            // Remove last empty line
                            if (result[result.length - 1] === '') {
                                result.pop();
                            }
                            
                            return result;
                        }
                    }
                },
                title: {
                    display: true,
                    text: chartTitle
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Age'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Annual Benefit Amount ($)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Cumulative Total ($)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    };

    breakEvenChart = new Chart(ctx, chartConfig);

    // Store chart data for fullscreen view
    lastChartData = {
        config: JSON.parse(JSON.stringify(chartConfig)),
        title: chartTitle
    };
}

function displayBreakEvenSummary(analysisData, selectedAges, enableInvestment = false) {
    let summaryHtml = '<h3>Break-Even Analysis Summary <span class="info-icon" onclick="showBreakEvenInfo()" title="Click for break-even explanation">ℹ️</span></h3>';
    
    // Calculate break-even points (using appropriate totals based on investment status)
    const breakEvenPoints = [];
    
    // console.log('=== BREAK-EVEN DETECTION DEBUG ===');
    // console.log('Selected ages:', selectedAges);
    // console.log('Enable investment:', enableInvestment);
    // console.log('Analysis data keys:', Object.keys(analysisData));
    
    for (let i = 0; i < selectedAges.length - 1; i++) {
        for (let j = i + 1; j < selectedAges.length; j++) {
            const age1 = selectedAges[i];
            const age2 = selectedAges[j];
            const data1 = analysisData[age1];
            const data2 = analysisData[age2];
            
            // console.log(`\nComparing Age ${age1} vs Age ${age2}`);
            // console.log('Data1 length:', data1?.length || 'undefined');
            // console.log('Data2 length:', data2?.length || 'undefined');
            
            // Show the age ranges for each dataset
            // if (data1 && data1.length > 0) {
            //     console.log(`Age ${age1} data range: ${data1[0].age} to ${data1[data1.length-1].age}`);
            // }
            // if (data2 && data2.length > 0) {
            //     console.log(`Age ${age2} data range: ${data2[0].age} to ${data2[data2.length-1].age}`);
            // }
            
            if (!data1 || !data2) {
                // console.log('Missing data for one of the ages, skipping...');
                continue;
            }
            
            // Find where totals cross - compare by age, not by index
            const startAge = Math.max(age1, age2); // Start from when both are collecting
            const endAge = Math.min(data1[data1.length-1]?.age || 0, data2[data2.length-1]?.age || 0);
            
            for (let currentAge = startAge + 1; currentAge <= endAge; currentAge++) {
                const point1 = data1.find(d => d.age === currentAge);
                const point2 = data2.find(d => d.age === currentAge);
                const prevPoint1 = data1.find(d => d.age === currentAge - 1);
                const prevPoint2 = data2.find(d => d.age === currentAge - 1);
                
                // Use investment totals if enabled, otherwise SS only
                const total1Current = enableInvestment ? point1.totalWithInvestments : point1.cumulativeTotal;
                const total2Current = enableInvestment ? point2.totalWithInvestments : point2.cumulativeTotal;
                const total1Prev = enableInvestment ? prevPoint1.totalWithInvestments : prevPoint1.cumulativeTotal;
                const total2Prev = enableInvestment ? prevPoint2.totalWithInvestments : prevPoint2.cumulativeTotal;
                
                // Log detailed comparison for key ages
                // if (currentAge >= 75 && currentAge <= 85) {
                //     console.log(`Age ${currentAge}:`);
                //     console.log(`  Age ${age1} - Prev: $${total1Prev?.toLocaleString()}, Current: $${total1Current?.toLocaleString()}`);
                //     console.log(`  Age ${age2} - Prev: $${total2Prev?.toLocaleString()}, Current: $${total2Current?.toLocaleString()}`);
                // }
                
                // Check if lines crossed between previous and current points
                // We want to detect when the later retirement age (higher age) surpasses the earlier retirement age (lower age)
                let crossed = false;
                let crossoverAge = currentAge;
                
                if (age1 < age2) {
                    // age1 is earlier retirement, age2 is later retirement
                    // Look for when age2 (later) surpasses age1 (earlier)
                    crossed = (total2Prev <= total1Prev && total2Current > total1Current);
                    
                    // if (currentAge >= 75 && currentAge <= 85) {
                    //     console.log(`  Checking crossover: ${total2Prev} <= ${total1Prev} && ${total2Current} > ${total1Current} = ${crossed}`);
                    // }
                } else if (age1 > age2) {
                    // age2 is earlier retirement, age1 is later retirement  
                    // Look for when age1 (later) surpasses age2 (earlier)
                    crossed = (total1Prev <= total2Prev && total1Current > total2Current);
                    
                    // if (currentAge >= 75 && currentAge <= 85) {
                    //     console.log(`  Checking crossover: ${total1Prev} <= ${total2Prev} && ${total1Current} > ${total2Current} = ${crossed}`);
                    // }
                }
                
                if (crossed) {
                    // console.log(`*** CROSSOVER DETECTED at age ${currentAge} between ages ${age1} and ${age2} ***`);
                    
                    // Try to interpolate for more precise break-even age
                    try {
                        const diff1 = total1Current - total1Prev;
                        const diff2 = total2Current - total2Prev;
                        const prevGap = Math.abs(total1Prev - total2Prev);
                        const currentGap = Math.abs(total1Current - total2Current);
                        
                        if (prevGap + currentGap > 0) {
                            const ratio = prevGap / (prevGap + currentGap);
                            crossoverAge = Math.round(currentAge - 1 + ratio);
                        }
                    } catch (e) {
                        // Use current age if interpolation fails
                        crossoverAge = currentAge;
                    }
                    
                    breakEvenPoints.push({
                        age1: age1,
                        age2: age2,
                        breakEvenAge: crossoverAge,
                        amount1: total1Current,
                        amount2: total2Current
                    });
                }
                }
        }
    }
    
    // console.log('Final break-even points found:', breakEvenPoints.length);
    // console.log('Break-even points:', breakEvenPoints);
    
    if (breakEvenPoints.length > 0) {
        summaryHtml += `<h4>Break-Even Points${enableInvestment ? ' (Including Investments)' : ''}:</h4><ul>`;
        breakEvenPoints.forEach(point => {
            const earlierAge = Math.min(point.age1, point.age2);
            const laterAge = Math.max(point.age1, point.age2);
            summaryHtml += `<li><strong>Age ${earlierAge} vs Age ${laterAge}:</strong> Break-even at age ${point.breakEvenAge}<br>
                           <small>At this age, delaying retirement to ${laterAge} becomes more valuable than retiring at ${earlierAge}</small></li>`;
        });
        summaryHtml += '</ul>';
    } else {
        summaryHtml += '<p>No break-even points found within the selected life expectancy range.</p>';
        // console.log('Debug: No break-even points detected. Selected ages:', selectedAges, 'Enable investment:', enableInvestment);
    }
    
    // Add lifetime totals
    summaryHtml += '<h4>Lifetime Totals:</h4>';
    
    if (enableInvestment) {
        summaryHtml += '<table><tr><th>Retirement Age</th><th>SS Benefits Only</th><th>Investment Balance</th><th>Total with Investments</th></tr>';
        selectedAges.forEach(age => {
            const data = analysisData[age];
            const lastData = data[data.length - 1];
            const ssTotal = lastData?.cumulativeTotal || 0;
            const investmentBalance = lastData?.investmentBalance || 0;
            const totalWithInvestments = lastData?.totalWithInvestments || 0;
            
            summaryHtml += `<tr>
                <td>Age ${age}</td>
                <td>$${Math.round(ssTotal).toLocaleString()}</td>
                <td>$${Math.round(investmentBalance).toLocaleString()}</td>
                <td>$${Math.round(totalWithInvestments).toLocaleString()}</td>
            </tr>`;
        });
        summaryHtml += '</table>';
    } else {
        summaryHtml += '<ul>';
        selectedAges.forEach(age => {
            const data = analysisData[age];
            const lifetimeTotal = data[data.length - 1]?.cumulativeTotal || 0;
            summaryHtml += `<li>Retiring at age ${age}: $${Math.round(lifetimeTotal).toLocaleString()}</li>`;
        });
        summaryHtml += '</ul>';
    }
    
    document.getElementById('breakEvenSummary').innerHTML = summaryHtml;
    
    // Generate detailed data table
    generateDetailedDataTable(analysisData, selectedAges, enableInvestment);
}

function generateDetailedDataTable(analysisData, selectedAges, enableInvestment = false) {
    const lifeExpectancy = parseInt(document.getElementById('lifeExpectancy').value);
    
    // Get all years to display
    const startAge = Math.min(...selectedAges);
    const allAges = [];
    for (let age = startAge; age <= lifeExpectancy; age++) {
        allAges.push(age);
    }
    
    let tableHtml = '<h3>Detailed Year-by-Year Analysis</h3>';
    
    // Add context information
    tableHtml += generateAnalysisContext(selectedAges, enableInvestment);
    
    tableHtml += '<table class="data-table">';
    
    // Create header
    tableHtml += '<thead><tr>';
    tableHtml += '<th rowspan="2" class="year-cell">Age</th>';
    
    selectedAges.forEach(retirementAge => {
        const colSpan = enableInvestment ? 6 : 3;
        tableHtml += `<th colspan="${colSpan}" class="age-group-header">Retire at Age ${retirementAge}</th>`;
    });
    tableHtml += '</tr><tr>';
    
    selectedAges.forEach(retirementAge => {
        tableHtml += '<th>Monthly Amount</th>';
        tableHtml += '<th>Yearly Amount</th>';
        tableHtml += '<th>Total Collected</th>';
        if (enableInvestment) {
            tableHtml += '<th class="investment-value">Total Invested</th>';
            tableHtml += '<th class="investment-value">Investment Balance</th>';
            tableHtml += '<th class="total-value">Total Value</th>';
        }
    });
    tableHtml += '</tr></thead>';
    
    // Create body
    tableHtml += '<tbody>';
    allAges.forEach(age => {
        tableHtml += '<tr>';
        tableHtml += `<td class="year-cell">${age}</td>`;
        
        selectedAges.forEach(retirementAge => {
            const data = analysisData[retirementAge];
            const yearData = data?.find(d => d.age === age);
            
            if (yearData && age >= retirementAge) {
                tableHtml += `<td class="monetary-value">$${Math.round(yearData.monthlyAmount).toLocaleString()}</td>`;
                tableHtml += `<td class="monetary-value">$${Math.round(yearData.yearlyAmount).toLocaleString()}</td>`;
                tableHtml += `<td class="monetary-value">$${Math.round(yearData.cumulativeTotal).toLocaleString()}</td>`;
                
                if (enableInvestment) {
                    tableHtml += `<td class="monetary-value investment-value">$${Math.round(yearData.totalInvested).toLocaleString()}</td>`;
                    tableHtml += `<td class="monetary-value investment-value">$${Math.round(yearData.investmentBalance).toLocaleString()}</td>`;
                    tableHtml += `<td class="monetary-value total-value">$${Math.round(yearData.totalWithInvestments).toLocaleString()}</td>`;
                }
            } else {
                // Before retirement age for this scenario
                const colSpan = enableInvestment ? 6 : 3;
                tableHtml += `<td colspan="${colSpan}" style="background-color: #f8f9fa; color: #6c757d; text-align: center;">Not yet retired</td>`;
            }
        });
        
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    document.getElementById('detailedDataTable').innerHTML = tableHtml;
}

function generateAnalysisContext(selectedAges, enableInvestment) {
    const currentAge = parseInt(document.getElementById('currentAge').value) || 0;
    const futureWorkYears = parseInt(document.getElementById('futureWorkYears').value) || 0;
    const futureAnnualEarnings = parseFloat(document.getElementById('futureAnnualEarnings').value) || 0;
    const lifeExpectancy = parseInt(document.getElementById('lifeExpectancy').value);
    const colaRate = parseFloat(document.getElementById('colaRate').value);
    const investmentPercentage = enableInvestment ? parseFloat(document.getElementById('investmentPercentage').value) : 0;
    const expectedYield = enableInvestment ? parseFloat(document.getElementById('expectedYield').value) : 0;

    let contextHtml = '<div class="analysis-context">';
    contextHtml += '<h4>Analysis Parameters & Assumptions</h4>';
    contextHtml += '<div class="context-grid">';
    
    // Basic parameters
    contextHtml += '<div class="context-section">';
    contextHtml += '<strong>Analysis Settings:</strong><br>';
    contextHtml += `• Life Expectancy: ${lifeExpectancy} years<br>`;
    contextHtml += `• Annual COLA: ${colaRate}%<br>`;
    contextHtml += `• Retirement Ages Compared: ${selectedAges.join(', ')}<br>`;
    contextHtml += '</div>';
    
    // Personal situation
    if (currentAge > 0) {
        contextHtml += '<div class="context-section">';
        contextHtml += '<strong>Personal Situation:</strong><br>';
        contextHtml += `• Current Age: ${currentAge}<br>`;
        
        if (futureWorkYears > 0) {
            contextHtml += `• Additional Work Years: ${futureWorkYears} (until age ${currentAge + futureWorkYears})<br>`;
            if (futureAnnualEarnings > 0) {
                contextHtml += `• Expected Annual Earnings: $${futureAnnualEarnings.toLocaleString()}<br>`;
            }
        }
        contextHtml += '</div>';
    }
    
    // Monthly benefits at each age
    if (currentScenarioData && selectedAges.length > 0) {
        contextHtml += '<div class="context-section">';
        contextHtml += '<strong>Monthly Benefits:</strong><br>';
        selectedAges.forEach(age => {
            const monthlyBenefit = currentScenarioData.benefitsByAge[age];
            contextHtml += `• Age ${age}: $${Math.round(monthlyBenefit).toLocaleString()}/month<br>`;
        });
        contextHtml += '</div>';
    }
    
    // Investment strategy
    if (enableInvestment) {
        contextHtml += '<div class="context-section">';
        contextHtml += '<strong>Investment Strategy:</strong><br>';
        contextHtml += `• Investment Rate: ${investmentPercentage}% of each SS payment<br>`;
        contextHtml += `• Expected Return: ${expectedYield}% annually<br>`;
        contextHtml += '</div>';
    }
    
    contextHtml += '</div>'; // Close context-grid
    contextHtml += '</div>'; // Close analysis-context
    
    return contextHtml;
}

// Store scenario data when results are calculated
function storeScenarioData(scenario) {
    currentScenarioData = scenario;
}

// Investment toggle functionality
function initializeInvestmentToggle() {
    const enableInvestmentCheckbox = document.getElementById('enableInvestment');
    const investmentInputs = document.getElementById('investmentInputs');
    
    enableInvestmentCheckbox.addEventListener('change', () => {
        if (enableInvestmentCheckbox.checked) {
            investmentInputs.style.display = 'block';
        } else {
            investmentInputs.style.display = 'none';
        }
    });
}

// Full screen chart functionality
function initializeChartMaximize() {
    const maximizeBtn = document.getElementById('maximizeChart');
    const chartModal = document.getElementById('chartModal');
    const closeBtn = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalChartTitle');

    maximizeBtn.addEventListener('click', () => {
        if (lastChartData) {
            modalTitle.textContent = lastChartData.title;
            chartModal.style.display = 'block';
            
            // Small delay to ensure modal is visible before creating chart
            setTimeout(() => {
                createFullscreenChart();
            }, 100);
        }
    });

    closeBtn.addEventListener('click', () => {
        closeFullscreenChart();
    });

    // Close modal when clicking outside
    chartModal.addEventListener('click', (e) => {
        if (e.target === chartModal) {
            closeFullscreenChart();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chartModal.style.display === 'block') {
            closeFullscreenChart();
        }
    });
}

function createFullscreenChart() {
    if (breakEvenChartFullscreen) {
        breakEvenChartFullscreen.destroy();
    }

    const ctx = document.getElementById('breakEvenChartFullscreen').getContext('2d');
    
    // Create a deep copy of the config to ensure tooltips work properly
    const fullscreenConfig = JSON.parse(JSON.stringify(lastChartData.config));
    
    // Ensure tooltip configuration is applied
    if (!fullscreenConfig.options.plugins.tooltip) {
        fullscreenConfig.options.plugins.tooltip = {};
    }
    
    fullscreenConfig.options.plugins.tooltip.callbacks = {
        title: function(tooltipItems) {
            return `Age ${tooltipItems[0].label}`;
        },
        label: function(context) {
            // Return empty to suppress individual labels - we'll handle grouping in afterBody
            return '';
        },
        afterBody: function(tooltipItems) {
            // Group tooltip items by retirement age for better organization
            let result = [];
            
            // Get unique retirement ages from dataset labels
            const retirementAges = new Set();
            tooltipItems.forEach(item => {
                const match = item.dataset.label.match(/Age (\d+)/);
                if (match) {
                    retirementAges.add(parseInt(match[1]));
                }
            });
            
            // Group items by retirement age
            Array.from(retirementAges).sort((a, b) => a - b).forEach(retAge => {
                const ageItems = tooltipItems.filter(item => 
                    item.dataset.label.includes(`Age ${retAge}`)
                );
                
                if (ageItems.length > 0) {
                    result.push(`--- Retire at Age ${retAge} ---`);
                    ageItems.forEach(item => {
                        const value = item.parsed.y !== null ? item.parsed.y : item.parsed.y1;
                        const label = item.dataset.label.replace(`Age ${retAge} - `, '');
                        result.push(`${label}: $${value.toLocaleString()}`);
                    });
                    result.push(''); // Add spacing between age groups
                }
            });
            
            // Remove last empty line
            if (result[result.length - 1] === '') {
                result.pop();
            }
            
            return result;
        }
    };
    
    breakEvenChartFullscreen = new Chart(ctx, fullscreenConfig);
    
    // Generate info panel
    generateChartInfoPanel();
}

function generateChartInfoPanel() {
    const currentAge = parseInt(document.getElementById('currentAge').value) || 0;
    const futureWorkYears = parseInt(document.getElementById('futureWorkYears').value) || 0;
    const futureAnnualEarnings = parseFloat(document.getElementById('futureAnnualEarnings').value) || 0;
    const lifeExpectancy = parseInt(document.getElementById('lifeExpectancy').value);
    const colaRate = parseFloat(document.getElementById('colaRate').value);
    const enableInvestment = document.getElementById('enableInvestment').checked;
    const investmentPercentage = enableInvestment ? parseFloat(document.getElementById('investmentPercentage').value) : 0;
    const expectedYield = enableInvestment ? parseFloat(document.getElementById('expectedYield').value) : 0;

    // Get selected ages
    const selectedAges = [];
    for (let i = 1; i <= 4; i++) {
        const ageInput = document.getElementById(`compareAge${i}`);
        const age = parseInt(ageInput.value);
        if (age && age >= 62 && age <= 70 && !selectedAges.includes(age)) {
            selectedAges.push(age);
        }
    }
    selectedAges.sort((a, b) => a - b);

    let infoHtml = '<h4>Analysis Assumptions</h4>';

    // Personal Information
    if (currentAge > 0) {
        infoHtml += '<div class="info-section">';
        infoHtml += '<div class="info-label">Current Age:</div>';
        infoHtml += `<div class="info-value">${currentAge}</div>`;
        infoHtml += '</div>';
    }

    // Future work plans
    if (futureWorkYears > 0) {
        infoHtml += '<div class="info-section">';
        infoHtml += '<div class="info-label">Additional Work Years:</div>';
        infoHtml += `<div class="info-value">${futureWorkYears} years (until age ${currentAge + futureWorkYears})</div>`;
        infoHtml += '</div>';

        if (futureAnnualEarnings > 0) {
            infoHtml += '<div class="info-section">';
            infoHtml += '<div class="info-label">Expected Annual Earnings:</div>';
            infoHtml += `<div class="info-value">$${futureAnnualEarnings.toLocaleString()}</div>`;
            infoHtml += '</div>';
        }
    }

    // Benefits at each age
    if (currentScenarioData && selectedAges.length > 0) {
        infoHtml += '<div class="info-section">';
        infoHtml += '<div class="info-label">Monthly Benefits at Each Age:</div>';
        selectedAges.forEach(age => {
            const monthlyBenefit = currentScenarioData.benefitsByAge[age];
            infoHtml += `<div class="benefit-breakdown">Age ${age}: $${Math.round(monthlyBenefit).toLocaleString()}/month</div>`;
        });
        infoHtml += '</div>';
    }

    // Analysis parameters
    infoHtml += '<div class="info-section">';
    infoHtml += '<div class="info-label">Analysis Parameters:</div>';
    infoHtml += `<div class="info-value">Life Expectancy: ${lifeExpectancy}</div>`;
    infoHtml += `<div class="info-value">Annual COLA: ${colaRate}%</div>`;
    infoHtml += '</div>';

    // Investment details
    if (enableInvestment) {
        infoHtml += '<div class="info-section">';
        infoHtml += '<div class="info-label">Investment Strategy:</div>';
        infoHtml += `<div class="info-value">${investmentPercentage}% of each SS payment invested</div>`;
        infoHtml += `<div class="info-value">Expected annual return: ${expectedYield}%</div>`;
        infoHtml += '</div>';
    }

    document.getElementById('chartInfoPanel').innerHTML = infoHtml;
}

// Main info modal functionality
function showMainInfo() {
    const modal = document.getElementById('mainInfoModal');
    modal.style.display = 'block';
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMainInfo();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', handleMainInfoEscapeKey);
}

function closeMainInfo() {
    const modal = document.getElementById('mainInfoModal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleMainInfoEscapeKey);
}

function handleMainInfoEscapeKey(e) {
    if (e.key === 'Escape') {
        closeMainInfo();
    }
}

// Break-even info modal functionality
function showBreakEvenInfo() {
    const modal = document.getElementById('breakEvenInfoModal');
    modal.style.display = 'block';
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBreakEvenInfo();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', handleEscapeKey);
}

function closeBreakEvenInfo() {
    const modal = document.getElementById('breakEvenInfoModal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeBreakEvenInfo();
    }
}

// CSV Export functionality
function exportTableToCSV() {
    const table = document.querySelector('.data-table');
    if (!table) {
        alert('No data table found to export.');
        return;
    }

    let csvContent = '';
    const rows = table.querySelectorAll('tr');
    
    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td');
        const csvRow = [];
        
        cells.forEach(cell => {
            let cellText = cell.textContent.trim();
            
            // Handle special cases
            if (cellText === 'Not yet retired') {
                cellText = '';
            }
            
            // Remove dollar signs and commas for better CSV formatting
            if (cellText.includes('$')) {
                cellText = cellText.replace(/[$,]/g, '');
            }
            
            // Escape quotes and wrap in quotes if contains comma
            if (cellText.includes(',') || cellText.includes('"')) {
                cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }
            
            csvRow.push(cellText);
        });
        
        csvContent += csvRow.join(',') + '\n';
    });
    
    // Create filename with current date
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(now.getDate()).padStart(2, '0');
    const filename = `social_security_analysis_${dateStr}.csv`;
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // Fallback for browsers that don't support download attribute
        const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        window.open(url, '_blank');
    }
}

function closeFullscreenChart() {
    const chartModal = document.getElementById('chartModal');
    chartModal.style.display = 'none';
    
    if (breakEvenChartFullscreen) {
        breakEvenChartFullscreen.destroy();
        breakEvenChartFullscreen = null;
    }
}

// Add this to your initialization code
document.addEventListener('DOMContentLoaded', () => {
    initializeThemeToggle();
    initializeInvestmentToggle();
    initializeChartMaximize();
});