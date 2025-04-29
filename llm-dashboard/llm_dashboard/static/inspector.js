// Add console inspector for network requests
(function() {
    console.log('%c🔍 Request Inspector Activated', 'background: #222; color: #bada55; font-size: 16px; padding: 5px;');
    
    // Monitor fetch calls
    const originalFetch = window.fetch;
    window.fetch = async function() {
        console.log('%c→ Fetch Request', 'color: #2196F3; font-weight: bold;', {
            url: arguments[0],
            options: arguments[1]
        });
        
        try {
            const response = await originalFetch.apply(this, arguments);
            
            // Clone the response so we can log it and still return a usable response
            const clone = response.clone();
            
            // Log response status
            console.log('%c← Fetch Response', 'color: #4CAF50; font-weight: bold;', {
                url: arguments[0],
                status: clone.status,
                statusText: clone.statusText
            });
            
            // Try to log the JSON response if possible
            try {
                const jsonResponse = await clone.json();
                console.log('%c← Response Data', 'color: #FF9800;', jsonResponse);
            } catch (e) {
                console.log('%c← Response is not JSON', 'color: #f44336;');
            }
            
            return response;
        } catch (error) {
            console.error('%c✖ Fetch Error', 'color: #f44336; font-weight: bold;', error);
            throw error;
        }
    };
    
    // Add visualization debugging
    const originalUpdate = Chart.prototype.update;
    Chart.prototype.update = function() {
        console.log('%c📊 Chart Update', 'color: #9c27b0; font-weight: bold;', {
            id: this.canvas.id,
            data: JSON.parse(JSON.stringify(this.data)), // Deep copy to avoid circular references
            options: this.options
        });
        return originalUpdate.apply(this, arguments);
    };
    
    // Create a debugger object for direct inspection
    window.debugger = {
        checkState: function() {
            console.log('%c📌 Current State', 'background: #222; color: #bada55;', {
                dateRange: $(dateRangePicker).data('daterangepicker') ? {
                    startDate: $(dateRangePicker).data('daterangepicker').startDate.format('YYYY-MM-DD'),
                    endDate: $(dateRangePicker).data('daterangepicker').endDate.format('YYYY-MM-DD')
                } : 'Not Initialized',
                selectedModel: $('#modelFilter').val(),
                charts: {
                    tokenUsage: tokenUsageChart ? {
                        labels: tokenUsageChart.data.labels,
                        datasets: tokenUsageChart.data.datasets
                    } : 'Not Initialized',
                    // Add other charts as needed
                }
            });
        },
        testAPI: async function(model = 'all') {
            const dateRange = $(dateRangePicker).data('daterangepicker');
            if (!dateRange) {
                console.error('Date range picker not initialized');
                return;
            }
            
            const startDate = dateRange.startDate.format('YYYY-MM-DD');
            const endDate = dateRange.endDate.format('YYYY-MM-DD');
            
            console.log('%c🧪 Manual API Test', 'background: #222; color: #bada55;', {
                startDate,
                endDate,
                model
            });
            
            try {
                const url = `/api/token-data?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(model)}`;
                const response = await fetch(url);
                const data = await response.json();
                
                console.log('%c🧪 API Test Result', 'background: #222; color: #bada55;', data);
                return data;
            } catch (error) {
                console.error('%c🧪 API Test Error', 'background: #222; color: #f44336;', error);
                return null;
            }
        },
        reinitialize: function() {
            console.log('%c🔄 Reinitializing Filters', 'background: #222; color: #bada55;');
            
            // Reinitialize date range picker
            initDateRangePicker();
            
            // Force reload data
            setTimeout(() => {
                loadData();
            }, 1000);
        }
    };
    
    // Add to window object
    window.inspector = {
        logVisualizations: function() {
            if (tokenUsageChart) {
                console.log('Token Usage Chart:', tokenUsageChart.data);
            }
            if (costChart) {
                console.log('Cost Chart:', costChart.data);
            }
            if (tokenDistributionChart) {
                console.log('Token Distribution Chart:', tokenDistributionChart.data);
            }
            if (costEfficiencyChart) {
                console.log('Cost Efficiency Chart:', costEfficiencyChart.data);
            }
        }
    };
    
    console.log('%c💡 Type "debugger.checkState()" to see current state', 'color: #2196F3;');
    console.log('%c💡 Type "debugger.testAPI()" to manually test the API', 'color: #2196F3;');
    console.log('%c💡 Type "inspector.logVisualizations()" to inspect charts', 'color: #2196F3;');
})();
