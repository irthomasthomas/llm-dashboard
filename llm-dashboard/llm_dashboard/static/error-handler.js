// Add this before the closing </body> tag in index.html
// Enhanced error handling for API calls
function handleApiError(error, context) {
    console.error(`${context} error:`, error);
    let errorMsg = error.message || 'Unknown error';
    
    // Additional debugging information
    if (error.stack) {
        console.error('Stack trace:', error.stack);
    }
    
    // Show user-friendly error
    showError(`${context}: ${errorMsg}`);
    hideLoading();
}

// More robust fetch wrapper that handles network errors and JSON parsing
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        try {
            const data = await response.json();
            return data;
        } catch (jsonError) {
            throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
        }
    } catch (fetchError) {
        throw new Error(`Network request failed: ${fetchError.message}`);
    }
}

// Check database connection on page load
async function checkDatabaseConnection() {
    try {
        const data = await safeFetch('/api/date-range');
        
        if (!data.success) {
            showError(`Database connection issue: ${data.error || 'Unknown error'}`);
            return false;
        }
        return true;
    } catch (error) {
        handleApiError(error, 'Database connection check');
        return false;
    }
}

// Update the date range picker initialization
async function initDateRangePicker() {
    showLoading('Checking database connection...');
    
    const dbConnected = await checkDatabaseConnection();
    
    if (!dbConnected) {
        hideLoading();
        showError('Could not connect to the database. Please check server logs.');
        return;
    }
    
    showLoading('Loading available date range...');
    
    try {
        const data = await safeFetch('/api/date-range');
        
        hideLoading();
        
        if (data.success) {
            // Use defaults if no min/max dates found
            const minDate = data.min_date ? moment(data.min_date) : moment().subtract(30, 'days');
            const maxDate = data.max_date ? moment(data.max_date) : moment();
            
            console.log('Database date range:', {minDate: minDate.format('YYYY-MM-DD'), maxDate: maxDate.format('YYYY-MM-DD')});
            
            // Set default selection to last 7 days or available range if shorter
            startDate = moment(maxDate).subtract(7, 'days').isBefore(minDate) 
                ? minDate.format('YYYY-MM-DD')
                : moment(maxDate).subtract(7, 'days').format('YYYY-MM-DD');
            endDate = maxDate.format('YYYY-MM-DD');
            
            // Initialize daterangepicker with more options
            $(dateRangePicker).daterangepicker({
                startDate: moment(startDate),
                endDate: moment(endDate),
                minDate: minDate,
                maxDate: maxDate,
                opens: 'left',
                autoApply: true,
                showDropdowns: true,
                alwaysShowCalendars: true,
                ranges: {
                   'Today': [moment(), moment()],
                   'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                   'Last 7 Days': [moment().subtract(6, 'days'), moment()],
                   'Last 30 Days': [moment().subtract(29, 'days'), moment()],
                   'This Month': [moment().startOf('month'), moment().endOf('month')],
                   'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format: 'YYYY-MM-DD'
                }
            }, function(start, end) {
                startDate = start.format('YYYY-MM-DD');
                endDate = end.format('YYYY-MM-DD');
                console.log('Date range selected:', {startDate, endDate});
            });
            
            // Load models
            loadModels();
        } else {
            showError('Failed to load date range: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        handleApiError(error, 'Date range initialization');
    }
}

// Update the loadModels function
async function loadModels() {
    showLoading('Loading models...');
    
    try {
        const data = await safeFetch('/api/models');
        
        hideLoading();
        
        if (data.success) {
            modelFilter.innerHTML = '<option value="all">All Models</option>';
            
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelFilter.appendChild(option);
            });
            
            // Initial data load
            loadData();
        } else {
            showError('Failed to load models: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        handleApiError(error, 'Model loading');
    }
}

// Update the loadData function
async function loadData() {
    showLoading('Loading token usage data...');
    
    const modelSelection = modelFilter.value;
    
    const url = `/api/token-data?start_date=${startDate}&end_date=${endDate}&model=${modelSelection}`;
    console.log('Loading data with URL:', url);
    
    try {
        const data = await safeFetch(url);
        
        if (data.success) {
            console.log('API data loaded successfully:', {
                modelDataCount: data.model_data.length,
                overallStats: data.overall_stats,
                dateDataCount: data.date_data.length
            });
            
            updateVisualizations(data);
            loadHighCostRecords();
        } else {
            hideLoading();
            showError('Failed to load data: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        handleApiError(error, 'Data loading');
    }
}

// Update the loadHighCostRecords function
async function loadHighCostRecords() {
    showLoading('Loading high-cost records...');
    
    const modelSelection = modelFilter.value;
    
    const url = `/api/sample-records?start_date=${startDate}&end_date=${endDate}&model=${modelSelection}`;
    
    try {
        const data = await safeFetch(url);
        
        hideLoading();
        
        if (data.success) {
            updateHighCostTable(data.records);
        } else {
            showError('Failed to load high-cost records: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        handleApiError(error, 'High-cost records loading');
    }
}
