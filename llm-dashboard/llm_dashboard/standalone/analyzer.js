// Helper function to format numbers for display
function formatNumber(num) {
    return new Intl.NumberFormat().format(Math.round(num || 0));
}

function formatCurrency(num) {
    return '$' + (parseFloat(num) || 0).toFixed(2);
}

// Show error message
function showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorAlert && errorMessage) {
        errorMessage.textContent = message;
        errorAlert.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorAlert.classList.remove('show');
        }, 5000);
    } else {
        alert(message);
    }
}

// Show loading overlay
function showLoading(message = 'Loading...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingOverlay) {
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
        loadingOverlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// API call to get date range
async function getDateRange() {
    try {
        const response = await fetch('/api/date-range');
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting date range:', error);
        showError('Failed to get date range: ' + error.message);
        return { success: false, error: error.message };
    }
}

// API call to get models
async function getModels() {
    try {
        const response = await fetch('/api/models');
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting models:', error);
        showError('Failed to get models: ' + error.message);
        return { success: false, error: error.message };
    }
}

// API call to get token data
async function getTokenData(startDate, endDate, model) {
    try {
        const url = `/api/token-data?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&model=${encodeURIComponent(model)}`;
        console.log('Loading data from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting token data:', error);
        showError('Failed to get token data: ' + error.message);
        return { success: false, error: error.message };
    }
}

// API call to get high-cost records
async function getHighCostRecords(startDate, endDate, model) {
    try {
        const url = `/api/sample-records?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&model=${encodeURIComponent(model)}`;
        console.log('Loading high-cost records from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting high-cost records:', error);
        showError('Failed to get high-cost records: ' + error.message);
        return { success: false, error: error.message };
    }
}

// Update summary stats
function updateSummaryStats(stats) {
    document.getElementById('totalRequests').textContent = formatNumber(stats.total_requests);
    document.getElementById('totalTokens').textContent = formatNumber(stats.total_tokens);
    document.getElementById('totalCost').textContent = formatCurrency(stats.total_cost);
    document.getElementById('avgCost').textContent = formatCurrency(stats.avg_cost_per_request);
}

// Update token usage chart
function updateTokenUsageChart(data, chart) {
    const models = data.map(item => {
        const parts = item.model.split('/');
        return parts.length > 1 ? parts[parts.length - 1] : item.model;
    });
    const promptTokens = data.map(item => parseInt(item.prompt_tokens) || 0);
    const completionTokens = data.map(item => parseInt(item.completion_tokens) || 0);
    
    chart.data.labels = models;
    chart.data.datasets[0].data = promptTokens;
    chart.data.datasets[1].data = completionTokens;
    chart.update();
}

// Update cost chart
function updateCostChart(data, chart) {
    const models = data.map(item => {
        const parts = item.model.split('/');
        return parts.length > 1 ? parts[parts.length - 1] : item.model;
    });
    const costs = data.map(item => parseFloat(item.total_cost) || 0);
    
    chart.data.labels = models;
    chart.data.datasets[0].data = costs;
    chart.update();
}

// Update token distribution chart
function updateTokenDistributionChart(stats, chart) {
    chart.data.datasets[0].data = [
        parseInt(stats.total_prompt_tokens) || 0,
        parseInt(stats.total_completion_tokens) || 0
    ];
    chart.update();
}

// Update cost efficiency chart
function updateCostEfficiencyChart(data, chart) {
    const models = data.map(item => {
        const parts = item.model.split('/');
        return parts.length > 1 ? parts[parts.length - 1] : item.model;
    });
    const costPer1kTokens = data.map(item => parseFloat(item.cost_per_1k_tokens) || 0);
    
    chart.data.labels = models;
    chart.data.datasets[0].data = costPer1kTokens;
    chart.update();
}

// Update daily charts
function updateDailyCharts(data, tokenChart, costChart, requestChart) {
    if (data && data.length > 0) {
        const dates = data.map(item => item.date);
        const promptTokens = data.map(item => parseInt(item.prompt_tokens) || 0);
        const completionTokens = data.map(item => parseInt(item.completion_tokens) || 0);
        const costs = data.map(item => parseFloat(item.total_cost) || 0);
        const requests = data.map(item => parseInt(item.requests) || 0);
        
        // Update token chart
        tokenChart.data.labels = dates;
        tokenChart.data.datasets[0].data = promptTokens;
        tokenChart.data.datasets[1].data = completionTokens;
        tokenChart.update();
        
        // Update cost chart
        costChart.data.labels = dates;
        costChart.data.datasets[0].data = costs;
        costChart.update();
        
        // Update request chart
        requestChart.data.labels = dates;
        requestChart.data.datasets[0].data = requests;
        requestChart.update();
    }
}

// Update data table
function updateDataTable(data) {
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${item.model}</td>
                <td>${formatNumber(item.requests)}</td>
                <td>${formatNumber(item.prompt_tokens)}</td>
                <td>${formatNumber(item.completion_tokens)}</td>
                <td>${formatNumber(item.total_tokens)}</td>
                <td>${formatCurrency(item.total_cost)}</td>
                <td>${formatCurrency(item.avg_cost_per_request)}</td>
                <td>${formatCurrency(item.cost_per_1k_tokens)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
}

// Update high cost table
function updateHighCostTable(data) {
    const highCostTableBody = document.getElementById('highCostTableBody');
    if (highCostTableBody) {
        highCostTableBody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.model}</td>
                <td>${formatNumber(item.prompt_tokens)}</td>
                <td>${formatNumber(item.completion_tokens)}</td>
                <td>${formatNumber(item.total_tokens)}</td>
                <td>${formatCurrency(item.cost)}</td>
                <td>${item.datetime}</td>
            `;
            
            highCostTableBody.appendChild(row);
        });
    }
}

// Initialize charts
function initCharts() {
    // Token Usage Chart
    const tokenUsageChart = new Chart(document.getElementById('tokenUsageChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Prompt Tokens',
                    backgroundColor: '#4a6fa5',
                    data: []
                },
                {
                    label: 'Completion Tokens',
                    backgroundColor: '#ff9642',
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat().format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat().format(value);
                        }
                    }
                }
            }
        }
    });

    // Cost Chart
    const costChart = new Chart(document.getElementById('costChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Cost ($)',
                backgroundColor: '#2ca02c',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': $';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });

    // Token Distribution Chart
    const tokenDistributionChart = new Chart(document.getElementById('tokenDistributionChart'), {
        type: 'pie',
        data: {
            labels: ['Prompt Tokens', 'Completion Tokens'],
            datasets: [{
                label: 'Tokens',
                backgroundColor: ['#4a6fa5', '#ff9642'],
                data: [0, 0]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw;
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${new Intl.NumberFormat().format(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Cost Efficiency Chart
    const costEfficiencyChart = new Chart(document.getElementById('costEfficiencyChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Cost per 1K Tokens ($)',
                backgroundColor: '#d62728',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': $';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(6);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(6);
                        }
                    }
                }
            }
        }
    });

    // Daily Token Chart
    const dailyTokenChart = new Chart(document.getElementById('dailyTokenChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Prompt Tokens',
                    backgroundColor: '#4a6fa5',
                    data: [],
                    order: 1
                },
                {
                    label: 'Completion Tokens',
                    backgroundColor: '#ff9642',
                    data: [],
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat().format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat().format(value);
                        }
                    }
                }
            }
        }
    });

    // Daily Cost Chart
    const dailyCostChart = new Chart(document.getElementById('dailyCostChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Cost ($)',
                borderColor: '#2ca02c',
                backgroundColor: 'rgba(44, 160, 44, 0.2)',
                data: [],
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': $';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });

    // Daily Request Chart
    const dailyRequestChart = new Chart(document.getElementById('dailyRequestChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Number of Requests',
                borderColor: '#9467bd',
                backgroundColor: 'rgba(148, 103, 189, 0.2)',
                data: [],
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    return {
        tokenUsageChart,
        costChart,
        tokenDistributionChart,
        costEfficiencyChart,
        dailyTokenChart,
        dailyCostChart,
        dailyRequestChart
    };
}

// Initialize date range picker
async function initDateRangePicker() {
    showLoading('Loading date range...');
    
    const dateRangeData = await getDateRange();
    
    if (dateRangeData.success) {
        const minDate = dateRangeData.min_date ? moment(dateRangeData.min_date) : moment().subtract(30, 'days');
        const maxDate = dateRangeData.max_date ? moment(dateRangeData.max_date) : moment();
        
        // Set default selection to last 7 days or available range if shorter
        const startDate = moment(maxDate).subtract(7, 'days').isBefore(minDate) 
            ? minDate.format('YYYY-MM-DD')
            : moment(maxDate).subtract(7, 'days').format('YYYY-MM-DD');
        const endDate = maxDate.format('YYYY-MM-DD');
        
        // Initialize daterangepicker
        $('#dateRangePicker').daterangepicker({
            startDate: moment(startDate),
            endDate: moment(endDate),
            minDate: minDate,
            maxDate: maxDate,
            opens: 'left',
            autoApply: true,
            locale: {
                format: 'YYYY-MM-DD'
            },
            ranges: {
               'Today': [moment(), moment()],
               'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
               'Last 7 Days': [moment().subtract(6, 'days'), moment()],
               'Last 30 Days': [moment().subtract(29, 'days'), moment()],
               'This Month': [moment().startOf('month'), moment().endOf('month')],
               'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            }
        });
        
        hideLoading();
        return { startDate, endDate };
    } else {
        hideLoading();
        showError('Failed to load date range. Using default values.');
        return { 
            startDate: moment().subtract(7, 'days').format('YYYY-MM-DD'),
            endDate: moment().format('YYYY-MM-DD')
        };
    }
}

// Initialize model filter
async function initModelFilter() {
    showLoading('Loading models...');
    
    const modelsData = await getModels();
    
    if (modelsData.success) {
        const modelFilter = document.getElementById('modelFilter');
        
        // Clear existing options
        modelFilter.innerHTML = '<option value="all">All Models</option>';
        
        // Add new options
        modelsData.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelFilter.appendChild(option);
        });
        
        hideLoading();
        return true;
    } else {
        hideLoading();
        showError('Failed to load models.');
        return false;
    }
}

// Load data based on filters
async function loadFilteredData(startDate, endDate, model, charts) {
    showLoading('Loading data...');
    
    // Get token data
    const tokenData = await getTokenData(startDate, endDate, model);
    
    if (tokenData.success) {
        // Update summary stats
        updateSummaryStats(tokenData.overall_stats);
        
        // Update charts
        updateTokenUsageChart(tokenData.model_data, charts.tokenUsageChart);
        updateCostChart(tokenData.model_data, charts.costChart);
        updateTokenDistributionChart(tokenData.overall_stats, charts.tokenDistributionChart);
        updateCostEfficiencyChart(tokenData.model_data, charts.costEfficiencyChart);
        
        // Update daily charts
        updateDailyCharts(
            tokenData.date_data, 
            charts.dailyTokenChart, 
            charts.dailyCostChart, 
            charts.dailyRequestChart
        );
        
        // Update data table
        updateDataTable(tokenData.model_data);
        
        // Get high-cost records
        const highCostData = await getHighCostRecords(startDate, endDate, model);
        
        if (highCostData.success) {
            updateHighCostTable(highCostData.records);
        }
        
        hideLoading();
        return true;
    } else {
        hideLoading();
        showError('Failed to load data.');
        return false;
    }
}

// Initialize application
async function initApp() {
    console.log('Initializing LLM Dashboard...');
    
    // Initialize charts
    const charts = initCharts();
    
    // Initialize date range picker
    const { startDate, endDate } = await initDateRangePicker();
    
    // Initialize model filter
    await initModelFilter();
    
    // Load initial data
    await loadFilteredData(startDate, endDate, 'all', charts);
    
    // Set up Apply Filters button
    document.getElementById('applyFilters').addEventListener('click', async function() {
        const dateRange = $('#dateRangePicker').data('daterangepicker');
        const modelFilter = document.getElementById('modelFilter');
        
        if (dateRange && modelFilter) {
            const startDate = dateRange.startDate.format('YYYY-MM-DD');
            const endDate = dateRange.endDate.format('YYYY-MM-DD');
            const model = modelFilter.value;
            
            console.log('Applying filters:', { startDate, endDate, model });
            
            await loadFilteredData(startDate, endDate, model, charts);
        } else {
            showError('Date range picker or model filter not initialized.');
        }
    });
    
    console.log('LLM Dashboard initialized successfully!');
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initApp().catch(error => {
        console.error('Error initializing application:', error);
        showError('Failed to initialize application: ' + error.message);
    });
});
