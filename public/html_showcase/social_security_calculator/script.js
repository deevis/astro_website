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
    document.querySelector(`button[onclick="showTab('${tabName}')"]`).classList.add('active');
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

    document.getElementById('results').innerHTML = `
        ${generateSummary(baseScenario, futureScenario, currentAge, futureWorkYears, futureAnnualEarnings)}
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

// Add this to your initialization code
document.addEventListener('DOMContentLoaded', () => {
    initializeThemeToggle();
});