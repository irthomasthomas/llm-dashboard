// Direct script to fix model filtering
document.addEventListener('DOMContentLoaded', function() {
    console.log('Model filtering fix loaded');
    
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    if (applyFiltersBtn) {
        console.log('Apply Filters button found, replacing event handler');
        
        // Clone to remove old handlers
        const newBtn = applyFiltersBtn.cloneNode(true);
        applyFiltersBtn.parentNode.replaceChild(newBtn, applyFiltersBtn);
        
        // Add new handler
        newBtn.addEventListener('click', function() {
            console.log('Apply Filters clicked (fixed handler)');
            
            // Get filters
            const dateRange = $('#dateRangePicker').data('daterangepicker');
            const modelFilter = document.getElementById('modelFilter');
            
            if (dateRange && modelFilter) {
                const startDate = dateRange.startDate.format('YYYY-MM-DD');
                const endDate = dateRange.endDate.format('YYYY-MM-DD');
                const modelValue = modelFilter.value;
                
                console.log('Filters:', { startDate, endDate, model: modelValue });
                
                // Clear all visualizations
                clearVisualizations();
                
                // Load data with new filters
                loadFilteredData(startDate, endDate, modelValue);
            }
        });
    }
    
    function clearVisualizations() {
        // Clear stats
        document.getElementById('totalRequests').textContent = '0';
        document.getElementById('totalTokens').textContent = '0';
        document.getElementById('totalCost').textContent = '$0.00';
        document.getElementById('avgCost').textContent = '$0.00';
        
        // Clear tables
        document.getElementById('tableBody').innerHTML = '';
        document.getElementById('highCostTableBody').innerHTML = '';
        
        // Clear charts
        if (window.tokenUsageChart) {
            window.tokenUsageChart.data.labels = [];
            window.tokenUsageChart.data.datasets[0].data = [];
            window.tokenUsageChart.data.datasets[1].data = [];
            window.tokenUsageChart.update();
        }
        
        if (window.costChart) {
            window.costChart.data.labels = [];
            window.costChart.data.datasets[0].data = [];
            window.costChart.update();
        }
        
        if (window.tokenDistributionChart) {
            window.tokenDistributionChart.data.datasets[0].data = [0, 0];
            window.tokenDistributionChart.update();
        }
        
        if (window.costEfficiencyChart) {
            window.costEfficiencyChart.data.labels = [];
            window.costEfficiencyChart.data.datasets[0].data = [];
            window.costEfficiencyChart.update();
        }
    }
    
    function loadFilteredData(startDate, endDate, model) {
        // Show loading
        document.getElementById('loadingOverlay').style.display = 'flex';
        
        // Load data
        $.ajax({
            url: `/api/token-data?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(model)}`,
            method: 'GET',
            success: function(data) {
                console.log('Data loaded successfully:', data);
                
                if (data.success) {
                    // Update stats
                    document.getElementById('totalRequests').textContent = formatNumber(data.overall_stats.total_requests);
                    document.getElementById('totalTokens').textContent = formatNumber(data.overall_stats.total_tokens);
                    document.getElementById('totalCost').textContent = formatCurrency(data.overall_stats.total_cost);
                    document.getElementById('avgCost').textContent = formatCurrency(data.overall_stats.avg_cost_per_request);
                    
                    // Update charts
                    updateCharts(data);
                    
                    // Update table
                    updateTable(data.model_data);
                    
                    // Load high-cost records
                    loadHighCostRecords(startDate, endDate, model);
                } else {
                    console.error('API returned error:', data.error);
                    hideLoading();
                }
            },
            error: function(xhr, status, error) {
                console.error('API request failed:', error);
                hideLoading();
            }
        });
    }
    
    function loadHighCostRecords(startDate, endDate, model) {
        $.ajax({
            url: `/api/sample-records?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(model)}`,
            method: 'GET',
            success: function(data) {
                hideLoading();
                
                if (data.success) {
                    // Update high-cost table
                    updateHighCostTable(data.records);
                } else {
                    console.error('API returned error:', data.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('High-cost records request failed:', error);
                hideLoading();
            }
        });
    }
    
    function updateCharts(data) {
        // Update token usage chart
        if (window.tokenUsageChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const promptTokens = data.model_data.map(item => parseInt(item.prompt_tokens) || 0);
            const completionTokens = data.model_data.map(item => parseInt(item.completion_tokens) || 0);
            
            window.tokenUsageChart.data.labels = models;
            window.tokenUsageChart.data.datasets[0].data = promptTokens;
            window.tokenUsageChart.data.datasets[1].data = completionTokens;
            window.tokenUsageChart.update();
        }
        
        // Update cost chart
        if (window.costChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const costs = data.model_data.map(item => parseFloat(item.total_cost) || 0);
            
            window.costChart.data.labels = models;
            window.costChart.data.datasets[0].data = costs;
            window.costChart.update();
        }
        
        // Update token distribution chart
        if (window.tokenDistributionChart) {
            window.tokenDistributionChart.data.datasets[0].data = [
                parseInt(data.overall_stats.total_prompt_tokens) || 0,
                parseInt(data.overall_stats.total_completion_tokens) || 0
            ];
            window.tokenDistributionChart.update();
        }
        
        // Update cost efficiency chart
        if (window.costEfficiencyChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const costPer1kTokens = data.model_data.map(item => parseFloat(item.cost_per_1k_tokens) || 0);
            
            window.costEfficiencyChart.data.labels = models;
            window.costEfficiencyChart.data.datasets[0].data = costPer1kTokens;
            window.costEfficiencyChart.update();
        }
    }
    
    function updateTable(data) {
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
    
    function hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    function formatNumber(num) {
        return new Intl.NumberFormat().format(Math.round(num || 0));
    }
    
    function formatCurrency(num) {
        return '$' + (parseFloat(num) || 0).toFixed(2);
    }
});
