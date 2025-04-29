// Enhanced event handling for filters
document.addEventListener('DOMContentLoaded', function() {
    // Ensure we have the elements
    const modelFilter = document.getElementById('modelFilter');
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    if (!modelFilter || !applyFiltersBtn) {
        console.error('Could not find filter elements!');
        return;
    }
    
    console.log('Setting up enhanced filter event handlers');
    
    // Add change event logging for debugging
    modelFilter.addEventListener('change', function() {
        console.log('Model filter changed to:', this.value);
    });
    
    // Replace the click handler for Apply Filters button
    // Remove any existing event listeners first (if possible)
    applyFiltersBtn.replaceWith(applyFiltersBtn.cloneNode(true));
    
    // Get the fresh button reference and add a new listener
    const freshApplyBtn = document.getElementById('applyFilters');
    freshApplyBtn.addEventListener('click', function() {
        console.log('Apply Filters button clicked');
        console.log('Current model filter:', modelFilter.value);
        
        // Get the current date range
        const dateRange = $(dateRangePicker).data('daterangepicker');
        if (!dateRange) {
            console.error('Could not get daterangepicker data!');
            showError('Date range picker is not initialized properly.');
            return;
        }
        
        startDate = dateRange.startDate.format('YYYY-MM-DD');
        endDate = dateRange.endDate.format('YYYY-MM-DD');
        
        console.log('Applying filters with:', { 
            startDate, 
            endDate, 
            modelFilter: modelFilter.value 
        });
        
        // Force clear any previous data
        updateSummaryStats({
            total_requests: 0,
            total_prompt_tokens: 0,
            total_completion_tokens: 0,
            total_tokens: 0,
            total_cost: 0,
            avg_cost_per_request: 0
        });
        
        tokenUsageChart.data.labels = [];
        tokenUsageChart.data.datasets[0].data = [];
        tokenUsageChart.data.datasets[1].data = [];
        tokenUsageChart.update();
        
        costChart.data.labels = [];
        costChart.data.datasets[0].data = [];
        costChart.update();
        
        tokenDistributionChart.data.datasets[0].data = [0, 0];
        tokenDistributionChart.update();
        
        costEfficiencyChart.data.labels = [];
        costEfficiencyChart.data.datasets[0].data = [];
        costEfficiencyChart.update();
        
        // Clear tables
        tableBody.innerHTML = '';
        highCostTableBody.innerHTML = '';
        
        // Load the filtered data
        loadData();
    });
    
    console.log('Enhanced event handlers set up successfully');
});

// Replace the loadData function to ensure model filtering works correctly
async function enhancedLoadData() {
    showLoading('Loading token usage data...');
    
    const modelSelection = modelFilter.value;
    
    const url = `/api/token-data?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(modelSelection)}`;
    console.log('Loading data with URL:', url);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('API data loaded successfully:', {
                modelDataCount: data.model_data.length,
                overallStats: data.overall_stats,
                dateDataCount: data.date_data.length,
                modelFilter: modelSelection
            });
            
            updateVisualizations(data);
            loadHighCostRecords();
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

// Enhanced loadHighCostRecords function
async function enhancedLoadHighCostRecords() {
    showLoading('Loading high-cost records...');
    
    const modelSelection = modelFilter.value;
    
    const url = `/api/sample-records?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(modelSelection)}`;
    console.log('Loading high-cost records with URL:', url);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            console.log('Received high-cost records:', data.records.length);
            updateHighCostTable(data.records);
        } else {
            showError('Failed to load high-cost records: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading high-cost records:', error);
        showError('Failed to load high-cost records: ' + error.message);
    }
}

// Replace the original functions with our enhanced versions
window.addEventListener('load', function() {
    console.log('Applying model filter fixes');
    window.loadData = enhancedLoadData;
    window.loadHighCostRecords = enhancedLoadHighCostRecords;
});
