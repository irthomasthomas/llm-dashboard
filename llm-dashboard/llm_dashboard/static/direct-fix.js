// Complete replacement for the critical functions
// This bypasses any issues with function overriding or previous implementations

// Reset all visualizations and then reload data
function clearAndReloadData() {
    console.log('Clearing visualizations and reloading data');
    
    // Clear summary stats
    document.getElementById('totalRequests').textContent = '0';
    document.getElementById('totalTokens').textContent = '0';
    document.getElementById('totalCost').textContent = '$0.00';
    document.getElementById('avgCost').textContent = '$0.00';
    
    // Clear charts
    if (tokenUsageChart) {
        tokenUsageChart.data.labels = [];
        tokenUsageChart.data.datasets[0].data = [];
        tokenUsageChart.data.datasets[1].data = [];
        tokenUsageChart.update();
    }
    
    if (costChart) {
        costChart.data.labels = [];
        costChart.data.datasets[0].data = [];
        costChart.update();
    }
    
    if (tokenDistributionChart) {
        tokenDistributionChart.data.datasets[0].data = [0, 0];
        tokenDistributionChart.update();
    }
    
    if (costEfficiencyChart) {
        costEfficiencyChart.data.labels = [];
        costEfficiencyChart.data.datasets[0].data = [];
        costEfficiencyChart.update();
    }
    
    // Clear daily charts
    if (dailyTokenChart) {
        dailyTokenChart.data.labels = [];
        dailyTokenChart.data.datasets[0].data = [];
        dailyTokenChart.data.datasets[1].data = [];
        dailyTokenChart.update();
    }
    
    if (dailyCostChart) {
        dailyCostChart.data.labels = [];
        dailyCostChart.data.datasets[0].data = [];
        dailyCostChart.update();
    }
    
    if (dailyRequestChart) {
        dailyRequestChart.data.labels = [];
        dailyRequestChart.data.datasets[0].data = [];
        dailyRequestChart.update();
    }
    
    // Clear tables
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('highCostTableBody').innerHTML = '';
    
    // Reload data
    directLoadData();
}

