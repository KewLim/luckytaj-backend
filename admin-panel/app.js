class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.baseURL = window.location.origin;
        this.alternativePorts = [3003, 3000, 3002, 8000, 8080, 5000]; // Added 3003 as first alternative
        this.currentPortIndex = 0;
        this.metricsInterval = null;
        this.charts = {};
        this.retryDelay = 1000; // Start with 1 second delay
        this.maxRetries = 3;
        this.init();
    }

    async init() {
        // Initialize theme early
        this.initThemeEarly();
        
        // Check if user is already logged in
        if (this.token) {
            const isValid = await this.verifyToken();
            if (isValid) {
                this.showDashboard();
                return;
            } else {
                localStorage.removeItem('adminToken');
                this.token = null;
            }
        }
        
        this.showLogin();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.clearLoginErrors();
            this.handleLogin();
        });
        
        // Clear errors when typing in email/password fields
        document.getElementById('email').addEventListener('input', () => {
            this.clearLoginErrors();
        });
        
        document.getElementById('password').addEventListener('input', () => {
            this.clearLoginErrors();
        });
    }

    setupDashboardEventListeners() {
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('.tab-btn');
                this.switchTab(target.dataset.tab);
            });
        });

        // Search functionality for tip performance
        this.setupSearchFunctionality();

        // Video tab switching in modal
        document.querySelectorAll('.video-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchVideoTab(e.target.dataset.type);
            });
        });

        // Form submissions
        document.getElementById('bannerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBannerUpload();
        });

        document.getElementById('commentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCommentSubmit();
        });

        document.getElementById('videoUrlForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVideoUrlSubmit();
        });

        document.getElementById('videoUploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVideoUpload();
        });

        document.getElementById('winnerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleWinnerSubmit();
        });

        document.getElementById('jackpotForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJackpotSubmit();
        });

        document.getElementById('gameForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGameSubmit();
        });
    }

    async verifyToken() {
        try {
            const response = await fetch(`${this.baseURL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async handleLogin(attempt = 0) {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        // Maximum attempts = 1 (original) + alternativePorts.length + 2 retries
        const maxTotalAttempts = 1 + this.alternativePorts.length + 2;
        
        if (attempt >= maxTotalAttempts) {
            errorDiv.innerHTML = `
                <div class="error-message-flex">
                    <i class="fas fa-exclamation-triangle"></i>
                    Maximum retry attempts exceeded. Please wait and try again later.
                </div>
            `;
            errorDiv.classList.remove('d-none');
            errorDiv.classList.add('d-block');
            this.hideLoading();
            return;
        }
        
        // Determine which URL to try
        let loginURL = this.baseURL;
        if (attempt > 0 && attempt <= this.alternativePorts.length) {
            const port = this.alternativePorts[attempt - 1];
            loginURL = `http://localhost:${port}`;
        }

        try {
            if (attempt === 0) this.showLoading();
            
            const response = await fetch(`${loginURL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();

            if (response.ok) {
                // Success - login worked
                this.token = data.token;
                localStorage.setItem('adminToken', this.token);
                
                // Update baseURL if we used an alternative port
                if (attempt > 0) {
                    this.baseURL = loginURL;
                    console.log(`Successfully logged in using port ${loginURL}`);
                }
                
                this.hideLoading();
                this.showDashboard();
                this.loadAdminInfo(data.admin);
                return;
            }
            
            // Handle 429 rate limiting - wait and retry on same port
            if (response.status === 429) {
                if (attempt < 3) { // Only retry 3 times for rate linking
                    const waitTime = Math.min((attempt + 1) * 3000, 10000); // 3s, 6s, 9s (max 10s)
                    console.log(`Rate limited, waiting ${waitTime/1000}s before retry...`);
                    errorDiv.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clock"></i>
                            Rate limited. Waiting ${waitTime/1000} seconds before retry...
                        </div>
                    `;
                    errorDiv.classList.remove('d-none');
                    errorDiv.classList.add('d-block');
                    
                    setTimeout(() => {
                        this.handleLogin(attempt + 1);
                    }, waitTime);
                    return;
                } else {
                    // Max retries for rate limiting
                    errorDiv.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clock"></i>
                            Too many attempts. Please wait 5 minutes and try again.
                        </div>
                    `;
                    errorDiv.classList.remove('d-none');
                    errorDiv.classList.add('d-block');
                    this.hideLoading();
                    return;
                }
            } else {
                // Other error (invalid credentials, etc.)
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.remove('d-none');
                errorDiv.classList.add('d-block');
                this.hideLoading();
                return;
            }
        } catch (error) {
            console.error('Login network error:', error);
            
            // Only retry network errors 2 times on the same URL
            if (attempt < 2) {
                console.log(`Network error, retrying in 2 seconds... (attempt ${attempt + 1})`);
                errorDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-wifi"></i>
                        Connection failed. Retrying in 2 seconds...
                    </div>
                `;
                errorDiv.classList.remove('d-none');
                errorDiv.classList.add('d-block');
                
                setTimeout(() => {
                    this.handleLogin(attempt + 1);
                }, 2000);
                return;
            }
            
            errorDiv.textContent = 'Network error. Please check your connection and try again.';
            errorDiv.classList.remove('d-none');
            errorDiv.classList.add('d-block');
            this.hideLoading();
        }
    }

    handleLogout() {
        localStorage.removeItem('adminToken');
        this.token = null;
        this.stopRealTimeUpdates();
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('loginScreen').classList.add('d-flex');
        document.getElementById('dashboard').classList.remove('d-block');
        document.getElementById('dashboard').classList.add('d-none');
        document.getElementById('loginError').classList.add('d-none');
        document.getElementById('loginForm').reset();
    }

    async showDashboard() {
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('dashboard').classList.remove('d-none');
        document.getElementById('dashboard').classList.add('d-block');
        
        // Setup dashboard event listeners after elements are visible
        this.setupDashboardEventListeners();
        
        // Initialize theme toggle
        this.initThemeToggle();
        
        // Start India time display
        this.startIndiaTimeDisplay();
        
        // Load admin info
        const adminInfo = await this.getAdminInfo();
        if (adminInfo) {
            this.loadAdminInfo(adminInfo.admin);
        }

        // Load initial data
        await this.loadMetrics();
        await this.loadComments();
        await this.loadVideos();
        
        // Start real-time metrics updates
        this.startRealTimeUpdates();
    }

    async getAdminInfo() {
        try {
            const response = await fetch(`${this.baseURL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok ? await response.json() : null;
        } catch (error) {
            return null;
        }
    }

    loadAdminInfo(admin) {
        document.getElementById('adminEmail').textContent = admin.email;
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load data for the selected tab
        switch(tabName) {
            case 'metrics':
                this.loadMetrics();
                break;
            case 'comments':
                this.loadComments();
                break;
            case 'videos':
                this.loadVideos();
                break;
            case 'games':
                this.loadGamesData();
                break;
            case 'winners':
                this.loadWinners();
                break;
            case 'jackpot':
                this.loadJackpotData();
                break;
        }
    }

    switchVideoTab(tabType) {
        // Update tab buttons
        document.querySelectorAll('.video-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${tabType}"]`).classList.add('active');

        // Update forms
        document.querySelectorAll('.video-form').forEach(form => {
            form.classList.remove('active');
        });
        
        if (tabType === 'youtube') {
            document.getElementById('videoUrlForm').classList.add('active');
        } else {
            document.getElementById('videoUploadForm').classList.add('active');
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    startIndiaTimeDisplay() {
        const updateIndiaTime = () => {
            const now = new Date();
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const indiaTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));
            
            const hours = indiaTime.getHours().toString().padStart(2, '0');
            const minutes = indiaTime.getMinutes().toString().padStart(2, '0');
            const seconds = indiaTime.getSeconds().toString().padStart(2, '0');
            const milliseconds = Math.floor(indiaTime.getMilliseconds() / 10).toString().padStart(2, '0');
            
            const timeString = `GMT+5:30 ${hours}:${minutes}:${seconds}:${milliseconds}`;
            
            const timeElement = document.getElementById('indiaTime');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
        };
        
        // Update immediately and then every 10 milliseconds for smooth ms display
        updateIndiaTime();
        setInterval(updateIndiaTime, 10);
    }

    // Real-time updates management
    startRealTimeUpdates() {
        // Update metrics every 30 seconds
        this.metricsInterval = setInterval(() => {
            if (document.getElementById('metrics').classList.contains('active')) {
                this.loadMetrics(true); // silent loading
            }
        }, 30000);
        
        // Update player activity every 5 seconds
        this.activityInterval = setInterval(() => {
            if (document.getElementById('metrics').classList.contains('active')) {
                this.loadLatestActivity();
            }
        }, 5000);
        
        // Load initial activity
        this.loadLatestActivity();
    }
    
    stopRealTimeUpdates() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
    }
    
    clearLoginErrors() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.classList.add('d-none');
            errorDiv.textContent = '';
        }
    }
    
    
    updateRealTimeIndicator(isRealTime) {
        const indicator = document.getElementById('realTimeIndicator');
        if (!indicator) return;
        
        if (isRealTime) {
            indicator.innerHTML = `
                <div class="live-indicator-dot live"></div>
                Live Data (Port 3003)
            `;
            indicator.classList.add('status-indicator', 'live');
            indicator.classList.remove('mock');
        } else {
            indicator.innerHTML = `
                <div class="live-indicator-dot mock"></div>
                Mock Data (Simulated)
            `;
            indicator.classList.add('status-indicator', 'mock');
            indicator.classList.remove('live');
        }
    }

    // User Interaction Metrics Management
    async loadMetrics(silent = false, search = '') {
        try {
            if (!silent) this.showLoading();
            
            const [overview, devices, tips, trend] = await Promise.all([
                this.fetchMetricsOverview(),
                this.fetchDeviceDistribution(),
                this.fetchTipPerformance(1, search),
                this.fetchMetricsTrend()
            ]);
            
            this.renderRealMetrics(overview, devices, tips, trend);
        } catch (error) {
            console.error('Error loading metrics:', error);
            // Fallback to mock data if API fails
            this.renderMockMetrics();
        } finally {
            if (!silent) this.hideLoading();
        }
    }

    async fetchMetricsOverview(days = 1) {
        const response = await fetch(`${this.baseURL}/api/metrics/overview?days=${days}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.ok ? await response.json() : null;
    }

    async fetchDeviceDistribution(days = 1) {
        const response = await fetch(`${this.baseURL}/api/metrics/devices?days=${days}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.ok ? await response.json() : null;
    }

    async fetchTipPerformance(days = 1, search = '') {
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
        
        const response = await fetch(`${this.baseURL}/api/metrics/tips?days=${days}${searchParam}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.ok ? await response.json() : null;
    }


    async fetchMetricsTrend(days = 7) {
        const response = await fetch(`${this.baseURL}/api/metrics/trend?days=${days}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.ok ? await response.json() : null;
    }

    async fetchLatestActivity(limit = 10) {
        const response = await fetch(`${this.baseURL}/api/metrics?sort=latest&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return response.ok ? await response.json() : null;
    }

    async loadLatestActivity() {
        try {
            const activityData = await this.fetchLatestActivity(10);
            if (activityData && activityData.success) {
                this.renderLatestActivity(activityData.data);
            }
        } catch (error) {
            console.error('Error loading latest activity:', error);
        }
    }

    renderLatestActivity(activities) {
        const container = document.getElementById('latestActivity');
        if (!container) return;

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="no-activity">
                    <i class="fas fa-clock"></i>
                    <span>No recent player activity</span>
                </div>
            `;
            return;
        }

        const activityHTML = activities.map(activity => {
            const timeAgo = this.getTimeAgo(new Date(activity.clickTimestamp));
            const deviceIcon = this.getDeviceIcon(activity.deviceType);
            const gameType = activity.gameType || activity.clickTarget || 'Game Click';
            const tipShort = activity.tipId;
            
            return `
                <div class="activity-item">
                    <div class="activity-main">
                        <div class="activity-icon">
                            ${deviceIcon}
                        </div>
                        <div class="activity-details">
                            <div class="activity-player">
                                ${activity.verifiedPhone || 'Guest Player'}
                            </div>
                            <div class="activity-game">${gameType}</div>
                        </div>
                    </div>
                    <div class="activity-meta">
                        <div class="activity-time">${timeAgo}</div>
                        <div class="activity-tip">${tipShort}</div>
                        ${activity.verifiedPhone ? `<div class="activity-phone">${activity.verifiedPhone}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = activityHTML;
    }

    getDeviceIcon(deviceType) {
        switch(deviceType?.toLowerCase()) {
            case 'mobile':
                return '<i class="fas fa-mobile-alt"></i>';
            case 'tablet':
                return '<i class="fas fa-tablet-alt"></i>';
            case 'desktop':
                return '<i class="fas fa-desktop"></i>';
            default:
                return '<i class="fas fa-mouse-pointer"></i>';
        }
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return `${seconds}s ago`;
    }

    setupSearchFunctionality() {
        const searchInput = document.getElementById('tipSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        
        if (!searchInput || !clearBtn) return;

        let searchTimeout;

        // Handle search input with debouncing
        searchInput.addEventListener('input', (e) => {
            const searchValue = e.target.value.trim();
            
            // Show/hide clear button
            if (searchValue) {
                clearBtn.classList.remove('d-none');
                clearBtn.classList.add('show');
            } else {
                clearBtn.classList.add('d-none');
                clearBtn.classList.remove('show');
            }

            // Debounce search requests
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.loadMetrics(true, searchValue);
            }, 300);
        });

        // Handle clear button
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('d-none');
            clearBtn.classList.remove('show');
            this.loadMetrics(true, '');
        });

        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                this.loadMetrics(true, e.target.value.trim());
            }
        });
    }

    renderRealMetrics(overview, devices, tips, trend) {
        if (overview) {
            // Update overview cards with real data
            document.getElementById('totalViews').textContent = overview.totalViews.value.toLocaleString();
            document.getElementById('verifiedPhones').textContent = overview.verifiedPhones.value.toLocaleString();
            document.getElementById('clickThroughRate').textContent = Math.round(overview.clickThroughRate.value) + '%';
            document.getElementById('avgTimeOnPage').textContent = overview.avgTimeOnPage.value + 's';
            
            // Update change indicators
            document.getElementById('totalViewsChange').textContent = `${overview.totalViews.change >= 0 ? '+' : ''}${overview.totalViews.change}% from last 24h`;
            document.getElementById('verifiedPhonesChange').textContent = `${overview.verifiedPhones.change >= 0 ? '+' : ''}${overview.verifiedPhones.change}% from last 24h`;
            document.getElementById('clickThroughRateChange').textContent = `${overview.clickThroughRate.change >= 0 ? '+' : ''}${overview.clickThroughRate.change}% from yesterday`;
            document.getElementById('avgTimeOnPageChange').textContent = `${overview.avgTimeOnPage.change >= 0 ? '+' : ''}${overview.avgTimeOnPage.change}% from yesterday`;
            
            // Update change colors
            this.updateChangeColors('totalViewsChange', overview.totalViews.change);
            this.updateChangeColors('verifiedPhonesChange', overview.verifiedPhones.change);
            this.updateChangeColors('clickThroughRateChange', overview.clickThroughRate.change);
            this.updateChangeColors('avgTimeOnPageChange', overview.avgTimeOnPage.change);
        }
        
        // Store trend data for theme refreshes
        this.lastTrendData = trend;
        
        // Create charts with real or trend data
        this.createRealCharts(trend);
        
        if (devices) {
            // Update device distribution
            const mobile = devices.mobile || { percentage: 0 };
            const desktop = devices.desktop || { percentage: 0 };
            const tablet = devices.tablet || { percentage: 0 };
            
            const mobilePerc = parseFloat(mobile.percentage);
            const desktopPerc = parseFloat(desktop.percentage);
            
            document.getElementById('mobilePercentage').textContent = mobilePerc + '%';
            document.getElementById('desktopPercentage').textContent = desktopPerc + '%';
            document.querySelector('.device-fill.mobile').style.setProperty('width', mobilePerc + '%');
            document.querySelector('.device-fill.desktop').style.setProperty('width', desktopPerc + '%');
        }
        
        if (tips && tips.length > 0) {
            // Update tips performance table
            const tipsTableBody = document.getElementById('tipsTableBody');
            tipsTableBody.innerHTML = tips.map(tip => {
                const lastActivityTime = tip.lastActivityTime ? this.getTimeAgo(new Date(tip.lastActivityTime)) : 'No activity';
                
                // Display phone number if available, otherwise show shortened tip ID
                let displayText = tip.tipId;
                let isPhoneNumber = false;
                
                // Check if displayId looks like a phone number
                if (tip.displayId && tip.displayId !== tip.tipId) {
                    const cleanDisplayId = tip.displayId.replace(/^\+/, '');
                    // Check if it's a phone number pattern (10-15 digits)
                    if (cleanDisplayId.match(/^\d{10,15}$/)) {
                        displayText = cleanDisplayId;
                        isPhoneNumber = true;
                    } else if (tip.displayId.startsWith('+') && tip.displayId.match(/^\+\d{10,15}$/)) {
                        displayText = tip.displayId.replace(/^\+/, '');
                        isPhoneNumber = true;
                    } else {
                        displayText = tip.displayId;
                    }
                } else {
                    // Show shortened tip ID
                    displayText = tip.tipId;
                }
                
                // Debug log to see what data we're getting
                console.log('Tip data:', { 
                    tipId: tip.tipId, 
                    displayId: tip.displayId, 
                    isVerifiedPhone: tip.isVerifiedPhone,
                    finalDisplay: displayText,
                    isPhoneNumber: isPhoneNumber
                });
                
                return `
                <tr>
                    <td class="${isPhoneNumber ? 'verified-phone' : ''}" title="${isPhoneNumber ? 'Verified Phone Number' : 'Tip ID'}">
                        ${isPhoneNumber ? `<span>${displayText.replace(/^\+/, '')}<img src="../images/untitled%20folder/blue-tick.png" class="verified-icon" alt="Verified"></span>` : displayText.replace(/^\+/, '')}
                    </td>
                    <td>${tip.views.toLocaleString()}</td>
                    <td>${tip.uniqueVisitors || 'N/A'}</td>
                    <td>${Math.round(tip.ctr)}%</td>
                    <td>${tip.avgTimeSeconds || 0}s</td>
                    <td>${lastActivityTime}</td>
                </tr>
            `}).join('');
        } else {
            document.getElementById('tipsTableBody').innerHTML = '<tr><td colspan="6" class="no-data">No tip data available yet</td></tr>';
        }
    }

    updateChangeColors(elementId, change) {
        const element = document.getElementById(elementId);
        const changeValue = parseFloat(change);
        element.classList.remove('change-positive', 'change-negative', 'change-neutral');
        if (changeValue > 0) {
            element.classList.add('change-positive');
        } else if (changeValue < 0) {
            element.classList.add('change-negative');
        } else {
            element.classList.add('change-neutral');
        }
    }

    createRealCharts(trendData) {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 },
                line: { tension: 0.4 }
            }
        };

        // Use real trend data if available, otherwise use mock data
        let labels, viewsData, clicksData, avgTimeData;
        
        if (trendData && trendData.length > 0) {
            labels = trendData.map(d => d._id);
            viewsData = trendData.map(d => d.views || 0);
            clicksData = trendData.map(d => d.clicks || 0);
            avgTimeData = trendData.map(d => Math.round((d.avgTimeMs || 0) / 1000));
            
            // Calculate unique visitors approximation (views * 0.8)
            const visitorsData = viewsData.map(v => Math.round(v * 0.8));
            // Calculate CTR
            const ctrData = viewsData.map((v, i) => v > 0 ? ((clicksData[i] / v) * 100) : 0);
            
            this.createChart('viewsChart', viewsData, 'views');
            this.createChart('visitorsChart', visitorsData, 'visitors');
            this.createChart('ctrChart', ctrData, 'ctr');
            this.createChart('timeChart', avgTimeData, 'time');
        } else {
            // Fallback to sample data
            this.createMiniCharts();
        }
    }

    createChart(canvasId, data, chartType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Get colors from CSS variables
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue(`--chart-${chartType}-border`);
        const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(`--chart-${chartType}-bg`);
        
        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: Array(data.length).fill(''),
                datasets: [{
                    data: data,
                    borderColor: borderColor.trim(),
                    backgroundColor: backgroundColor.trim(),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                },
                scales: {
                    x: { 
                        display: false,
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: { 
                        display: false,
                        grid: { display: false },
                        border: { display: false },
                        beginAtZero: true,
                        min: 0,
                        suggestedMax: function(context) {
                            const max = Math.max(...context.chart.data.datasets[0].data);
                            return max * 1.1; // Add 10% padding to prevent overflow
                        }
                    }
                },
                elements: {
                    point: { radius: 0 },
                    line: { tension: 0.4 }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                layout: {
                    padding: {
                        top: 5,
                        right: 5,
                        bottom: 5,
                        left: 5
                    }
                }
            }
        });
    }

    renderMockMetrics() {
        // Generate more realistic real-time mock data
        const now = new Date();
        const baseViews = 12000;
        const viewVariation = Math.floor(Math.random() * 1000) + 200;
        const totalViews = baseViews + viewVariation;
        const verifiedPhones = Math.floor(Math.random() * 15) + 8;
        const ctr = Math.round(2.8 + Math.random() * 0.8);
        const timeOnPage = Math.floor(38 + Math.random() * 10);
        
        // Update overview cards with dynamic mock data
        document.getElementById('totalViews').textContent = totalViews.toLocaleString();
        document.getElementById('verifiedPhones').textContent = verifiedPhones.toLocaleString();
        document.getElementById('clickThroughRate').textContent = ctr + '%';
        document.getElementById('avgTimeOnPage').textContent = timeOnPage + 's';
        
        // Generate realistic change indicators
        const viewsChange = (Math.random() * 20 - 5).toFixed(1);
        const phonesChange = (Math.random() * 15 - 3).toFixed(1);
        const ctrChange = Math.round(Math.random() * 6 - 2);
        const timeChange = (Math.random() * 10 - 3).toFixed(1);
        
        document.getElementById('totalViewsChange').textContent = `${viewsChange >= 0 ? '+' : ''}${viewsChange}% from last 24h`;
        document.getElementById('verifiedPhonesChange').textContent = `${phonesChange >= 0 ? '+' : ''}${phonesChange}% from last 24h`;
        document.getElementById('clickThroughRateChange').textContent = `${ctrChange >= 0 ? '+' : ''}${ctrChange}% from yesterday`;
        document.getElementById('avgTimeOnPageChange').textContent = `${timeChange >= 0 ? '+' : ''}${timeChange}% from yesterday`;
        
        // Update change colors
        this.updateChangeColors('totalViewsChange', viewsChange);
        this.updateChangeColors('verifiedPhonesChange', phonesChange);
        this.updateChangeColors('clickThroughRateChange', ctrChange);
        this.updateChangeColors('avgTimeOnPageChange', timeChange);
        
        // Create mini charts with dynamic data
        this.createMiniCharts();
        
        // Generate realistic device distribution
        const mobilePerc = Math.floor(65 + Math.random() * 8);
        const desktopPerc = 100 - mobilePerc;
        document.getElementById('mobilePercentage').textContent = mobilePerc + '%';
        document.getElementById('desktopPercentage').textContent = desktopPerc + '%';
        document.querySelector('.device-fill.mobile').style.setProperty('width', mobilePerc + '%');
        document.querySelector('.device-fill.desktop').style.setProperty('width', desktopPerc + '%');
        
        // Update tips performance table
        const tipsTableBody = document.getElementById('tipsTableBody');
        tipsTableBody.innerHTML = `
            <tr>
                <td>tip_20250724_001</td>
                <td>2,340</td>
                <td>1,890</td>
                <td>4.1%</td>
                <td>45s</td>
                <td>2 mins ago</td>
            </tr>
            <tr>
                <td>tip_20250724_002</td>
                <td>1,980</td>
                <td>1,560</td>
                <td>2.8%</td>
                <td>38s</td>
                <td>5 mins ago</td>
            </tr>
            <tr>
                <td>tip_20250724_003</td>
                <td>3,120</td>
                <td>2,450</td>
                <td>3.5%</td>
                <td>52s</td>
                <td>8 mins ago</td>
            </tr>
            <tr>
                <td>tip_20250724_004</td>
                <td>1,670</td>
                <td>1,320</td>
                <td>2.1%</td>
                <td>35s</td>
                <td>12 mins ago</td>
            </tr>
            <tr>
                <td>tip_20250724_005</td>
                <td>3,340</td>
                <td>2,100</td>
                <td>4.7%</td>
                <td>48s</td>
                <td>15 mins ago</td>
            </tr>
        `;
    }

    createMiniCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 },
                line: { tension: 0.4 }
            }
        };

        // Generate sample data for last 7 days with some randomness
        const labels = ['6d', '5d', '4d', '3d', '2d', '1d', 'Today'];
        const generateTrendData = (base, variation) => {
            return labels.map((_, i) => Math.floor(base + (Math.random() * variation) + (i * 200)));
        };
        
        // Views Chart
        if (this.charts['viewsChart']) {
            this.charts['viewsChart'].destroy();
        }
        this.charts['viewsChart'] = new Chart(document.getElementById('viewsChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: generateTrendData(8000, 2000),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-views-border'),
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-views-bg'),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        callbacks: {
                            title: () => 'Views',
                            label: (context) => `Views: ${context.parsed.y.toLocaleString()}`
                        }
                    }
                }
            }
        });

        // Visitors Chart
        if (this.charts['visitorsChart']) {
            this.charts['visitorsChart'].destroy();
        }
        this.charts['visitorsChart'] = new Chart(document.getElementById('visitorsChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: generateTrendData(6500, 1500),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-visitors-border'),
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-visitors-bg'),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        callbacks: {
                            title: () => 'Verified Phones',
                            label: (context) => `Phones: ${context.parsed.y.toLocaleString()}`
                        }
                    }
                }
            }
        });

        // CTR Chart
        if (this.charts['ctrChart']) {
            this.charts['ctrChart'].destroy();
        }
        this.charts['ctrChart'] = new Chart(document.getElementById('ctrChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: labels.map(() => parseFloat((2.5 + Math.random() * 1.5).toFixed(1))),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-ctr-border'),
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-ctr-bg'),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        callbacks: {
                            title: () => 'Click-Through Rate',
                            label: (context) => `CTR: ${context.parsed.y}%`
                        }
                    }
                }
            }
        });

        // Time Chart
        if (this.charts['timeChart']) {
            this.charts['timeChart'].destroy();
        }
        this.charts['timeChart'] = new Chart(document.getElementById('timeChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: labels.map(() => Math.floor(35 + Math.random() * 15)),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-time-border'),
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-time-bg'),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        callbacks: {
                            title: () => 'Avg. Time on Page',
                            label: (context) => `Time: ${context.parsed.y}s`
                        }
                    }
                }
            }
        });
    }

    renderBanners(banners) {
        const grid = document.getElementById('bannersGrid');
        grid.innerHTML = '';

        banners.forEach(banner => {
            const card = document.createElement('div');
            card.className = 'banner-card';
            card.innerHTML = `
                <img src="${this.baseURL}/uploads/banners/${banner.filename}" alt="${banner.title}" class="banner-image">
                <div class="banner-info">
                    <div class="banner-title">${banner.title || 'Untitled'}</div>
                    <div class="banner-meta">
                        Uploaded: ${new Date(banner.createdAt).toLocaleDateString()}<br>
                        Size: ${(banner.size / 1024).toFixed(1)} KB<br>
                        Status: <span class="status-badge ${banner.isActive ? 'status-active' : 'status-inactive'}">${banner.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="banner-actions">
                        <button class="btn btn-secondary" onclick="adminPanel.toggleBannerStatus('${banner._id}', ${!banner.isActive})">
                            ${banner.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger" onclick="adminPanel.deleteBanner('${banner._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async handleBannerUpload() {
        const form = document.getElementById('bannerForm');
        const fileInput = document.getElementById('bannerFile');
        
        // Validate file selection
        if (!fileInput.files || fileInput.files.length === 0) {
            this.showError('Please select a file to upload');
            return;
        }

        const file = fileInput.files[0];
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        // Validate file type
        if (!allowedTypes.includes(file.type)) {
            this.showError('Invalid file type. Please upload JPG, PNG, or WebP images only.');
            return;
        }

        // Validate file size
        if (file.size > maxSize) {
            this.showError('File size too large. Maximum size is 5MB.');
            return;
        }

        const formData = new FormData(form);

        try {
            this.showLoading();
            console.log('Uploading banner...', file.name, file.type, file.size);
            
            const response = await fetch(`${this.baseURL}/api/banners`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            console.log('Upload response:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('Upload successful:', result);
                this.closeBannerModal();
                await this.loadBanners();
                this.showSuccess('Banner uploaded successfully!');
            } else {
                const error = await response.json();
                console.error('Upload error:', error);
                this.showError(error.error || `Upload failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Network error:', error);
            this.showError(`Network error: ${error.message}. Please try again.`);
        } finally {
            this.hideLoading();
        }
    }

    async toggleBannerStatus(bannerId, isActive) {
        try {
            const response = await fetch(`${this.baseURL}/api/banners/${bannerId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive })
            });

            if (response.ok) {
                await this.loadBanners();
                this.showSuccess(`Banner ${isActive ? 'activated' : 'deactivated'} successfully!`);
            }
        } catch (error) {
            this.showError('Failed to update banner status');
        }
    }

    async deleteBanner(bannerId) {
        if (!confirm('Are you sure you want to delete this banner?')) return;

        try {
            const response = await fetch(`${this.baseURL}/api/banners/${bannerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                await this.loadBanners();
                this.showSuccess('Banner deleted successfully!');
            }
        } catch (error) {
            this.showError('Failed to delete banner');
        }
    }

    // Comment Management
    async seedSampleComments() {
        const sampleComments = [
            { username: "Desi****07", comment: "Kal Boxing King mein 20k jeet gaya bhai", avatar: "🎯" },
            { username: "Payal****ka", comment: "Lightning Roulette ne toh aaj kamaal kar diya", avatar: "💫" },
            { username: "BigS****am", comment: "Crazy Time still OP, consistent win milta hai.", avatar: "🎲" },
            { username: "Lucky****ha", comment: "Crazy Time ka bonus round hit kiya, full paisa double", avatar: "🍀" },
            { username: "Mast****Ji", comment: "Bhai timing matters a lot, raat 9-11 best hai.", avatar: "⏰" },
            { username: "Game****rl", comment: "Small bet se start karo, phir gradually increase.", avatar: "🎮" },
            { username: "Spin****Raj", comment: "PG Slot ka bonus round fatafat aaya", avatar: "🎰" },
            { username: "Lucky****ya", comment: "Evolution Gaming stream mast chal rahi thi", avatar: "♣️" },
            { username: "Reel****tar", comment: "Jili ke slots mein back to back wild mila 🔥", avatar: "🤑" },
            { username: "Baccarat****ji", comment: "Evolution Baccarat ne kal raat paisa double kar diya", avatar: "🃏" },
            { username: "Game****Ver", comment: "Fishing Yilufa mein bada bonus fish mila 😍", avatar: "🐟" },
            { username: "Munni****Baaz", comment: "Fastspin slots full speed mein chal rahe hain", avatar: "⚡" },
            { username: "Desi****Patel", comment: "Evolution Gaming ka thrill alag hi level ka hai", avatar: "🎴" },
            { username: "Rocket****ram", comment: "Crazy Time ka 10x multiplier dekh ke aankh phadak gayi 😂", avatar: "🚀" },
            { username: "Neha****Queen", comment: "BNG slots mein wilds line ban gayi thi", avatar: "👸" },
            { username: "Chintu****Win", comment: "Fish Hunter mein gold cannon ka kamaal dekha", avatar: "🔫" },
            { username: "King****Don", comment: "Live Roulette ne toh life bana di bhai", avatar: "🎯" },
            { username: "Tota****Bhai", comment: "PG Slots ka Fortune Tiger hit hai is week", avatar: "🐯" },
            { username: "Fast****Girl", comment: "Dinosaur Tycoon mein mast boss fight hua", avatar: "🦖" },
            { username: "Ludo****OP", comment: "Cash or Crash mein risky tha, par maza aaya", avatar: "🪂" },
            { username: "Spin****Didi", comment: "Treasure Bowl se treasure hi nikal gaya 😄", avatar: "💰" },
            { username: "Tiger****Maa", comment: "Dragon Tiger mein dragon streak chalu tha", avatar: "🐉" },
            { username: "Kismat****Boy", comment: "Monopoly Live ka Chance round full OP tha", avatar: "🏦" },
            { username: "Reel****Rani", comment: "PG Slot Fortune Rabbit ka bonus banger", avatar: "🐰" },
            { username: "Munna****Spin", comment: "Fishing ka laser cannon toh sab ud gaya", avatar: "💥" },
            { username: "Deal****King", comment: "Deal or No Deal mein banker barbaad ho gaya 😂", avatar: "💼" },
            { username: "Bet****Veer", comment: "Ganesha Fortune ka win ratio kaafi accha chal raha hai", avatar: "🃏" },
            { username: "Fish****Fan", comment: "Ocean King ne 200x diya bro", avatar: "🌊" },
            { username: "Lucky****Star", comment: "Jili ka Crazy Seven kaafi smooth chal raha hai", avatar: "⭐" },
            { username: "Patakha****Ji", comment: "Lightning Roulette mein 100x mila aaj", avatar: "⚡" },
            { username: "Dilli****Lad", comment: "Fastspin slots are totally underrated", avatar: "🎲" },
            { username: "Drama****Dee", comment: "Baccarat ka banker streak next level tha", avatar: "📈" },
            { username: "Lover****999", comment: "Slots ke graphics full Bollywood vibes de rahe hain", avatar: "🎬" },
            { username: "Jhakas****OP", comment: "Fishing Yilufa full paisa vasool game hai", avatar: "🎣" },
            { username: "Gamer****Toh", comment: "Crazy Time ke results unpredictable rehte hain", avatar: "🎡" },
            { username: "Naari****Power", comment: "Aaj girls bhi top leaderboard mein hain", avatar: "💃" },
            { username: "Andar****Pro", comment: "Fortune Gems ke liye time fix kar liya ab", avatar: "🕒" },
            { username: "OP****Dhamaka", comment: "Fish Catch mein golden bomb mila finally", avatar: "💣" },
            { username: "Reel****Sultan", comment: "PG Slots ne ek aur mega win diya", avatar: "🏆" },
            { username: "Toofan****Boy", comment: "Fastspin reels are full thunder mode", avatar: "🌪️" },
            { username: "Spin****Lover", comment: "Jili Lucky Ball ka round dekh ke maza aa gaya", avatar: "🎱" },
            { username: "Mast****Babu", comment: "Dealer ka luck match karta hai kya?", avatar: "🤔" },
            { username: "Bano****Raja", comment: "Evolution ka tension next level hai 😬", avatar: "🃏" },
            { username: "Fish****Mitra", comment: "Fish Hunter mein cannon upgrade ke baad OP ho gaya", avatar: "🔫" },
            { username: "Aish****Launda", comment: "Evolution Live Games ka vibe hi alag hai", avatar: "🎥" },
            { username: "Shanti****Patni", comment: "Crazy Time stream dekh ke betting sikhi", avatar: "📺" },
            { username: "Desi****Spin", comment: "Jili ka Golden Empire slot sahi chal raha hai", avatar: "👑" },
            { username: "Game****Kaka", comment: "Fish Battle Royale aaj full intense tha", avatar: "🔥" },
            { username: "Spin****Guru", comment: "PG Slot mein full jackpot laga aaj", avatar: "💸" },
            { username: "Rajni****Power", comment: "Live Blackjack stream kaafi informative thi", avatar: "♠️" },
            { username: "Toofan****Di", comment: "Slots mein 5x combo bana diya accidentally", avatar: "💥" },
            { username: "Tez****Chhora", comment: "Fastspin reels toh lightning se bhi tez hain", avatar: "⚡" },
            { username: "Item****Queen", comment: "Treasure Hunter ne aaj bhi line banayi hai!", avatar: "🏹" },
            { username: "Udaan****Girl", comment: "Fishing Yilufa ka dragon fish epic tha", avatar: "🐉" },
            { username: "Ladka****OP", comment: "Evolution Live ka UI bhi smooth lag raha hai", avatar: "🖥️" },
            { username: "Choti****Didi", comment: "Crazy Time wheel ne aaj fire de diya 🔥", avatar: "🎡" },
            { username: "Spin****Wale", comment: "PG Slot Tiger Warrior ka round lucky gaya", avatar: "🐅" },
            { username: "Bhola****Bhai", comment: "Dealer ki smile se hi pata chal gaya jeetne wale ka 😄", avatar: "😎" },
            { username: "Masti****Dost", comment: "Fastspin slot speed OP hai", avatar: "🏁" },
            { username: "Desi****Diva", comment: "Jili slots are underrated gems", avatar: "💎" },
            { username: "Patel****King", comment: "Fish game ka cannon blast sabse mazedaar part hai", avatar: "🔫" },
            { username: "Madam****Ji", comment: "PG game stream kal ka top trending tha", avatar: "🎥" },
            { username: "Munna****Fish", comment: "Laser cannon ka blast dekha? Full screen wipeout", avatar: "🚨" },
            { username: "Quick****OP", comment: "Live Blackjack ka pace sahi lagta hai", avatar: "⏱️" },
            { username: "Raja****999", comment: "Fortune Ox slot mein bada win aaya finally", avatar: "🐂" },
            { username: "Bebo****Lover", comment: "Streamer ki commentary aur bonus dono OP", avatar: "🎤" }
        ];

        let successCount = 0;
        let errorCount = 0;
        const batchSize = 5; // Process 5 comments at a time
        
        this.showSuccess(`Starting to add ${sampleComments.length} comments in batches of ${batchSize}...`);

        for (let i = 0; i < sampleComments.length; i += batchSize) {
            const batch = sampleComments.slice(i, i + batchSize);
            
            for (const comment of batch) {
                try {
                    const response = await fetch(`${this.baseURL}/api/comments`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: comment.username,
                            comment: comment.comment,
                            message: comment.comment, // API might use 'message' field
                            avatar: comment.avatar
                        })
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                    
                    // Small delay between requests within batch
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    errorCount++;
                }
            }
            
            // Longer pause between batches to respect rate limits
            if (i + batchSize < sampleComments.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.showSuccess(`Processed ${Math.min(i + batchSize, sampleComments.length)}/${sampleComments.length} comments...`);
            }
        }

        if (successCount > 0) {
            this.showSuccess(`Added ${successCount} sample comments successfully!`);
            await this.loadComments();
        }
        
        if (errorCount > 0) {
            this.showError(`Failed to add ${errorCount} comments (might already exist)`);
        }
    }

    async loadComments() {
        try {
            const response = await fetch(`${this.baseURL}/api/comments`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const comments = await response.json();
                this.renderComments(comments);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    renderComments(comments) {
        const table = document.getElementById('commentsTable');
        table.innerHTML = '';

        comments.forEach(comment => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.innerHTML = `
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-avatar">${comment.avatar}</span>
                        <span class="comment-username">${comment.username}</span>
                        <span class="comment-timestamp">${comment.timestamp}</span>
                        <span class="status-badge ${comment.isActive ? 'status-active' : 'status-inactive'}">${comment.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="comment-text">${comment.comment}</div>
                    <div class="comment-meta">Added: ${new Date(comment.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="comment-actions">
                    <button class="btn btn-secondary" onclick="adminPanel.editComment('${comment._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-secondary" onclick="adminPanel.toggleCommentStatus('${comment._id}', ${!comment.isActive})">
                        ${comment.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-danger" onclick="adminPanel.deleteComment('${comment._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            table.appendChild(item);
        });
    }

    async handleCommentSubmit() {
        const form = document.getElementById('commentForm');
        const formData = new FormData(form);
        const commentId = formData.get('id');
        
        const data = {
            username: formData.get('username'),
            comment: formData.get('comment'),
            avatar: formData.get('avatar'),
            timestamp: formData.get('timestamp') || undefined
        };

        try {
            this.showLoading();
            const url = commentId ? 
                `${this.baseURL}/api/comments/${commentId}` : 
                `${this.baseURL}/api/comments`;
            const method = commentId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeCommentModal();
                await this.loadComments();
                this.showSuccess(`Comment ${commentId ? 'updated' : 'added'} successfully!`);
            } else {
                const error = await response.json();
                this.showError(error.error || 'Operation failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    editComment(commentId) {
        // Find comment data and populate form
        // This is a simplified version - in a real app, you'd fetch the specific comment
        this.openCommentModal();
        document.getElementById('commentId').value = commentId;
    }

    async toggleCommentStatus(commentId, isActive) {
        try {
            const response = await fetch(`${this.baseURL}/api/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive })
            });

            if (response.ok) {
                await this.loadComments();
                this.showSuccess(`Comment ${isActive ? 'activated' : 'deactivated'} successfully!`);
            }
        } catch (error) {
            this.showError('Failed to update comment status');
        }
    }

    async deleteComment(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            const response = await fetch(`${this.baseURL}/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                await this.loadComments();
                this.showSuccess('Comment deleted successfully!');
            }
        } catch (error) {
            this.showError('Failed to delete comment');
        }
    }

    // Video Management
    async loadVideos() {
        try {
            // Load all videos for display
            const allResponse = await fetch(`${this.baseURL}/api/video/all`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (allResponse.ok) {
                const allVideos = await allResponse.json();
                this.renderVideoHistory(allVideos);
            }
        } catch (error) {
            console.error('Error loading videos:', error);
        }
    }

    /* renderCurrentVideo(video) {
        const content = document.getElementById('videoContent');
        
        if (!video) {
            content.innerHTML = `
                <div class="current-video">
                    <h3>No Active Video</h3>
                    <p>Add a video to get started.</p>
                </div>
            `;
            return;
        }

        let videoThumbnail = '';
        let videoUrl = '';
        
        if (video.videoType === 'youtube') {
            const videoId = this.extractYouTubeId(video.videoUrl);
            videoThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        } else {
            videoThumbnail = '/placeholder-video-thumbnail.jpg'; // You can add a placeholder
            videoUrl = `${this.baseURL}${video.videoUrl}`;
        }

        content.innerHTML = `
            <div class="current-video">
                <h3>Current Active Video</h3>
                <div class="video-thumbnail-container" onclick="window.open('${videoUrl}', '_blank')">
                    <div class="video-thumbnail">
                        <img src="${videoThumbnail}" alt="Video Thumbnail" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMzOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMzOCIgZmlsbD0iIzE4MjAyNSIvPjx0ZXh0IHg9IjMwMCIgeT0iMTY5IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+📺 Video Thumbnail</dGV4dD48L3N2Zz4='">
                        <div class="play-button">
                            <svg width="68" height="48" viewBox="0 0 68 48">
                                <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
                                <path d="M45,24 27,14 27,34" fill="#fff"></path>
                            </svg>
                        </div>
                        <div class="video-duration">
                            ${video.videoType === 'youtube' ? 'YouTube' : 'MP4'}
                        </div>
                    </div>
                </div>
                <div class="video-info">
                    <div class="video-title">${video.title || 'Untitled'}</div>
                    <div class="video-description">${video.description || ''}</div>
                    <div class="video-meta">
                        Type: ${video.videoType.toUpperCase()}<br>
                        Uploaded: ${new Date(video.createdAt).toLocaleDateString()}<br>
                        <a href="${videoUrl}" target="_blank" class="btn btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-play"></i> Watch Video
                        </a>
                    </div>
                </div>
            </div>
        `;
    } */

    renderVideoHistory(videos) {
        const history = document.getElementById('videoHistory');
        const historyContainer = history.querySelector('.video-history') || history;
        
        // Clear existing content except the h3
        const h3 = historyContainer.querySelector('h3');
        historyContainer.innerHTML = '';
        if (h3) historyContainer.appendChild(h3);

        videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'video-history-item';
            
            let thumbnailUrl = '';
            let videoUrl = '';
            
            if (video.videoType === 'youtube') {
                const videoId = this.extractYouTubeId(video.videoUrl);
                thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            } else {
                thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iIzM0MzUzZSIvPjx0ZXh0IHg9IjE2MCIgeT0iOTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5O6IE1QNCBWaWRlbzwvdGV4dD48L3N2Zz4=';
                videoUrl = `${this.baseURL}${video.videoUrl}`;
            }
            
            item.innerHTML = `
                <div class="video-history-thumbnail" onclick="previewTVSessionVideo('${videoUrl}')" style="width: 160px; height: 90px; position: relative; cursor: pointer; border-radius: 8px; overflow: hidden;">
                    <img src="${thumbnailUrl}" alt="Video thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="video-history-play" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 18px; background: rgba(255, 0, 0, 0.8); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
                <div class="video-history-details" style="flex: 1; display: flex; justify-content: space-between; align-items: flex-start; margin-left: 16px;">
                    <div class="video-history-info">
                        <h4 style="color: var(--text); font-size: 16px; font-weight: 600; margin-bottom: 8px;">${video.title || 'Untitled'} ${video.isActive ? '(Active)' : ''}</h4>
                        <p style="color: #666; font-size: 14px; margin-bottom: 8px;">${video.videoType.toUpperCase()} video for TV session</p>
                        <div class="video-meta" style="font-size: 12px; color: #94a3b8;">
                            <span>${video.videoType.toUpperCase()}</span> • <span>Added: ${new Date(video.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style="margin-top: 8px;">
                            <span class="status-badge ${video.isActive ? 'status-active' : 'status-inactive'}">${video.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <div class="tournament-video-actions" style="display: flex; gap: 8px;">
                        <button class="btn-small btn-preview" onclick="previewTVSessionVideo('${videoUrl}')" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; background: #48bb78; color: white; cursor: pointer;">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="btn-small btn-toggle" onclick="adminPanel.toggleVideoStatus('${video._id}', ${!video.isActive})" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; background: ${video.isActive ? '#ffc107' : '#28a745'}; color: white; cursor: pointer;">
                            <i class="fas fa-${video.isActive ? 'eye-slash' : 'eye'}"></i> ${video.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn-small btn-delete" onclick="adminPanel.deleteVideo('${video._id}')" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; background: #f56565; color: white; cursor: pointer;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            historyContainer.appendChild(item);
        });
    }

    async handleVideoUrlSubmit() {
        const form = document.getElementById('videoUrlForm');
        const formData = new FormData(form);
        
        const data = {
            videoType: 'youtube',
            videoUrl: formData.get('videoUrl'),
            title: formData.get('title'),
            description: formData.get('description')
        };

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/video/url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeVideoModal();
                await this.loadVideos();
                this.showSuccess('Video URL saved successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Save failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleVideoUpload() {
        const form = document.getElementById('videoUploadForm');
        const formData = new FormData(form);

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/video/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                this.closeVideoModal();
                await this.loadVideos();
                this.showSuccess('Video uploaded successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Upload failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async toggleVideoStatus(videoId, isActive) {
        try {
            const response = await fetch(`${this.baseURL}/api/video/${videoId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive })
            });

            if (response.ok) {
                await this.loadVideos();
                this.showSuccess(`Video ${isActive ? 'activated' : 'deactivated'} successfully!`);
            }
        } catch (error) {
            this.showError('Failed to update video status');
        }
    }

    async deleteVideo(videoId) {
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            const response = await fetch(`${this.baseURL}/api/video/${videoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                await this.loadVideos();
                this.showSuccess('Video deleted successfully!');
            }
        } catch (error) {
            this.showError('Failed to delete video');
        }
    }

    extractYouTubeId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : false;
    }

    // Modal Management
    openBannerModal() {
        document.getElementById('bannerModal').classList.add('show');
        document.getElementById('bannerForm').reset();
    }

    closeBannerModal() {
        document.getElementById('bannerModal').classList.remove('show');
    }

    openCommentModal() {
        document.getElementById('commentModal').classList.add('show');
        document.getElementById('commentForm').reset();
    }

    closeCommentModal() {
        document.getElementById('commentModal').classList.remove('show');
    }

    openVideoModal() {
        document.getElementById('videoModal').classList.add('show');
        document.getElementById('videoUrlForm').reset();
        document.getElementById('videoUploadForm').reset();
        this.switchVideoTab('youtube');
    }

    closeVideoModal() {
        document.getElementById('videoModal').classList.remove('show');
    }

    // Utility Methods
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Remove any existing notifications
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add to body
        document.body.appendChild(notification);

        // Show with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // ===============================
    // NEW FEATURES - GAMES MANAGEMENT
    // ===============================

    async loadGamesData() {
        const section = document.getElementById('games');
        if (!section.classList.contains('active')) return;

        try {
            // Load games list
            const gamesResponse = await fetch(`${this.baseURL}/api/games/list`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (gamesResponse.ok) {
                const games = await gamesResponse.json();
                this.renderGamesList(games);
            }
            
            // Load available images for modals
            await this.loadGameImages();
        } catch (error) {
            this.showError('Failed to load games data');
        }
    }

    renderGamesStatus(status) {
        const container = document.getElementById('gamesStatus');
        container.innerHTML = `
            <div class="status-item">
                <strong>Total Games in Pool:</strong> ${status.totalGames}
            </div>
            <div class="status-item">
                <strong>Configured Games per Day:</strong> ${status.configuredGames}
            </div>
            <div class="status-item">
                <strong>Last Refresh:</strong> ${new Date(status.lastRefresh).toLocaleString()}
            </div>
            <div class="status-item">
                <strong>Next Refresh:</strong> ${status.refreshTime} IST Daily
            </div>
            ${status.error ? `<div class="status-item error"><strong>Error:</strong> ${status.error}</div>` : ''}
        `;
    }

    async refreshDailyGames() {
        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/games/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadGamesData();
                this.showSuccess('Games pool refreshed successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Refresh failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async updateGamesConfig() {
        const totalGames = document.getElementById('totalGames').value;
        const refreshTime = document.getElementById('refreshTime').value;

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/games/config`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ totalGames: parseInt(totalGames), refreshTime })
            });

            if (response.ok) {
                await this.loadGamesData();
                this.showSuccess('Games configuration updated successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Update failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    renderGamesList(games) {
        const container = document.getElementById('gamesList');
        
        if (games.length === 0) {
            container.innerHTML = '<div class="empty-state">No games found. Add your first game!</div>';
            return;
        }

        container.innerHTML = games.map(game => `
            <div class="game-item">
                <div class="game-images">
                    <img src="/images/${game.image}" alt="${game.title}" class="game-image-preview" title="Game Image">
                </div>
                <div class="game-info">
                    <h4 class="game-title">${game.title}</h4>
                    <div class="game-win-info" style="color: var(--text-muted);">
                        <strong>${game.recentWin.amount}</strong> by ${game.recentWin.player}
                    </div>
                    <div class="game-win-comment" style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                        "${game.recentWin.comment.substring(0, 80)}${game.recentWin.comment.length > 80 ? '...' : ''}"
                    </div>
                    <div class="game-created" style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                        Added: ${new Date(game.createdAt).toLocaleDateString()}
                    </div>
                </div>
                <div class="game-actions">
                    <button class="btn ${game.active ? 'btn-success' : 'btn-outline-secondary'} btn-sm" 
                            onclick="adminPanel.toggleGame('${game._id}', ${!game.active})">
                        ${game.active ? 'Active' : 'Activate'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="adminPanel.editGame('${game._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteGame('${game._id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async loadGameImages() {
        if (this.gameImages) return; // Already loaded
        
        try {
            const response = await fetch(`${this.baseURL}/api/games/images`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.gameImages = await response.json();
                console.log('Loaded game images:', this.gameImages.length);
            }
        } catch (error) {
            console.error('Error loading game images:', error);
        }
    }

    renderImageGallery() {
        const gallery = document.getElementById('imageGallery');
        if (!this.gameImages) return;
        
        gallery.innerHTML = this.gameImages.map(image => `
            <div class="image-gallery-item" data-image="${image.filename}" onclick="adminPanel.selectImage('${image.filename}', '${image.name}', '${image.path}')">
                <img src="${image.path}" alt="${image.name}">
                <div class="image-name">${image.name}</div>
            </div>
        `).join('');
    }

    selectImage(filename, name, path) {
        // Remove previous selection
        document.querySelectorAll('.image-gallery-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        const selectedItem = document.querySelector(`[data-image="${filename}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Update hidden field and preview
        document.getElementById('selectedImage').value = filename;
        document.getElementById('selectedImageName').textContent = name;
        document.getElementById('selectedImageImg').src = path;
        document.getElementById('selectedImagePreview').classList.add('show');
        
        // Auto-fill game title with image name
        document.getElementById('gameTitle').value = name;
    }

    async openGameModal(gameId = null) {
        await this.loadGameImages(); // Ensure images are loaded
        
        const modal = document.getElementById('gameModal');
        const form = document.getElementById('gameForm');
        
        // Reset form and gallery
        form.reset();
        document.getElementById('gameId').value = '';
        document.getElementById('selectedImage').value = '';
        document.getElementById('selectedImagePreview').classList.remove('show');
        
        // Reset auto-generate checkboxes
        document.getElementById('autoAmount').checked = false;
        document.getElementById('autoPlayer').checked = false;
        document.getElementById('autoComment').checked = false;
        
        // Clear gallery selections
        document.querySelectorAll('.image-gallery-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        if (gameId) {
            // Edit mode - fetch and populate form
            try {
                const response = await fetch(`${this.baseURL}/api/games/list`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                const games = await response.json();
                const game = games.find(g => g._id === gameId);
                
                if (game) {
                    document.getElementById('gameId').value = game._id;
                    document.getElementById('gameTitle').value = game.title;
                    document.getElementById('winAmount').value = game.recentWin.amount;
                    document.getElementById('winPlayer').value = game.recentWin.player;
                    document.getElementById('winComment').value = game.recentWin.comment;
                    
                    // Pre-select the current image and disable gallery for edit mode
                    const gallery = document.getElementById('imageGallery');
                    gallery.classList.add('d-none');
                    document.getElementById('selectedImage').value = game.image;
                    document.getElementById('selectedImageName').textContent = game.image.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').replace(/-/g, ' ');
                    document.getElementById('selectedImageImg').src = `/images/${game.image}`;
                    document.getElementById('selectedImagePreview').classList.add('show');
                    
                    // Add note for edit mode
                    const galleryLabel = document.querySelector('label[for="imageGallery"]');
                    if (galleryLabel) {
                        galleryLabel.innerHTML = 'Current Image <small style="color: #666;">(Image cannot be changed in edit mode)</small>';
                    }
                }
            } catch (error) {
                console.error('Error loading game for edit:', error);
            }
        } else {
            // Add mode - show gallery
            document.getElementById('imageGallery').classList.remove('d-none');
            this.renderImageGallery();
            
            // Reset label
            const galleryLabel = document.querySelector('label[for="imageGallery"]');
            if (galleryLabel) {
                galleryLabel.textContent = 'Select Game Image';
            }
        }
        
        modal.classList.add('show');
    }

    closeGameModal() {
        document.getElementById('gameModal').classList.remove('show');
    }

    async handleGameSubmit() {
        const form = document.getElementById('gameForm');
        const gameId = document.getElementById('gameId').value;

        try {
            this.showLoading();
            
            if (gameId) {
                // Edit mode - JSON data for updates
                const gameData = {
                    title: form.title.value,
                    recentWin: {
                        amount: form.winAmount.value || '$5,000',
                        player: form.winPlayer.value || 'Lucky***Player',
                        comment: form.winComment.value || 'Amazing game! Just won big!'
                    }
                };
                
                const response = await fetch(`${this.baseURL}/api/games/${gameId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify(gameData)
                });

                if (response.ok) {
                    this.closeGameModal();
                    await this.loadGamesData();
                    this.showSuccess('Game updated successfully!');
                } else {
                    const error = await response.json();
                    this.showError(error.error || 'Update failed');
                }
            } else {
                // Add mode - JSON data for game creation
                const gameData = {
                    title: form.title.value,
                    selectedImage: form.selectedImage.value,
                    winAmount: form.winAmount.value || '$5,000',
                    winPlayer: form.winPlayer.value || 'Lucky***Player',
                    winComment: form.winComment.value || 'Amazing game! Just won big!'
                };
                
                const response = await fetch(`${this.baseURL}/api/games/add`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify(gameData)
                });

                if (response.ok) {
                    this.closeGameModal();
                    await this.loadGamesData();
                    this.showSuccess('Game added successfully!');
                } else {
                    const error = await response.json();
                    this.showError(error.error || 'Upload failed');
                }
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async toggleGame(gameId, newActiveState) {
        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/games/${gameId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ active: newActiveState })
            });
            
            if (response.ok) {
                await this.loadGamesData();
                this.showSuccess(`Game ${newActiveState ? 'activated' : 'deactivated'} successfully!`);
            } else {
                const error = await response.json();
                this.showError(error.error || 'Update failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async editGame(gameId) {
        await this.openGameModal(gameId);
    }

    async deleteGame(gameId) {
        if (!confirm('Are you sure you want to delete this game?')) return;

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/games/${gameId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadGamesData();
                this.showSuccess('Game deleted successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Delete failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    // ===============================
    // WINNERS MANAGEMENT
    // ===============================

    async loadWinners() {
        const section = document.getElementById('winners');
        if (!section.classList.contains('active')) return;

        try {
            const response = await fetch(`${this.baseURL}/api/winners`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const winners = await response.json();
                this.renderWinners(winners);
            } else {
                this.showError('Failed to load winners');
            }
        } catch (error) {
            this.showError('Failed to load winners');
        }
    }

    renderWinners(winners) {
        const container = document.getElementById('winnersTable');
        
        if (winners.length === 0) {
            container.innerHTML = '<div class="empty-state">No winners found. Add your first winner!</div>';
            return;
        }

        container.innerHTML = winners.map(winner => `
            <div class="winner-item">
                <div class="winner-info">
                    <div class="winner-avatar">${winner.avatar || '🎰'}</div>
                    <div class="winner-details">
                        <h4>${winner.username}</h4>
                        <p>${winner.game} • ${winner.multiplier}</p>
                        <small>Bet: ₹${winner.betAmount} → Win: ₹${winner.winAmount.toLocaleString()}</small>
                        <div class="winner-quote">"${winner.quote}"</div>
                    </div>
                </div>
                <div class="winner-amount">₹${winner.winAmount.toLocaleString()}</div>
                <div class="winner-actions">
                    <span class="status-badge ${winner.active ? 'status-active' : 'status-inactive'}">
                        ${winner.active ? 'Active' : 'Inactive'}
                    </span>
                    <button class="btn btn-secondary btn-sm" onclick="adminPanel.editWinner('${winner._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteWinner('${winner._id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    openWinnerModal(winnerId = null) {
        const modal = document.getElementById('winnerModal');
        const form = document.getElementById('winnerForm');
        
        if (winnerId) {
            // Edit mode - populate form
            // Implementation would fetch winner data and populate form
        } else {
            // Add mode - reset form
            form.reset();
            document.getElementById('winnerId').value = '';
        }
        
        modal.classList.add('show');
        
        // Set up form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.handleWinnerSubmit();
        };
    }

    closeWinnerModal() {
        document.getElementById('winnerModal').classList.remove('show');
    }

    async handleWinnerSubmit() {
        const form = document.getElementById('winnerForm');
        const formData = new FormData(form);
        
        const data = {
            username: formData.get('username'),
            game: formData.get('game'),
            betAmount: formData.get('betAmount'),
            winAmount: formData.get('winAmount'),
            multiplier: formData.get('multiplier'),
            quote: formData.get('quote'),
            avatar: formData.get('avatar')
        };

        console.log('Submitting winner data:', data);

        try {
            this.showLoading();
            const winnerId = formData.get('id');
            const url = winnerId ? `/api/winners/${winnerId}` : '/api/winners';
            const method = winnerId ? 'PUT' : 'POST';

            const response = await fetch(`${this.baseURL}${url}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeWinnerModal();
                await this.loadWinners();
                this.showSuccess('Winner saved successfully!');
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('API Error:', error);
                console.error('Response status:', response.status);
                this.showError(error.error || `Save failed (${response.status})`);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async deleteWinner(winnerId) {
        if (!confirm('Are you sure you want to delete this winner?')) return;

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/winners/${winnerId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadWinners();
                this.showSuccess('Winner deleted successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Delete failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    // ===============================
    // JACKPOT MANAGEMENT
    // ===============================

    async loadJackpotData() {
        const section = document.getElementById('jackpot');
        if (!section.classList.contains('active')) return;

        try {
            const response = await fetch(`${this.baseURL}/api/jackpot`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const messages = await response.json();
                this.renderJackpotMessages(messages);
            }

            // Load prediction times
            this.renderPredictionTimes();
        } catch (error) {
            this.showError('Failed to load jackpot data');
        }
    }

    renderPredictionTimes() {
        const container = document.getElementById('predictionTimes');
        const times = ['2:00 AM', '10:00 AM', '5:00 PM'];
        
        container.innerHTML = times.map(time => `
            <div class="prediction-time-item">
                <span>${time} IST</span>
                <span class="status-badge status-active">Active</span>
            </div>
        `).join('');
    }

    renderJackpotMessages(messages) {
        const container = document.getElementById('jackpotMessagesTable');
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No jackpot messages found. Add your first message!</div>';
            return;
        }

        container.innerHTML = messages.map(message => `
            <div class="message-item">
                <div class="message-content">
                    <div class="message-text">${message.message}</div>
                    <div class="message-meta">
                        <span class="message-category">${message.category}</span>
                        <span class="message-time">⏰ ${this.formatPredictionTime(message.predictionTime)}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <button class="btn ${message.active ? 'btn-success' : 'btn-outline-secondary'} btn-sm" 
                            onclick="adminPanel.toggleJackpotMessage('${message._id}', ${!message.active})">
                        ${message.active ? 'Active' : 'Activate'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="adminPanel.editJackpotMessage('${message._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="adminPanel.deleteJackpotMessage('${message._id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async openJackpotModal(messageId = null) {
        const modal = document.getElementById('jackpotModal');
        const form = document.getElementById('jackpotForm');
        
        if (messageId) {
            // Edit mode - fetch and populate form
            try {
                const response = await fetch(`${this.baseURL}/api/jackpot`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                const messages = await response.json();
                const message = messages.find(m => m._id === messageId);
                
                if (message) {
                    document.getElementById('jackpotId').value = message._id;
                    document.getElementById('jackpotMessage').value = message.message;
                    document.getElementById('jackpotCategory').value = message.category;
                    document.getElementById('jackpotTime').value = message.predictionTime || '';
                }
            } catch (error) {
                console.error('Error loading message for edit:', error);
            }
        } else {
            // Add mode - reset form
            form.reset();
            document.getElementById('jackpotId').value = '';
        }
        
        modal.classList.add('show');
        
        // Set up form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.handleJackpotSubmit();
        };
    }

    closeJackpotModal() {
        document.getElementById('jackpotModal').classList.remove('show');
    }

    async handleJackpotSubmit() {
        const form = document.getElementById('jackpotForm');
        const formData = new FormData(form);
        
        const data = {
            message: formData.get('message'),
            category: formData.get('category'),
            predictionTime: formData.get('predictionTime')
        };

        try {
            this.showLoading();
            const messageId = formData.get('id');
            const url = messageId ? `/api/jackpot/${messageId}` : '/api/jackpot';
            const method = messageId ? 'PUT' : 'POST';

            const response = await fetch(`${this.baseURL}${url}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeJackpotModal();
                await this.loadJackpotData();
                this.showSuccess('Jackpot message saved successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Save failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async toggleJackpotMessage(messageId, newActiveState) {
        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/jackpot/${messageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ active: newActiveState })
            });
            
            if (response.ok) {
                await this.loadJackpotData();
                this.showSuccess(`Jackpot message ${newActiveState ? 'activated' : 'deactivated'} successfully!`);
            } else {
                const error = await response.json();
                this.showError(error.error || 'Update failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async deleteJackpotMessage(messageId) {
        if (!confirm('Are you sure you want to delete this jackpot message?')) return;

        try {
            this.showLoading();
            const response = await fetch(`${this.baseURL}/api/jackpot/${messageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                await this.loadJackpotData();
                this.showSuccess('Jackpot message deleted successfully!');
            } else {
                const error = await response.json();
                this.showError(error.error || 'Delete failed');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    formatPredictionTime(predictionTime) {
        if (!predictionTime) return 'No time set';
        
        const timeMap = {
            '2:00': '2:00 AM',
            '10:00': '10:00 AM', 
            '17:00': '5:00 PM'
        };
        
        return timeMap[predictionTime] || predictionTime;
    }

    async editJackpotMessage(messageId) {
        await this.openJackpotModal(messageId);
    }

    // Theme Management Methods
    initThemeEarly() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        // Set initial theme
        this.setTheme(savedTheme);
        
        // Add click listener
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            // Update icon: Moon for light mode, Sun for dark mode
            themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        }
        
        // Refresh charts to use new theme colors
        if (this.charts && Object.keys(this.charts).length > 0) {
            // Try to refresh with real data if available, otherwise use mock data
            if (this.lastTrendData) {
                this.createRealCharts(this.lastTrendData);
            } else {
                this.createMiniCharts();
            }
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

}

// Global functions for onclick handlers
function refreshMetrics() {
    adminPanel.loadMetrics();
}


function openCommentModal() {
    adminPanel.openCommentModal();
}

function closeCommentModal() {
    adminPanel.closeCommentModal();
}

function openVideoModal() {
    adminPanel.openVideoModal();
}

function closeVideoModal() {
    adminPanel.closeVideoModal();
}

function openWinnerModal() {
    adminPanel.openWinnerModal();
}

function closeWinnerModal() {
    adminPanel.closeWinnerModal();
}

function openJackpotModal() {
    adminPanel.openJackpotModal();
}

function closeJackpotModal() {
    adminPanel.closeJackpotModal();
}

function refreshDailyGames() {
    adminPanel.refreshDailyGames();
}

function openGameModal() {
    adminPanel.openGameModal();
}

function closeGameModal() {
    adminPanel.closeGameModal();
}

// Auto-generation functions for game modal
function toggleAutoGenerate(type) {
    const checkbox = document.getElementById(`auto${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    if (checkbox.checked) {
        generateAndFill(type);
    } else {
        // Clear the field when unchecked
        clearField(type);
    }
}

function generateAndFill(type) {
    switch (type) {
        case 'amount':
            const amount = Math.floor(Math.random() * (40000 - 3000) + 3000);
            document.getElementById('winAmount').value = `₹${amount.toLocaleString('en-IN')}`;
            break;
            
        case 'player':
            const playerName = generatePlayerName();
            document.getElementById('winPlayer').value = playerName;
            break;
            
        case 'comment':
            const comment = generateGameComment();
            document.getElementById('winComment').value = comment;
            break;
    }
}

function generatePlayerName() {
    const indianNames = [
        'Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anita', 'Suresh', 'Kavita',
        'Rahul', 'Meera', 'Arjun', 'Pooja', 'Kiran', 'Deepika', 'Rohan', 'Shreya',
        'Anil', 'Ritu', 'Manoj', 'Nisha', 'Sanjay', 'Geeta', 'Vinay', 'Sunita',
        'Ravi', 'Lata', 'Ajay', 'Manju', 'Prakash', 'Seema', 'Gopal', 'Usha',
        'Neha', 'Harsh', 'Divya', 'Abhishek', 'Isha', 'Karthik', 'Swati', 'Tushar',
        'Bhavna', 'Yash', 'Chitra', 'Mohit', 'Tanvi', 'Nikhil', 'Payal', 'Dev',
        'Juhi', 'Alok', 'Madhuri', 'Sameer', 'Lucky', 'Game', 'Winner', 'Spin'
    ];
    
    const cities = [
        'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad',
        'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal', 'Visakhapatnam', 'Patna',
        'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot'
    ];
    
    const name = indianNames[Math.floor(Math.random() * indianNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const vipLevel = Math.floor(Math.random() * 20) + 1;
    
    return `${name}${city.charAt(0)}*** VIP ${vipLevel}`;
}

function generateGameComment() {
    const gameComments = [
        "Amazing game! Just won big!",
        "I can't believe I hit the jackpot! This game is incredible!",
        "The bonus rounds kept coming and the multipliers were insane!",
        "Bhai full paisa vasool ho gaya aaj!",
        "Aaj toh lag raha hai mera din hai!",
        "Arre yaar itna paisa dekh kar khushi se jump kar raha hu!",
        "Main toh pagal ho gayi hu khushi se!",
        "Hit blackjack 5 times in a row! Amazing luck!",
        "Royal flush on my third hand! The graphics are amazing!",
        "Found the treasure chest bonus! The free spins kept triggering!",
        "Lightning struck three times! The multipliers are crazy!",
        "The cyberpunk vibes are unreal! Hit the progressive bonus!",
        "Four of a kind with aces. The animations are breathtaking!",
        "Yeehaw! Hit the saloon bonus round and couldn't stop winning!",
        "Dove deep and found the pearl jackpot! Gorgeous theme!",
        "Put it all on red and won! Then did it again!",
        "The space theme makes every spin feel epic!",
        "BNG slots mein aj ka spin OP gaya!",
        "PG Slots mein aaj full paisa vasool!",
        "Golden Empire slot ka bonus round dekhna banta hai!",
        "3 wild symbols back-to-back mila bhai 🔥",
        "Treasure Hunter ne toh dil khush kar diya!",
        "Jili ke Lucky Ball ne mega win diya!",
        "Wild Wild Riches se 100x aaya re baba!",
        "Lightning Roulette ne aaj 100x diya!",
        "Tiger win streak dekh ke shock lag gaya!",
        "Evolution ke live games full paisa vasool lagte hain!",
        "Aaj toh full entertainment mil raha hai!",
        "Sab game mein loot machi hai bhai log!"
    ];
    
    return gameComments[Math.floor(Math.random() * gameComments.length)];
}

function clearField(type) {
    switch (type) {
        case 'amount':
            document.getElementById('winAmount').value = '';
            break;
        case 'player':
            document.getElementById('winPlayer').value = '';
            break;
        case 'comment':
            document.getElementById('winComment').value = '';
            break;
    }
}

function updateGamesConfig() {
    adminPanel.updateGamesConfig();
}

// Video dropdown functions
function toggleVideoDropdown(videoId) {
    const dropdown = document.getElementById(`dropdown-${videoId}`);
    const isVisible = dropdown.classList.contains('show');
    
    // Hide all other dropdowns first
    document.querySelectorAll('.dropdown-content.show').forEach(dd => {
        dd.classList.remove('show');
    });
    
    // Toggle current dropdown
    if (!isVisible) {
        dropdown.classList.add('show');
    }
}

function hideVideoDropdown(videoId) {
    const dropdown = document.getElementById(`dropdown-${videoId}`);
    dropdown.classList.remove('show');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown-menu')) {
        document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

// OTP Management Functions
let currentOTPPage = 1;
let otpLogsPerPage = 10;

async function loadOTPLogs(page = 1) {
    try {
        const response = await fetch(`/api/otp/logs?page=${page}&limit=${otpLogsPerPage}`);
        const data = await response.json();
        
        if (data.success) {
            displayOTPLogs(data.logs);
            updateOTPPagination(data.pagination);
            currentOTPPage = page;
        } else {
            throw new Error('Failed to load OTP logs');
        }
    } catch (error) {
        console.error('Error loading OTP logs:', error);
        document.getElementById('otpTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="loading-message" style="color: red;">
                    Error loading OTP logs: ${error.message}
                </td>
            </tr>
        `;
    }
}

async function loadOTPStats() {
    try {
        const response = await fetch('/api/otp/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('totalRequests').textContent = stats.totalRequests;
            document.getElementById('todayRequests').textContent = stats.todayRequests;
            document.getElementById('uniquePhones').textContent = stats.uniquePhoneNumbers;
            
            if (stats.lastRequestTime) {
                const lastTime = new Date(stats.lastRequestTime);
                const timeStr = lastTime.toLocaleString();
                document.getElementById('lastRequestTime').textContent = timeStr;
            } else {
                document.getElementById('lastRequestTime').textContent = 'Never';
            }
        }
    } catch (error) {
        console.error('Error loading OTP stats:', error);
    }
}

function displayOTPLogs(logs) {
    const tbody = document.getElementById('otpTableBody');
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-message">
                    No OTP logs found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const truncatedUA = log.userAgent.length > 50 ? 
            log.userAgent.substring(0, 50) + '...' : log.userAgent;
        
        const action = log.action || 'verification';
        const actionBadge = action === 'request' ? 
            '<span class="action-badge request">REQUEST</span>' : 
            '<span class="action-badge verification">VERIFY</span>';
        
        // Status badge for requests
        let statusBadge = '';
        if (action === 'request') {
            const status = log.status || 'pending';
            if (status === 'verified') {
                statusBadge = '<span class="status-badge verified">VERIFIED</span>';
            } else {
                statusBadge = '<span class="status-badge pending">PENDING</span>';
            }
        } else {
            statusBadge = '<span class="status-badge complete">COMPLETE</span>';
        }
        
        return `
            <tr>
                <td class="timestamp">${timestamp}</td>
                <td class="phone-number">${log.phone.replace(/^\+/, '')}</td>
                <td><span class="otp-code">${log.otpCode}</span></td>
                <td class="action-column">${actionBadge}</td>
                <td class="status-column">${statusBadge}</td>
                <td class="ip-address">${log.ip}</td>
                <td class="user-agent" title="${log.userAgent}">${truncatedUA}</td>
            </tr>
        `;
    }).join('');
}

function updateOTPPagination(pagination) {
    const paginationDiv = document.getElementById('otpPagination');
    const tableInfoDiv = document.getElementById('otpTableInfo');
    
    // Update table info
    const startItem = ((pagination.current - 1) * otpLogsPerPage) + 1;
    const endItem = Math.min(pagination.current * otpLogsPerPage, pagination.totalLogs);
    tableInfoDiv.textContent = `Showing ${startItem}-${endItem} of ${pagination.totalLogs} entries`;
    
    if (pagination.total <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // First page button
    if (pagination.current > 2) {
        paginationHTML += `
            <button onclick="loadOTPLogs(1)" class="pagination-btn">
                <i class="fas fa-angle-double-left"></i>
            </button>
        `;
    }
    
    // Previous button
    paginationHTML += `
        <button onclick="loadOTPLogs(${pagination.current - 1})" 
                class="pagination-btn"
                ${pagination.current === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    // Page numbers (show current page and 2 pages before/after)
    const startPage = Math.max(1, pagination.current - 2);
    const endPage = Math.min(pagination.total, pagination.current + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="loadOTPLogs(${i})" 
                    class="pagination-btn page-number ${i === pagination.current ? 'active' : ''}"
                    ${i === pagination.current ? 'disabled' : ''}>
                ${i}
            </button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="loadOTPLogs(${pagination.current + 1})" 
                class="pagination-btn"
                ${pagination.current === pagination.total ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    // Last page button
    if (pagination.current < pagination.total - 1) {
        paginationHTML += `
            <button onclick="loadOTPLogs(${pagination.total})" class="pagination-btn">
                <i class="fas fa-angle-double-right"></i>
            </button>
        `;
    }
    
    paginationDiv.innerHTML = paginationHTML;
}

function changeOTPPageSize(newSize) {
    otpLogsPerPage = parseInt(newSize);
    currentOTPPage = 1; // Reset to first page when changing page size
    loadOTPLogs(1);
}

async function refreshOTPLogs() {
    await loadOTPStats();
    await loadOTPLogs(currentOTPPage);
}

async function clearOTPLogs() {
    if (!confirm('Are you sure you want to clear all OTP logs? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/otp/clear', {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            await refreshOTPLogs();
        } else {
            throw new Error('Failed to clear logs');
        }
    } catch (error) {
        console.error('Error clearing OTP logs:', error);
        alert('Error clearing logs: ' + error.message);
    }
}

// Tournament TV Management
let tournamentTVPlaylist = [
    'Fr3bXkHriGM', 
    'POl3GtraHeo&t',
    'ma5lm-ExMaA',
    'akm4ys-WUN0',
    'n14gIPk9_yo',
    'GPXxOzK8A50',
    'f0tUF8RLHwE',
    'CfrVafvX3XI',
    'D8g38fkFHFw',
    'be1pSS2NSbY',
    '7Bw0FSjSRpI',
    'sZo46xEeOi4',
    'GQUl8O97-S8',
];

let currentTournamentVideoIndex = 0;

function loadTournamentTVPlaylist() {
    currentTournamentVideoIndex = Math.floor(Math.random() * tournamentTVPlaylist.length);
    const videoId = tournamentTVPlaylist[currentTournamentVideoIndex];
    
    // Display current video
    const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    document.getElementById('currentTournamentThumbnail').src = thumbnail;
    document.getElementById('currentTournamentTitle').textContent = 'Tournament Live Stream';
    document.getElementById('currentTournamentDescription').textContent = 'Live tournament action and highlights';
    
    // Render playlist
    renderTournamentPlaylist();
}

function renderTournamentPlaylist() {
    const container = document.getElementById('tournamentPlaylistContainer');
    
    if (tournamentTVPlaylist.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tv"></i>
                <h3>No videos in playlist</h3>
                <p>Add videos to create the tournament TV playlist</p>
                <button class="btn btn-primary" onclick="openTournamentVideoModal()">
                    <i class="fas fa-plus"></i> Add First Video
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = tournamentTVPlaylist.map((videoId, index) => {
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const isCurrentVideo = index === currentTournamentVideoIndex;
        
        return `
            <div class="video-history-item ${isCurrentVideo ? 'current-playing' : ''}" style="margin-bottom: 15px;">
                <div class="video-history-thumbnail" onclick="previewTournamentVideo('${videoId}')" style="width: 160px; height: 90px; position: relative; cursor: pointer; border-radius: 8px; overflow: hidden;">
                    <img src="${thumbnail}" alt="Video thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="video-history-play" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 18px; background: rgba(255, 0, 0, 0.8); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
                <div class="video-history-details" style="flex: 1; display: flex; justify-content: space-between; align-items: flex-start; margin-left: 16px;">
                    <div class="video-history-info">
                        <h4 style="color: var(--text); font-size: 16px; font-weight: 600; margin-bottom: 8px;">Tournament Video ${index + 1} ${isCurrentVideo ? '(Currently Playing)' : ''}</h4>
                        <p style="color: #666; font-size: 14px; margin-bottom: 8px;">Tournament highlights and live action</p>
                        <div class="video-meta" style="font-size: 12px; color: #94a3b8;">
                            <span>YouTube</span> • <span>Video ID: ${videoId}</span>
                        </div>
                    </div>
                    <div class="tournament-video-actions" style="display: flex; gap: 8px;">
                        <button class="btn-small btn-preview" onclick="previewTournamentVideo('${videoId}')" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; background: #48bb78; color: white; cursor: pointer;">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="btn-small btn-delete" onclick="deleteTournamentVideo(${index})" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; background: #f56565; color: white; cursor: pointer;">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openTournamentVideoModal() {
    document.getElementById('tournamentVideoModal').classList.add('flex');
    resetTournamentVideoForms();
}

function closeTournamentVideoModal() {
    document.getElementById('tournamentVideoModal').classList.remove('flex');
    resetTournamentVideoForms();
}

function resetTournamentVideoForms() {
    document.getElementById('tournamentYoutubeForm').reset();
    document.getElementById('tournamentStreamForm').reset();
}

function switchTournamentVideoTab(type) {
    // Update tab buttons
    document.querySelectorAll('#tournamentVideoModal .video-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#tournamentVideoModal [data-type="${type}"]`).classList.add('active');

    // Update forms
    document.querySelectorAll('#tournamentVideoModal .video-form').forEach(form => {
        form.classList.remove('active');
    });
    
    if (type === 'youtube') {
        document.getElementById('tournamentYoutubeForm').classList.add('active');
    } else {
        document.getElementById('tournamentStreamForm').classList.add('active');
    }
}

function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function playCurrentTournamentVideo() {
    if (tournamentTVPlaylist.length > 0) {
        const videoId = tournamentTVPlaylist[currentTournamentVideoIndex];
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
}

function previewTournamentVideo(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
}

function previewTVSessionVideo(videoUrl) {
    window.open(videoUrl, '_blank');
}

function deleteTournamentVideo(index) {
    if (confirm('Are you sure you want to remove this video from the tournament TV playlist?')) {
        tournamentTVPlaylist.splice(index, 1);
        
        // Update current video index if needed
        if (currentTournamentVideoIndex >= index && currentTournamentVideoIndex > 0) {
            currentTournamentVideoIndex = Math.max(0, currentTournamentVideoIndex - 1);
        }
        
        renderTournamentPlaylist();
        loadTournamentTVPlaylist();
        
        // Show success message
        showTournamentSuccess('Video removed from playlist');
    }
}

function showTournamentSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Tournament TV form submissions
document.addEventListener('DOMContentLoaded', function() {
    // YouTube form submission
    document.getElementById('tournamentYoutubeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const videoUrl = formData.get('videoUrl');
        
        const videoId = extractYouTubeId(videoUrl);
        if (!videoId) {
            alert('Invalid YouTube URL. Please check the URL and try again.');
            return;
        }
        
        // Add to playlist
        tournamentTVPlaylist.push(videoId);
        
        closeTournamentVideoModal();
        renderTournamentPlaylist();
        showTournamentSuccess('Video added to tournament TV playlist');
    });
    
    // Stream form submission
    document.getElementById('tournamentStreamForm').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Live stream integration coming soon!');
    });
});

// Initialize the admin panel
const adminPanel = new AdminPanel();

// OTP real-time refresh interval
let otpRefreshInterval = null;

// Load OTP data when OTP tab is activated
document.addEventListener('DOMContentLoaded', function() {
    // Override the existing tab switching to load OTP data
    const originalSwitchTab = adminPanel.switchTab;
    adminPanel.switchTab = function(tabName) {
        originalSwitchTab.call(this, tabName);
        
        if (tabName === 'otp-requests') {
            loadOTPStats();
            loadOTPLogs(1);
            
            // Start real-time refresh every 5 seconds
            if (otpRefreshInterval) {
                clearInterval(otpRefreshInterval);
            }
            otpRefreshInterval = setInterval(async () => {
                await loadOTPStats();
                await loadOTPLogs(currentOTPPage);
            }, 5000);
        } else if (tabName === 'tournament-tv') {
            // Load tournament TV playlist when tab is activated
            loadTournamentTVPlaylist();
        } else {
            // Stop refresh when switching away from OTP tab
            if (otpRefreshInterval) {
                clearInterval(otpRefreshInterval);
                otpRefreshInterval = null;
            }
        }
    };
});

// Custom Calendar Variables
let currentCalendarDate = new Date();
let selectedCalendarDate = null;
let targetInputId = null;

// Date picker functions
function openDatePicker(inputId) {
    targetInputId = inputId;
    showCalendar();
}

function updateDateInput(inputId, dateValue) {
    const textInput = document.getElementById(inputId);
    if (dateValue) {
        // Format date to readable format (DD/MM/YYYY)
        const date = new Date(dateValue);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        textInput.value = `${day}/${month}/${year}`;
    }
}

// Custom Calendar Functions
function showCalendar() {
    const modal = document.getElementById('calendarModal');
    modal.classList.add('show');
    renderCalendar();
    
    // Add event listeners
    document.getElementById('prevMonth').onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    };
    
    document.getElementById('nextMonth').onclick = () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    };
    
    // Close calendar when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeCalendar();
        }
    };
}

function closeCalendar() {
    const modal = document.getElementById('calendarModal');
    modal.classList.remove('show');
    selectedCalendarDate = null;
}

function renderCalendar() {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const currentMonth = currentCalendarDate.getMonth();
    const currentYear = currentCalendarDate.getFullYear();
    
    // Update header
    document.getElementById('currentMonth').textContent = monthNames[currentMonth];
    document.getElementById('currentYear').textContent = currentYear;
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get previous month's last few days
    const prevMonth = new Date(currentYear, currentMonth, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const today = new Date();
    const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();
    
    // Add previous month's trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayElement = createDayElement(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = createDayElement(day, 'current-month');
        
        // Mark today
        if (isCurrentMonth && day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        // Mark selected date
        if (selectedCalendarDate && 
            selectedCalendarDate.getDate() === day &&
            selectedCalendarDate.getMonth() === currentMonth &&
            selectedCalendarDate.getFullYear() === currentYear) {
            dayElement.classList.add('selected');
        }
        
        calendarDays.appendChild(dayElement);
    }
    
    // Add next month's leading days
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createDayElement(day, 'other-month');
        calendarDays.appendChild(dayElement);
    }
}

function createDayElement(day, monthType) {
    const dayElement = document.createElement('div');
    dayElement.className = `calendar-day ${monthType}`;
    dayElement.textContent = day;
    
    if (monthType === 'current-month') {
        dayElement.onclick = () => selectDate(day);
    }
    
    return dayElement;
}

function selectDate(day) {
    const currentMonth = currentCalendarDate.getMonth();
    const currentYear = currentCalendarDate.getFullYear();
    
    selectedCalendarDate = new Date(currentYear, currentMonth, day);
    
    // Update the target input
    if (targetInputId) {
        const dayFormatted = day.toString().padStart(2, '0');
        const monthFormatted = (currentMonth + 1).toString().padStart(2, '0');
        const dateString = `${dayFormatted}/${monthFormatted}/${currentYear}`;
        
        document.getElementById(targetInputId).value = dateString;
        
        // Also update hidden input for form submission
        const hiddenInput = document.getElementById(targetInputId + 'Hidden');
        if (hiddenInput) {
            hiddenInput.value = selectedCalendarDate.toISOString().split('T')[0];
        }
    }
    
    closeCalendar();
}

function selectCurrentDate() {
    const today = new Date();
    currentCalendarDate = new Date(today);
    selectDate(today.getDate());
}

// Placeholder functions for date filtering (to be implemented)
function filterByDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    console.log('Filter by date range:', startDate, 'to', endDate);
    // TODO: Implement actual filtering logic
}

function clearDateFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('startDateHidden').value = '';
    document.getElementById('endDateHidden').value = '';
    console.log('Date filter cleared');
    // TODO: Implement actual clear logic
}

function setQuickFilter(period) {
    const today = new Date();
    let startDate = new Date();
    
    switch(period) {
        case 'today':
            startDate = new Date();
            break;
        case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            break;
    }
    
    // Update hidden inputs
    document.getElementById('startDateHidden').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDateHidden').value = today.toISOString().split('T')[0];
    
    // Update text inputs
    updateDateInput('startDate', startDate.toISOString().split('T')[0]);
    updateDateInput('endDate', today.toISOString().split('T')[0]);
    
    console.log('Quick filter set:', period);
    // TODO: Implement actual filtering logic
}

// ===============================
// Auto Generate Jackpot Messages
// ===============================

// Predefined messages from frontend script.js
const predefinedJackpotMessages = [
    "Aaj 9:30PM se 10:00PM tak Dragon Tiger mein bonus rate double hoga!",
    "System prediction: Next 30 minutes mein BNG Slot jackpot hit hone wala hai!",
    "Alert! Fishing Games mein agle 30 min lucky streak chalega!",
    "Mega prediction: Crazy Time bonus wheel aaj lucky hai!",
    "Lucky prediction: PG Slots mein agle 30 min mega wins aa rahe hain!",
    "Special alert: Jili games mein bonus rounds active hone wale hain!",
    "Hot prediction: Live casino mein multipliers high chal rahe hain!"
];

function autoGenerateMessage() {
    // Pick a random message from the predefined list
    const randomIndex = Math.floor(Math.random() * predefinedJackpotMessages.length);
    const selectedMessage = predefinedJackpotMessages[randomIndex];
    
    // Fill the message textarea
    document.getElementById('jackpotMessage').value = selectedMessage;
}