// Direct implementation of loadData that doesn't rely on any previous version
async function directLoadData() {
    showLoading('Loading token usage data...');
    
    const modelFilter = document.getElementById('modelFilter');
    const dateRangePicker = document.getElementById('dateRangePicker');
    
    // Get model selection
    const modelSelection = modelFilter ? modelFilter.value : 'all';
    
    // Get date range
    let startDate, endDate;
    try {
        const dateRange = $(dateRangePicker).data('daterangepicker');
        startDate = dateRange.startDate.format('YYYY-MM-DD');
        endDate = dateRange.endDate.format('YYYY-MM-DD');
    } catch (error) {
        console.error('Error getting date range:', error);
        hideLoading();
        showError('Could not get date range. Please try refreshing the page.');
        return;
    }
    
    const url = `/api/token-data?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&model=${encodeURIComponent(modelSelection)}`;
    console.log('Loading data with URL:', url);
    
    try {
        // Make the API request
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('API response:', data);
        
        if (data.success) {
            // Update visualizations with the new data
            directUpdateVisualizations(data);
            
            // Load high-cost records
            directLoadHighCostRecords();
        } else {
            hideLoading();
            showError('Failed to load data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading data:', error);
        showError('Failed to load data: ' + error.message);
    }
}

// Direct implementation of updateVisualizations
function directUpdateVisualizations(data) {
    const modelData = data.model_data || [];
    const overallStats = data.overall_stats || {
        total_requests: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
        total_cost: 0,
        avg_cost_per_request: 0
    };
    const dateData = data.date_data || [];
    
    console.log('Updating visualizations with:', {
        modelData: modelData.length + ' records',
        overallStats,
        dateData: dateData.length + ' records'
    });
    
    // Update summary stats
    document.getElementById('totalRequests').textContent = formatNumber(overallStats.total_requests);
    document.getElementById('totalTokens').textContent = formatNumber(overallStats.total_tokens);
    document.getElementById('totalCost').textContent = formatCurrency(overallStats.total_cost);
    document.getElementById('avgCost').textContent = formatCurrency(overallStats.avg_cost_per_request);
    
    // Update token usage chart
    if (tokenUsageChart) {
        const models = modelData.map(item => {
            const parts = item.model.split('/');
            return parts.length > 1 ? parts[parts.length - 1] : item.model;
        });
        const promptTokens = modelData.map(item => item.prompt_tokens);
        const completionTokens = modelData.map(item => item.completion_tokens);
        
        tokenUsageChart.data.labels = models;
        tokenUsageChart.data.datasets[0].data = promptTokens;
        tokenUsageChart.data.datasets[1].data = completionTokens;
        tokenUsageChart.update();
    }
    
    // Update cost chart
    if (costChart) {
        const models = modelData.map(item => {
            const parts = item.model.split('/');
            return parts.length > 1 ? parts[parts.length - 1] : item.model;
        });
        const costs = modelData.map(item => item.total_cost);
        
        costChart.data.labels = models;
        costChart.data.datasets[0].data = costs;
        costChart.update();
    }
    
    // Update token distribution chart
    if (tokenDistributionChart) {
        tokenDistributionChart.data.datasets[0].data = [
            overallStats.total_prompt_tokens,
            overallStats.total_completion_tokens
        ];
        tokenDistributionChart.update();
    }
    
    // Update cost efficiency chart
    if (costEfficiencyChart) {
        const models = modelData.map(item => {
            const parts = item.model.split('/');
            return parts.length > 1 ? parts[parts.length - 1] : item.model;
        });
        const costPer1kTokens = modelData.map(item => item.cost_per_1k_tokens);
        
        costEfficiencyChart.data.labels = models;
        costEfficiencyChart.data.datasets[0].data = costPer1kTokens;
        costEfficiencyChart.update();
    }
    
    // Update daily charts
    if (dateData && dateData.length > 0) {
        // Update token chart
        if (dailyTokenChart) {
            const dates = dateData.map(item => item.date);
            const promptTokens = dateData.map(item => item.prompt_tokens);
            const completionTokens = dateData.map(item => item.completion_tokens);
            
            dailyTokenChart.data.labels = dates;
            dailyTokenChart.data.datasets[0].data = promptTokens;
            dailyTokenChart.data.datasets[1].data = completionTokens;
            dailyTokenChart.update();
        }
        
        // Update cost chart
        if (dailyCostChart) {
            const dates = dateData.map(item => item.date);
            const costs = dateData.map(item => item.total_cost);
            
            dailyCostChart.data.labels = dates;
            dailyCostChart.data.datasets[0].data = costs;
            dailyCostChart.update();
        }
        
        // Update request chart
        if (dailyRequestChart) {
            const dates = dateData.map(item => item.date);
            const requests = dateData.map(item => item.requests);
            
            dailyRequestChart.data.labels = dates;
            dailyRequestChart.data.datasets[0].data = requests;
            dailyRequestChart.update();
        }
    }
    
    // Update data table
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        
        modelData.forEach(item => {
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
    
    hideLoading();
}

// Direct implementation of loadHighCostRecords
async function directLoadHighCostRecords() {
    showLoading('Loading high-cost records...');
    
    const modelFilter = document.getElementById('modelFilter');
    const dateRangePicker = document.getElementById('dateRangePicker');
    
    // Get model selection
    const modelSelection = modelFilter ? modelFilter.value : 'all';
    
    // Get date range
    let startDate, endDate;
    try {
        const dateRange = $(dateRangePicker).data('daterangepicker');
        startDate = dateRange.startDate.format('YYYY-MM-DD');
        endDate = dateRange.endDate.format('YYYY-MM-DD');
    } catch (error) {
        console.error('Error getting date range:', error);
        hideLoading();
        showError('Could not get date range. Please try refreshing the page.');
        return;
    }
    
    const url = `/api/sample-records?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&model=${encodeURIComponent(modelSelection)}`;
    console.log('Loading high-cost records with URL:', url);
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            const records = data.records || [];
            console.log('Received high-cost records:', records.length);
            
            // Update high cost table
            const highCostTableBody = document.getElementById('highCostTableBody');
            if (highCostTableBody) {
                highCostTableBody.innerHTML = '';
                
                records.forEach(item => {
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
        } else {
            showError('Failed to load high-cost records: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading high-cost records:', error);
        showError('Failed to load high-cost records: ' + error.message);
    }
}

// Format helpers (in case they're not working correctly elsewhere)
function formatNumber(num) {
    return new Intl.NumberFormat().format(Math.round(num || 0));
}

function formatCurrency(num) {
    return '$' + (num || 0).toFixed(2);
}

// Setup filter event handler
document.addEventListener('DOMContentLoaded', function() {
    // Get references to UI elements
    const modelFilter = document.getElementById('modelFilter');
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    if (!applyFiltersBtn) {
        console.error('Could not find Apply Filters button!');
        return;
    }
    
    console.log('Setting up completely new filter handler');
    
    // Replace the Apply Filters button with a clone to remove any existing handlers
    const newButton = applyFiltersBtn.cloneNode(true);
    applyFiltersBtn.parentNode.replaceChild(newButton, applyFiltersBtn);
    
    // Add a new click handler
    newButton.addEventListener('click', function(event) {
        event.preventDefault();
        console.log('Apply Filters button clicked (new handler)');
        clearAndReloadData();
    });
    
    console.log('New filter handler set up successfully');
});

// Clean startup
window.addEventListener('load', function() {
    console.log('Window loaded, setting up direct functions');
    window.originalLoadData = window.loadData;
    window.originalLoadHighCostRecords = window.loadHighCostRecords;
    
    // Replace the functions with our direct versions
    window.loadData = directLoadData;
    window.loadHighCostRecords = directLoadHighCostRecords;
    
    // Add a global diagnostic function
    window.fixFiltering = function() {
        console.log('Manual filter fix applied');
        clearAndReloadData();
    };
    
    // Start logging events
    console.log('Patched functions set up - use window.fixFiltering() to manually force refresh if needed');
});
