// Dashboard JavaScript
class MetaAdsDashboard {
    constructor() {
        this.apiBase = '/api';
        this.uploadedFiles = [];
        this.sheetsAdCopy = [];
        this.init();
    }

    init() {
        // Wait for DOM to be fully ready, then initialize
        this.waitForElementsAndInit();
    }

    waitForElementsAndInit(retryCount = 0) {
        const maxRetries = 10;
        const requiredElements = [
            'csv-file-input', 'csv-upload-area', 'load-csv-data', 'download-sample-csv',
            'csv-file-input-duplicate', 'csv-upload-area-duplicate', 'load-csv-data-duplicate', 'download-sample-csv-duplicate',
            'campaign-select', 'campaign-select-duplicate', 'create-ads', 'create-duplicate-adset'
        ];
        
        // Check if all required elements exist
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length === 0) {
            console.log('✅ All CSV elements found, initializing...');
            this.debugElementsExistence();
            this.setupEventListeners();
            this.setupTabNavigation();
            this.loadInitialData();
            this.startDataRefresh();
            // Initialize performance sub-tabs after a short delay
            setTimeout(() => this.initializePerformanceSubTabs(), 500);
        } else if (retryCount < maxRetries) {
            console.log(`⏳ Waiting for elements (${retryCount + 1}/${maxRetries}). Missing:`, missingElements);
            setTimeout(() => this.waitForElementsAndInit(retryCount + 1), 100);
        } else {
            console.error('❌ Failed to find all required elements after', maxRetries, 'attempts. Missing:', missingElements);
            // Initialize anyway to at least get the working parts
            this.debugElementsExistence();
            this.setupEventListeners();
            this.setupTabNavigation();
            this.loadInitialData();
            this.startDataRefresh();
            // Initialize performance sub-tabs after a short delay
            setTimeout(() => this.initializePerformanceSubTabs(), 500);
        }
    }

    debugElementsExistence() {
        const requiredElements = [
            'csv-file-input', 'csv-upload-area', 'load-csv-data', 'download-sample-csv',
            'csv-file-input-duplicate', 'csv-upload-area-duplicate', 'load-csv-data-duplicate', 'download-sample-csv-duplicate',
            'campaign-select', 'campaign-select-duplicate', 'create-ads', 'create-duplicate-adset'
        ];
        
        console.log('🔍 Checking for required CSV elements:');
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            console.log(`  ${id}: ${element ? '✅ Found' : '❌ Missing'}`);
        });
    }

    setupEventListeners() {
        // Tab navigation
        this.setupTabNavigation();
        
        // Performance monitoring
        this.setupPerformanceMonitoring();
        
        // Creative Upload & Ad Creation Tab - Existing AdSet
        document.getElementById('campaign-select').addEventListener('change', (e) => this.loadAdSets(e.target.value));
        document.getElementById('adset-select').addEventListener('change', (e) => this.loadReferenceAds(e.target.value));
        
        // Creative Upload & Ad Creation Tab - Duplicate AdSet  
        document.getElementById('campaign-select-duplicate').addEventListener('change', (e) => this.loadAdSetsDuplicate(e.target.value));
        document.getElementById('adset-select-duplicate').addEventListener('change', (e) => this.loadReferenceAdsDuplicate(e.target.value));
        
        // CSV upload - with better error handling
        const loadCsvBtn = document.getElementById('load-csv-data');
        const downloadCsvBtn = document.getElementById('download-sample-csv');
        const loadCsvBtnDuplicate = document.getElementById('load-csv-data-duplicate');
        const downloadCsvBtnDuplicate = document.getElementById('download-sample-csv-duplicate');
        
        if (loadCsvBtn) {
            loadCsvBtn.addEventListener('click', () => {
                console.log('📄 Upload CSV button clicked');
                this.loadCSVData();
            });
        } else {
            console.error('❌ load-csv-data button not found');
        }
        
        if (downloadCsvBtn) {
            downloadCsvBtn.addEventListener('click', () => this.downloadSampleCSV());
        } else {
            console.error('❌ download-sample-csv button not found');
        }

        // Duplicate tab CSV upload
        if (loadCsvBtnDuplicate) {
            loadCsvBtnDuplicate.addEventListener('click', () => {
                console.log('📄 Upload CSV button clicked (duplicate)');
                this.loadCSVDataDuplicate();
            });
        } else {
            console.error('❌ load-csv-data-duplicate button not found');
        }
        
        if (downloadCsvBtnDuplicate) {
            downloadCsvBtnDuplicate.addEventListener('click', () => this.downloadSampleCSV());
        } else {
            console.error('❌ download-sample-csv-duplicate button not found');
        }
        
        document.getElementById('create-ads').addEventListener('click', () => this.createAdsFromUploads());
        document.getElementById('create-duplicate-adset').addEventListener('click', () => this.createDuplicateAdSet());

        // File upload - existing adset
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        
        // File upload - duplicate adset
        const uploadAreaDuplicate = document.getElementById('upload-area-duplicate');
        const fileInputDuplicate = document.getElementById('file-input-duplicate');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileUpload(e.dataTransfer.files);
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Duplicate file upload area event listeners
        if (uploadAreaDuplicate && fileInputDuplicate) {
            uploadAreaDuplicate.addEventListener('click', () => fileInputDuplicate.click());
            uploadAreaDuplicate.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadAreaDuplicate.classList.add('dragover');
            });
            uploadAreaDuplicate.addEventListener('dragleave', () => {
                uploadAreaDuplicate.classList.remove('dragover');
            });
            uploadAreaDuplicate.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadAreaDuplicate.classList.remove('dragover');
                this.handleFileUpload(e.dataTransfer.files);
            });
            
            fileInputDuplicate.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        // CSV upload
        const csvUploadArea = document.getElementById('csv-upload-area');
        const csvFileInput = document.getElementById('csv-file-input');
        
        if (!csvUploadArea || !csvFileInput) {
            console.error('❌ CSV upload elements not found:', {
                csvUploadArea: !!csvUploadArea,
                csvFileInput: !!csvFileInput
            });
            return;
        }
        
        csvUploadArea.addEventListener('click', () => {
            const currentInput = document.getElementById('csv-file-input');
            if (currentInput) {
                currentInput.click();
            } else {
                console.error('❌ CSV file input not found when clicking upload area');
            }
        });
        csvUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            csvUploadArea.classList.add('dragover');
        });
        csvUploadArea.addEventListener('dragleave', () => {
            csvUploadArea.classList.remove('dragover');
        });
        csvUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            csvUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files[0] && e.dataTransfer.files[0].name.endsWith('.csv')) {
                csvFileInput.files = e.dataTransfer.files;
                this.handleCSVFileSelect(e.dataTransfer.files[0]);
            } else {
                this.showAlert('Please drop a CSV file', 'error');
            }
        });
        
        csvFileInput.addEventListener('change', (e) => {
            console.log('📄 CSV file input changed, files:', e.target.files.length);
            if (e.target.files[0]) {
                console.log('📄 File selected:', e.target.files[0].name);
                this.handleCSVFileSelect(e.target.files[0]);
            } else {
                console.log('📄 No file selected');
            }
        });

        // CSV upload for duplicate tab
        const csvUploadAreaDuplicate = document.getElementById('csv-upload-area-duplicate');
        const csvFileInputDuplicate = document.getElementById('csv-file-input-duplicate');
        
        if (csvUploadAreaDuplicate && csvFileInputDuplicate) {
            csvUploadAreaDuplicate.addEventListener('click', () => {
                const currentInput = document.getElementById('csv-file-input-duplicate');
                if (currentInput) {
                    currentInput.click();
                } else {
                    console.error('❌ CSV file input duplicate not found when clicking upload area');
                }
            });
            csvUploadAreaDuplicate.addEventListener('dragover', (e) => {
                e.preventDefault();
                csvUploadAreaDuplicate.classList.add('dragover');
            });
            csvUploadAreaDuplicate.addEventListener('dragleave', () => {
                csvUploadAreaDuplicate.classList.remove('dragover');
            });
            csvUploadAreaDuplicate.addEventListener('drop', (e) => {
                e.preventDefault();
                csvUploadAreaDuplicate.classList.remove('dragover');
                if (e.dataTransfer.files[0] && e.dataTransfer.files[0].name.endsWith('.csv')) {
                    csvFileInputDuplicate.files = e.dataTransfer.files;
                    this.handleCSVFileSelectDuplicate(e.dataTransfer.files[0]);
                } else {
                    this.showAlert('Please drop a CSV file', 'error');
                }
            });
            
            csvFileInputDuplicate.addEventListener('change', (e) => {
                console.log('📄 CSV file input duplicate changed, files:', e.target.files.length);
                if (e.target.files[0]) {
                    console.log('📄 File selected (duplicate):', e.target.files[0].name);
                    this.handleCSVFileSelectDuplicate(e.target.files[0]);
                } else {
                    console.log('❌ No file selected (duplicate)');
                }
            });
        }

        // Performance Monitoring Tab (with null checks)
        const startMonitoring = document.getElementById('start-monitoring');
        if (startMonitoring) startMonitoring.addEventListener('click', () => this.startMonitoring());

        const stopMonitoring = document.getElementById('stop-monitoring');
        if (stopMonitoring) stopMonitoring.addEventListener('click', () => this.stopMonitoring());

        const triggerCheck = document.getElementById('trigger-check');
        if (triggerCheck) triggerCheck.addEventListener('click', () => this.triggerCheck());

        const kpiForm = document.getElementById('kpi-thresholds-form');
        if (kpiForm) kpiForm.addEventListener('submit', (e) => this.updateKPIThresholds(e));

        const dryRunPause = document.getElementById('dry-run-pause');
        if (dryRunPause) dryRunPause.addEventListener('click', () => this.dryRunPause());

        const pauseUnderperforming = document.getElementById('pause-underperforming');
        if (pauseUnderperforming) pauseUnderperforming.addEventListener('click', () => this.pauseUnderperforming());

        const refreshPerformance = document.getElementById('refresh-performance');
        if (refreshPerformance) refreshPerformance.addEventListener('click', () => this.refreshPerformanceData());

        const clearLog = document.getElementById('clear-log');
        if (clearLog) clearLog.addEventListener('click', () => this.clearPauseLog());
    }

    setupTabNavigation() {
        console.log('🚀 Setting up tab navigation...');
        
        // Main tabs - find tabs that are direct children of .card > .tabs
        const mainTabsContainer = document.querySelector('.container > .card > .tabs');
        const mainTabs = mainTabsContainer ? mainTabsContainer.querySelectorAll('.tab[data-tab]') : [];
        console.log('📑 Found main tabs:', mainTabs.length);
        
        if (mainTabs.length === 0) {
            console.error('❌ No main tabs found! Check HTML structure.');
        }
        
        mainTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from all main tabs and contents
                mainTabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.container > .card > .tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Load tab-specific data
                this.loadTabData(targetTab);
            });
        });

        // Sub-tabs for Creative Upload & Ad Creation
        const creativeSubTabs = document.querySelectorAll('#creative-ads-tab .tabs .tab');
        creativeSubTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from sub-tabs and contents
                creativeSubTabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#creative-ads-tab .tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Add active class
                tab.classList.add('active');
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });

        // Performance monitoring sub-tabs will be initialized separately
        console.log('✅ Tab navigation setup complete');
    }

    async loadInitialData() {
        await Promise.all([
            this.loadCampaigns()
            // Disabled monitoring status to prevent errors
            // this.loadMonitoringStatus()
        ]);
    }

    startDataRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            // Disabled monitoring status to prevent errors
            // this.loadMonitoringStatus();
            if (document.getElementById('performance-monitoring-tab').classList.contains('active')) {
                // this.loadUnderperformingAds();
            }
        }, 30000);
    }

    async loadMonitoringStatus() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/status`);
            const data = await response.json();
            
            const statusElement = document.getElementById('monitoring-status');
            statusElement.textContent = data.isRunning ? 'Running' : 'Stopped';
            statusElement.className = `status-badge ${data.isRunning ? 'status-running' : 'status-stopped'}`;
            
            document.getElementById('check-interval').textContent = `${data.checkInterval} hours`;
            document.getElementById('last-check').textContent = this.formatTime(new Date());
            
        } catch (error) {
            console.error('Error loading monitoring status:', error);
        }
    }

    async loadReferenceAds(adsetId) {
        console.log('📋 Loading reference ads for adset:', adsetId);
        const referenceAdSelect = document.getElementById('reference-ad-select');
        
        if (!adsetId) {
            referenceAdSelect.innerHTML = '<option value="">Select an adset first</option>';
            referenceAdSelect.disabled = true;
            return;
        }
        
        try {
            referenceAdSelect.innerHTML = '<option value="">Loading ads...</option>';
            referenceAdSelect.disabled = false;
            
            const response = await fetch(`${this.apiBase}/campaigns/adset/${adsetId}/ads`);
            console.log('📊 Reference ads API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Reference ads API Response data:', data);
            
            referenceAdSelect.innerHTML = '<option value="">Select a reference ad...</option>';
            
            if (data.ads && data.ads.length > 0) {
                data.ads.forEach((ad, index) => {
                    const option = document.createElement('option');
                    option.value = ad.id;
                    const status = ad.effective_status || ad.status || 'UNKNOWN';
                    option.textContent = `${ad.name} (${status})`;
                    referenceAdSelect.appendChild(option);
                    console.log(`➕ Added reference ad ${index + 1}: ${ad.name}`);
                });
                console.log(`✅ Successfully loaded ${data.ads.length} reference ads`);
            } else {
                referenceAdSelect.innerHTML += '<option value="" disabled>No ads found</option>';
                console.warn('⚠️ No ads found for adset');
            }
            
            this.validateCreateAdsButton();
            
        } catch (error) {
            console.error('❌ Error loading reference ads:', error);
            referenceAdSelect.innerHTML = '<option value="" disabled>Error loading ads</option>';
            referenceAdSelect.disabled = true;
            this.showAlert('Error loading reference ads: ' + error.message, 'error');
        }
    }

    async loadAdSets(campaignId) {
        console.log('📋 Loading adsets for campaign:', campaignId);
        const adsetSelect = document.getElementById('adset-select');
        const referenceAdSelect = document.getElementById('reference-ad-select');
        
        if (!campaignId) {
            adsetSelect.innerHTML = '<option value="">Select a campaign first</option>';
            adsetSelect.disabled = true;
            referenceAdSelect.innerHTML = '<option value="">Select an adset first</option>';
            referenceAdSelect.disabled = true;
            return;
        }
        
        try {
            adsetSelect.innerHTML = '<option value="">Loading adsets...</option>';
            adsetSelect.disabled = false;
            
            const response = await fetch(`${this.apiBase}/campaigns/${campaignId}`);
            console.log('📊 Adsets API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Adsets API Response data:', data);
            
            adsetSelect.innerHTML = '<option value="">Select an adset...</option>';
            
            if (data.adsets && data.adsets.length > 0) {
                data.adsets.forEach((adset, index) => {
                    const option = document.createElement('option');
                    option.value = adset.id;
                    const budget = adset.daily_budget ? `$${(adset.daily_budget / 100).toFixed(2)}/day` : 'No budget';
                    option.textContent = `${adset.name} (${budget})`;
                    adsetSelect.appendChild(option);
                    console.log(`➕ Added adset ${index + 1}: ${adset.name}`);
                });
                console.log(`✅ Successfully loaded ${data.adsets.length} adsets`);
            } else {
                adsetSelect.innerHTML += '<option value="" disabled>No adsets found</option>';
                console.warn('⚠️ No adsets found for campaign');
            }
            
        } catch (error) {
            console.error('❌ Error loading adsets:', error);
            adsetSelect.innerHTML = '<option value="" disabled>Error loading adsets</option>';
            adsetSelect.disabled = true;
            this.showAlert('Error loading adsets: ' + error.message, 'error');
        }
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'creative-ads':
                await this.loadCampaigns();
                break;
            case 'performance-monitoring':
                await this.loadUnderperformingAds();
                await this.loadPauseLog();
                // Re-initialize performance sub-tabs when switching to this tab
                this.initializePerformanceSubTabs();
                break;
        }
    }
    
    // Separate method to initialize performance sub-tabs - BULLETPROOF VERSION
    initializePerformanceSubTabs() {
        console.log('🔧 Initializing performance sub-tabs (BULLETPROOF)...');
        
        // Method 1: Direct ID targeting
        const ctrTabById = document.querySelector('#performance-monitoring-tab [data-tab="ctr-monitoring"]');
        const multiTabById = document.querySelector('#performance-monitoring-tab [data-tab="multi-kpi-monitoring"]');
        
        const ctrContent = document.getElementById('ctr-monitoring-tab');
        const multiContent = document.getElementById('multi-kpi-monitoring-tab');
        
        console.log('Found tabs:', {ctrTab: !!ctrTabById, multiTab: !!multiTabById, ctrContent: !!ctrContent, multiContent: !!multiContent});
        
        // Remove ALL existing event listeners by cloning
        if (ctrTabById) {
            const newCtrTab = ctrTabById.cloneNode(true);
            ctrTabById.parentNode.replaceChild(newCtrTab, ctrTabById);
            
            // Add multiple types of event listeners
            newCtrTab.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📊 CTR tab clicked!');
                this.switchToPerformanceTab('ctr');
            };
            
            newCtrTab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📊 CTR tab clicked via addEventListener!');
                this.switchToPerformanceTab('ctr');
            }, true);
            
            // Make it obviously clickable
            newCtrTab.style.cursor = 'pointer';
            newCtrTab.title = 'Click to view CTR Monitoring';
        }
        
        if (multiTabById) {
            const newMultiTab = multiTabById.cloneNode(true);
            multiTabById.parentNode.replaceChild(newMultiTab, multiTabById);
            
            // Add multiple types of event listeners
            newMultiTab.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Multi-KPI tab clicked!');
                this.switchToPerformanceTab('multi');
            };
            
            newMultiTab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Multi-KPI tab clicked via addEventListener!');
                this.switchToPerformanceTab('multi');
            }, true);
            
            // Make it obviously clickable
            newMultiTab.style.cursor = 'pointer';
            newMultiTab.title = 'Click to view Multi-KPI Monitoring';
        }
    }
    
    // Simple switch function that WILL work
    switchToPerformanceTab(tabType) {
        console.log(`🔄 Switching to ${tabType} monitoring...`);
        
        // Get all elements
        const ctrTab = document.querySelector('#performance-monitoring-tab [data-tab="ctr-monitoring"]');
        const multiTab = document.querySelector('#performance-monitoring-tab [data-tab="multi-kpi-monitoring"]');
        const ctrContent = document.getElementById('ctr-monitoring-tab');
        const multiContent = document.getElementById('multi-kpi-monitoring-tab');
        
        if (tabType === 'ctr') {
            // Show CTR, hide Multi
            if (ctrTab) ctrTab.classList.add('active');
            if (multiTab) multiTab.classList.remove('active');
            if (ctrContent) {
                ctrContent.classList.add('active');
                ctrContent.style.display = 'block';
            }
            if (multiContent) {
                multiContent.classList.remove('active');
                multiContent.style.display = 'none';
            }
            console.log('✅ Switched to CTR monitoring');
        } else {
            // Show Multi, hide CTR
            if (multiTab) multiTab.classList.add('active');
            if (ctrTab) ctrTab.classList.remove('active');
            if (multiContent) {
                multiContent.classList.add('active');
                multiContent.style.display = 'block';
            }
            if (ctrContent) {
                ctrContent.classList.remove('active');
                ctrContent.style.display = 'none';
            }
            console.log('✅ Switched to Multi-KPI monitoring');
        }
    }

    async loadCampaigns() {
        console.log('📋 Loading campaigns...');
        try {
            const campaignSelect = document.getElementById('campaign-select');
            if (!campaignSelect) {
                throw new Error('Campaign select element not found');
            }
            
            campaignSelect.innerHTML = '<option value="">Loading campaigns...</option>';
            
            const response = await fetch(`${this.apiBase}/campaigns`);
            console.log('📊 API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 API Response data:', data);
            
            campaignSelect.innerHTML = '<option value="">Select a campaign...</option>';
            
            if (!data.campaigns || data.campaigns.length === 0) {
                campaignSelect.innerHTML += '<option value="" disabled>No campaigns found</option>';
                console.warn('⚠️ No campaigns found in API response');
                return;
            }
            
            data.campaigns.forEach((campaign, index) => {
                const option = document.createElement('option');
                option.value = campaign.id;
                const status = campaign.effective_status || campaign.status || 'UNKNOWN';
                option.textContent = `${campaign.name} (${status})`;
                campaignSelect.appendChild(option);
                console.log(`➕ Added campaign ${index + 1}: ${campaign.name}`);
            });
            
            console.log(`✅ Successfully loaded ${data.campaigns.length} campaigns`);
            
        } catch (error) {
            console.error('❌ Error loading campaigns:', error);
            const campaignSelect = document.getElementById('campaign-select');
            if (campaignSelect) {
                campaignSelect.innerHTML = '<option value="" disabled>Error loading campaigns</option>';
            }
            this.showAlert('Error loading campaigns: ' + error.message, 'error');
        }
    }

    async loadUnderperformingAds() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/underperforming`);
            const data = await response.json();
            
            const underperformingElement = document.getElementById('underperforming-list');
            if (data.underperformingAds.length === 0) {
                underperformingElement.innerHTML = '<p class="alert alert-success">✅ All ads are performing well!</p>';
                return;
            }
            
            const adsHtml = data.underperformingAds.map(ad => `
                <div class="card" style="margin-bottom: 1rem;">
                    <div class="card-header">
                        <div class="card-title">Ad ${ad.adId}</div>
                        <span class="status-badge status-stopped">Underperforming</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">D1 Retention</span>
                        <span class="metric-value ${ad.day1Retention < 0.3 ? 'danger' : 'good'}">${(ad.day1Retention * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Installs</span>
                        <span class="metric-value">${ad.totalInstalls}</span>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-danger" onclick="dashboard.pauseAd('${ad.adId}')">Pause Ad</button>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #718096;">
                        Issues: ${ad.reasonsForPause.join(', ')}
                    </div>
                </div>
            `).join('');
            
            underperformingElement.innerHTML = adsHtml;
            
        } catch (error) {
            console.error('Error loading underperforming ads:', error);
            document.getElementById('underperforming-list').innerHTML = '<p class="alert alert-error">Error loading underperforming ads</p>';
        }
    }


    async startMonitoring() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/start`, { method: 'POST' });
            const data = await response.json();
            
            this.showAlert(data.message, 'success');
            await this.loadMonitoringStatus();
        } catch (error) {
            this.showAlert('Error starting monitoring: ' + error.message, 'error');
        }
    }

    async stopMonitoring() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/stop`, { method: 'POST' });
            const data = await response.json();
            
            this.showAlert(data.message, 'success');
            await this.loadMonitoringStatus();
        } catch (error) {
            this.showAlert('Error stopping monitoring: ' + error.message, 'error');
        }
    }

    async triggerCheck() {
        try {
            const button = document.getElementById('trigger-check');
            const originalText = button.textContent;
            button.innerHTML = '<span class="loading"></span> Checking...';
            button.disabled = true;
            
            const response = await fetch(`${this.apiBase}/monitoring/check`, { method: 'POST' });
            const data = await response.json();
            
            this.showAlert(data.message, 'success');
            await this.loadDashboardSummary();
            
            button.textContent = originalText;
            button.disabled = false;
        } catch (error) {
            this.showAlert('Error triggering check: ' + error.message, 'error');
            
            const button = document.getElementById('trigger-check');
            button.textContent = 'Check Now';
            button.disabled = false;
        }
    }

    async handleFileUpload(files) {
        this.uploadedFiles = Array.from(files);
        
        const filesListElement = document.getElementById('files-list');
        const uploadedFilesDiv = document.getElementById('uploaded-files');
        
        if (files.length === 0) {
            uploadedFilesDiv.classList.add('hidden');
            return;
        }
        
        uploadedFilesDiv.classList.remove('hidden');
        
        const filesHtml = Array.from(files).map(file => `
            <div style="padding: 0.5rem; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin: 0.25rem 0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.875rem;">${file.name}</span>
                <span style="font-size: 0.75rem; color: #718096;">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        `).join('');
        
        filesListElement.innerHTML = filesHtml;
        
        this.validateCreateAdsButton();
        
        this.showAlert(`${files.length} files ready for upload`, 'success');
    }

    async handleCSVFileSelect(file) {
        console.log('📄 handleCSVFileSelect called with file:', file.name, file.size);
        const csvUploadArea = document.getElementById('csv-upload-area');
        if (!csvUploadArea) {
            console.error('❌ CSV upload area element not found');
            return;
        }
        
        // Find and preserve the file input element
        const fileInput = csvUploadArea.querySelector('#csv-file-input');
        
        // Update only the visible content, keep the file input
        const paragraphs = csvUploadArea.querySelectorAll('p');
        paragraphs.forEach(p => p.remove());
        
        // Add new content
        const fileName = document.createElement('p');
        fileName.textContent = `📄 ${file.name}`;
        
        const fileSize = document.createElement('p');
        fileSize.style.fontSize = '0.875rem';
        fileSize.style.color = '#718096';
        fileSize.style.marginTop = '0.5rem';
        fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB - Ready to upload`;
        
        // Insert new content before the file input
        if (fileInput) {
            csvUploadArea.insertBefore(fileName, fileInput);
            csvUploadArea.insertBefore(fileSize, fileInput);
        } else {
            csvUploadArea.appendChild(fileName);
            csvUploadArea.appendChild(fileSize);
        }
        
        console.log('📄 Updated CSV upload area display, preserved file input');
    }

    async loadCSVData() {
        const csvFileInput = document.getElementById('csv-file-input');
        
        if (!csvFileInput) {
            this.showAlert('Please select a CSV file first', 'error');
            return;
        }
        
        if (!csvFileInput.files[0]) {
            this.showAlert('Please select a CSV file first', 'error');
            return;
        }
        
        try {
            const button = document.getElementById('load-csv-data');
            button.innerHTML = '<span class="loading"></span> Processing...';
            button.disabled = true;
            
            const formData = new FormData();
            formData.append('csvFile', csvFileInput.files[0]);
            
            const response = await fetch(`${this.apiBase}/csv/upload-ad-copy`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success && data.adCopy && data.adCopy.length > 0) {
                this.sheetsAdCopy = data.adCopy;
                
                const previewHtml = data.adCopy.slice(0, 3).map((copy, index) => `
                    <div style="margin: 0.5rem 0; padding: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 4px;">
                        <div style="font-weight: 500; font-size: 0.875rem;">Row ${index + 1}: ${copy.bookId} - ${copy.variation}</div>
                        <div style="font-size: 0.8rem; color: #4a5568;">Primary: ${copy.primaryText || 'N/A'}</div>
                        <div style="font-size: 0.8rem; color: #4a5568;">Headline: ${copy.headline || 'N/A'}</div>
                        <div style="font-size: 0.8rem; color: #4a5568;">Description: ${copy.description || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: #718096;">Landing: ${copy.landingPageUrl || 'N/A'}</div>
                    </div>
                `).join('');
                
                const moreText = data.adCopy.length > 3 ? `<div style="font-size: 0.8rem; font-style: italic; margin-top: 0.5rem;">...and ${data.adCopy.length - 3} more rows</div>` : '';
                
                document.getElementById('csv-data-preview').innerHTML = previewHtml + moreText;
                document.getElementById('csv-preview').classList.remove('hidden');
                
                this.showAlert(data.message || `Loaded ${data.adCopy.length} ad copy variations`, 'success');
            } else {
                throw new Error(data.error || 'No ad copy data found in CSV');
            }
            
            button.textContent = 'Upload CSV';
            button.disabled = false;
            
            this.validateCreateAdsButton();
            
        } catch (error) {
            console.error('Error loading CSV data:', error);
            this.showAlert('Error processing CSV file: ' + error.message, 'error');
            
            const button = document.getElementById('load-csv-data');
            button.textContent = 'Upload CSV';
            button.disabled = false;
        }
    }

    async downloadSampleCSV() {
        try {
            const response = await fetch(`${this.apiBase}/csv/sample-format`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ad-copy-sample.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showAlert('Sample CSV downloaded', 'success');
        } catch (error) {
            console.error('Error downloading sample CSV:', error);
            this.showAlert('Error downloading sample CSV: ' + error.message, 'error');
        }
    }

    validateCreateAdsButton() {
        const createButton = document.getElementById('create-ads');
        const hasFiles = this.uploadedFiles && this.uploadedFiles.length > 0;
        const hasAdCopy = this.sheetsAdCopy && this.sheetsAdCopy.length > 0;
        const hasAdSet = document.getElementById('adset-select').value;
        const hasReferenceAd = document.getElementById('reference-ad-select').value;
        
        if (hasFiles && hasAdCopy && hasAdSet && hasReferenceAd) {
            createButton.disabled = false;
            createButton.textContent = `Create ${this.uploadedFiles.length * this.sheetsAdCopy.length} Ad Combinations`;
        } else {
            createButton.disabled = true;
            createButton.textContent = 'Create All Ad Combinations';
        }
    }

    async createAdsFromUploads() {
        console.log('🚀 createAdsFromUploads() called');
        
        const adsetId = document.getElementById('adset-select').value;
        const referenceAdId = document.getElementById('reference-ad-select').value;
        
        console.log('📋 Current state:', {
            uploadedFiles: this.uploadedFiles?.length || 0,
            csvAdCopy: this.sheetsAdCopy?.length || 0,
            adsetId,
            referenceAdId
        });
        
        if (!this.uploadedFiles || this.uploadedFiles.length === 0) {
            console.error('❌ No uploaded files');
            this.showAlert('Please upload creative files first', 'error');
            return;
        }
        
        if (!this.sheetsAdCopy || this.sheetsAdCopy.length === 0) {
            console.error('❌ No CSV ad copy data');
            this.showAlert('Please upload CSV ad copy data first', 'error');
            return;
        }
        
        if (!adsetId || !referenceAdId) {
            console.error('❌ Missing adset or reference ad selection:', { adsetId, referenceAdId });
            this.showAlert('Please select campaign, adset, and reference ad', 'error');
            return;
        }
        
        console.log('✅ All validation passed, proceeding with ad creation');
        
        try {
            const button = document.getElementById('create-ads');
            const originalText = button.textContent;
            button.innerHTML = '<span class="loading"></span> Creating Ads...';
            button.disabled = true;
            
            // First upload the creative files
            console.log('📤 Uploading creative files to server...');
            const formData = new FormData();
            for (let file of this.uploadedFiles) {
                formData.append('creatives', file);
                console.log(`  - Adding file: ${file.name} (${file.size} bytes)`);
            }
            formData.append('adsetId', adsetId);
            
            console.log(`📡 Calling: ${this.apiBase}/creatives/upload-for-adset`);
            const uploadResponse = await fetch(`${this.apiBase}/creatives/upload-for-adset`, {
                method: 'POST',
                body: formData
            });
            
            console.log('📊 Upload response status:', uploadResponse.status);
            const uploadData = await uploadResponse.json();
            console.log('📊 Upload response data:', uploadData);
            
            if (!uploadData.success) {
                throw new Error('Failed to upload creative files');
            }

            // Create filename mapping: creativeId -> originalName
            const creativeFilenames = {};
            if (uploadData.files) {
                uploadData.files.forEach(file => {
                    const creativeId = file.metaHash || file.metaVideoId;
                    if (creativeId && file.originalName) {
                        creativeFilenames[creativeId] = file.originalName;
                    }
                });
            }
            console.log('📁 Creative filename mapping:', creativeFilenames);

            // Then create ads with the uploaded creatives and ad copy
            console.log('🎯 Creating ads with uploaded creatives and CSV ad copy...');
            console.log('📋 Payload for ad creation:', {
                adsetId,
                referenceAdId,
                creativeIds: uploadData.creativeIds,
                adCopyVariations: this.sheetsAdCopy,
                creativeFilenames
            });

            console.log(`📡 Calling: ${this.apiBase}/campaigns/create-ads-batch`);
            const createResponse = await fetch(`${this.apiBase}/campaigns/create-ads-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adsetId,
                    referenceAdId,
                    creativeIds: uploadData.creativeIds,
                    adCopyVariations: this.sheetsAdCopy,
                    creativeFilenames
                })
            });
            
            console.log('📊 Create ads response status:', createResponse.status);
            const createData = await createResponse.json();
            console.log('📊 Create ads response data:', createData);
            
            this.showAlert(
                `Campaign creation completed: ${createData.successful} ads created, ${createData.failed} failed`,
                createData.failed > 0 ? 'warning' : 'success'
            );
            
            // Reset form
            this.uploadedFiles = [];
            this.sheetsAdCopy = [];
            document.getElementById('uploaded-files').classList.add('hidden');
            document.getElementById('csv-preview').classList.add('hidden');
            document.getElementById('file-input').value = '';
            document.getElementById('csv-file-input').value = '';
            
            // Reset CSV upload area
            const csvUploadArea = document.getElementById('csv-upload-area');
            csvUploadArea.innerHTML = `
                <p>📄 Drop CSV file here or click to select</p>
                <p style="font-size: 0.875rem; color: #718096; margin-top: 0.5rem;">
                    Format: BookID, Variation, PrimaryText, Headline, Description
                </p>
            `;
            
            button.textContent = originalText;
            button.disabled = true;
            
        } catch (error) {
            console.error('Error creating ads:', error);
            this.showAlert('Error creating ads: ' + error.message, 'error');
            
            const button = document.getElementById('create-ads');
            button.textContent = 'Create All Ad Combinations';
            button.disabled = false;
        }
    }

    async refreshPerformanceData() {
        try {
            const button = document.getElementById('refresh-performance');
            const originalText = button.textContent;
            button.innerHTML = '<span class="loading"></span> Refreshing...';
            button.disabled = true;
            
            await Promise.all([
                this.loadUnderperformingAds(),
                this.loadPauseLog(),
                this.loadMonitoringStatus()
            ]);
            
            button.textContent = originalText;
            button.disabled = false;
            
            this.showAlert('Performance data refreshed', 'success');
            
        } catch (error) {
            console.error('Error refreshing performance data:', error);
            this.showAlert('Error refreshing performance data: ' + error.message, 'error');
            
            const button = document.getElementById('refresh-performance');
            button.textContent = 'Refresh Data';
            button.disabled = false;
        }
    }

    async loadPauseLog() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/pause-log?limit=20`);
            const data = await response.json();
            
            const logElement = document.getElementById('pause-log');
            
            if (!data.logs || data.logs.length === 0) {
                logElement.innerHTML = '<p>No pause actions recorded</p>';
                return;
            }
            
            const logsHtml = data.logs.map(log => `
                <div style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span style="font-weight: 500;">${log.adName || log.adId}</span>
                        <span style="color: #718096; font-size: 0.75rem;">${this.formatTime(new Date(log.pauseDate))}</span>
                    </div>
                    <div style="color: #e53e3e; font-size: 0.75rem;">${log.pauseReason}</div>
                    ${log.metricsAtPause ? `
                        <div style="color: #718096; font-size: 0.75rem; margin-top: 0.25rem;">
                            CPA: $${log.metricsAtPause.cpa || 0} | ROAS: ${log.metricsAtPause.roas || 0}x
                        </div>
                    ` : ''}
                </div>
            `).join('');
            
            logElement.innerHTML = logsHtml;
            
        } catch (error) {
            console.error('Error loading pause log:', error);
            document.getElementById('pause-log').innerHTML = '<p class="alert alert-error">Error loading pause log</p>';
        }
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        const container = document.querySelector('.container');
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    async clearPauseLog() {
        if (!confirm('Are you sure you want to clear the pause log?')) return;
        
        try {
            const response = await fetch(`${this.apiBase}/monitoring/clear-pause-log`, {
                method: 'POST'
            });
            
            const data = await response.json();
            this.showAlert('Pause log cleared', 'success');
            await this.loadPauseLog();
            
        } catch (error) {
            this.showAlert('Error clearing pause log: ' + error.message, 'error');
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }


    // KPI Monitoring Methods
    async updateKPIThresholds(e) {
        e.preventDefault();
        
        const thresholds = {
            maxCostPerStreakActivation: parseFloat(document.getElementById('max-cost-streak').value),
            maxCostPerPurchase: parseFloat(document.getElementById('max-cost-purchase').value),
            minROAS: parseFloat(document.getElementById('min-roas').value),
            minInstallsForAnalysis: parseInt(document.getElementById('min-installs').value)
        };
        
        try {
            const response = await fetch(`${this.apiBase}/kpi/thresholds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(thresholds)
            });
            
            const data = await response.json();
            this.showAlert(`KPI thresholds updated successfully`, 'success');
            
            // Refresh KPI data to show impact
            await this.refreshKPIData();
            
        } catch (error) {
            this.showAlert('Error updating KPI thresholds: ' + error.message, 'error');
        }
    }


    async loadUnderperformingAds() {
        try {
            const response = await fetch(`${this.apiBase}/kpi/underperforming`);
            const data = await response.json();
            
            const underperformingElement = document.getElementById('underperforming-ads-list');
            const badgeElement = document.getElementById('underperforming-badge');
            
            if (data.underperformingAds.length === 0) {
                underperformingElement.innerHTML = '<p class="alert alert-success">✅ No underperforming ads found!</p>';
                badgeElement.textContent = '0 ads';
                badgeElement.className = 'status-badge status-running';
                return;
            }
            
            badgeElement.textContent = `${data.underperformingAds.length} ads`;
            badgeElement.className = 'status-badge status-stopped';
            
            const adsHtml = data.underperformingAds.map(ad => `
                <div class="card" style="margin-bottom: 1rem; border-left: 4px solid #e53e3e;">
                    <div class="card-header">
                        <div class="card-title" style="font-size: 0.9rem;">${ad.adName}</div>
                        <span class="status-badge status-stopped">Score: ${ad.performanceScore || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cost/Streak Activation</span>
                        <span class="metric-value ${ad.costPerStreakActivation > 10 ? 'danger' : 'warning'}">$${ad.costPerStreakActivation.toFixed(2)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cost/Purchase</span>
                        <span class="metric-value ${ad.costPerPurchase > 25 ? 'danger' : 'warning'}">$${ad.costPerPurchase.toFixed(2)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">ROAS</span>
                        <span class="metric-value ${ad.roas < 1.5 ? 'danger' : 'good'}">${ad.roas.toFixed(2)}x</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Campaign</span>
                        <span class="metric-value">${ad.campaignName}</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #e53e3e;">
                        <strong>Issues:</strong> ${ad.pauseReasons.join('; ')}
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-danger" style="font-size: 0.8rem; padding: 0.5rem 1rem;" 
                                onclick="dashboard.pauseSpecificAd('${ad.adId}', '${ad.adName}')">Pause Ad</button>
                    </div>
                </div>
            `).join('');
            
            underperformingElement.innerHTML = adsHtml;
            
        } catch (error) {
            console.error('Error loading underperforming ads:', error);
            document.getElementById('underperforming-ads-list').innerHTML = '<p class="alert alert-error">Error loading underperforming ads</p>';
        }
    }


    async dryRunPause() {
        try {
            const button = document.getElementById('dry-run-pause');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading"></span> Analyzing...';
            button.disabled = true;

            const response = await fetch(`${this.apiBase}/kpi/pause-underperforming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: true })
            });
            
            const data = await response.json();
            
            const resultsElement = document.getElementById('quick-action-results');
            
            if (data.wouldPause === 0) {
                resultsElement.innerHTML = `
                    <div class="alert alert-success" style="margin-top: 1rem;">
                        ✅ No ads would be paused - all performing within thresholds!
                    </div>
                `;
            } else {
                const adsPreview = data.ads.slice(0, 3).map(ad => 
                    `<div style="font-size: 0.8rem; margin: 0.25rem 0;">• ${ad.adId}: ${ad.reasons.join(', ')}</div>`
                ).join('');
                
                const moreText = data.ads.length > 3 ? `<div style="font-size: 0.8rem; margin: 0.25rem 0; font-style: italic;">...and ${data.ads.length - 3} more</div>` : '';
                
                resultsElement.innerHTML = `
                    <div class="alert" style="background: #fed7aa; color: #9a3412; border: 1px solid #f6ad55; margin-top: 1rem;">
                        <strong>⚠️ Preview: ${data.wouldPause} ads would be paused</strong>
                        ${adsPreview}
                        ${moreText}
                    </div>
                `;
            }
            
            button.innerHTML = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('Error in dry run pause:', error);
            this.showAlert('Error previewing pause actions: ' + error.message, 'error');
            
            const button = document.getElementById('dry-run-pause');
            button.innerHTML = '🔍 Preview Pause Actions';
            button.disabled = false;
        }
    }

    async pauseUnderperforming() {
        if (!confirm('Are you sure you want to pause ALL underperforming ads? This action cannot be undone.')) {
            return;
        }
        
        try {
            const button = document.getElementById('pause-underperforming');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="loading"></span> Pausing...';
            button.disabled = true;

            const response = await fetch(`${this.apiBase}/kpi/pause-underperforming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: false })
            });
            
            const data = await response.json();
            
            this.showAlert(
                `Batch pause completed: ${data.successful} paused, ${data.failed} failed`, 
                data.failed > 0 ? 'warning' : 'success'
            );
            
            // Show detailed results
            const resultsElement = document.getElementById('quick-action-results');
            const successAds = data.results.filter(r => r.status === 'paused');
            const errorAds = data.results.filter(r => r.status === 'error');
            
            let resultsHtml = '';
            
            if (successAds.length > 0) {
                resultsHtml += `
                    <div class="alert alert-success" style="margin-top: 1rem;">
                        <strong>✅ Successfully paused ${successAds.length} ads</strong>
                    </div>
                `;
            }
            
            if (errorAds.length > 0) {
                const errorList = errorAds.slice(0, 3).map(ad => 
                    `<div style="font-size: 0.8rem;">• ${ad.adName}: ${ad.error}</div>`
                ).join('');
                
                resultsHtml += `
                    <div class="alert alert-error" style="margin-top: 1rem;">
                        <strong>❌ Failed to pause ${errorAds.length} ads</strong>
                        ${errorList}
                    </div>
                `;
            }
            
            resultsElement.innerHTML = resultsHtml;
            
            // Refresh the underperforming ads list
            await this.refreshKPIData();
            
            button.innerHTML = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('Error pausing underperforming ads:', error);
            this.showAlert('Error pausing underperforming ads: ' + error.message, 'error');
            
            const button = document.getElementById('pause-underperforming');
            button.innerHTML = '⏸️ Pause All Underperforming';
            button.disabled = false;
        }
    }

    async pauseSpecificAd(adId, adName) {
        if (!confirm(`Are you sure you want to pause "${adName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/kpi/pause-underperforming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    customThresholds: {},
                    adIds: [adId] // Pass specific ad ID to pause only this one
                })
            });
            
            const data = await response.json();
            this.showAlert(`Ad "${adName}" paused successfully`, 'success');
            
            // Refresh the lists
            await this.loadUnderperformingAds();
            await this.refreshKPIData();
            
        } catch (error) {
            this.showAlert('Error pausing ad: ' + error.message, 'error');
        }
    }

    async createAdsFromUploads() {
        console.log('🚀 createAdsFromUploads() called');
        
        try {
            // Get selected values
            const adsetId = document.getElementById('adset-select').value;
            const referenceAdId = document.getElementById('reference-ad-select').value;
            
            if (!adsetId || !referenceAdId) {
                this.showAlert('Please select both an AdSet and Reference Ad', 'error');
                return;
            }
            
            if (this.uploadedFiles.length === 0) {
                this.showAlert('Please upload creative files first', 'error');
                return;
            }
            
            if (this.sheetsAdCopy.length === 0) {
                this.showAlert('Please upload CSV ad copy data first', 'error');
                return;
            }
            
            const button = document.getElementById('create-ads');
            const originalText = button.innerHTML;
            button.innerHTML = '⏳ Creating ads...';
            button.disabled = true;
            
            // Step 1: Upload creative files to server and get Meta hashes
            console.log('📤 Uploading creative files to server...');
            const formData = new FormData();
            this.uploadedFiles.forEach(file => {
                formData.append('creatives', file);
            });
            formData.append('adsetId', adsetId);
            
            const uploadResponse = await fetch(`${this.apiBase}/creatives/upload-for-adset`, {
                method: 'POST',
                body: formData
            });
            
            const uploadResult = await uploadResponse.json();
            
            if (!uploadResult.success || uploadResult.creativeIds.length === 0) {
                throw new Error('Failed to upload creative files: ' + (uploadResult.error || 'No creative IDs returned'));
            }
            
            console.log('✅ Creative files uploaded successfully. Meta hashes:', uploadResult.creativeIds);

            // Create filename mapping: creativeId -> originalName
            const creativeFilenames = {};
            if (uploadResult.files) {
                uploadResult.files.forEach(file => {
                    const creativeId = file.metaHash || file.metaVideoId;
                    if (creativeId && file.originalName) {
                        creativeFilenames[creativeId] = file.originalName;
                    }
                });
            }
            console.log('📁 Creative filename mapping:', creativeFilenames);

            // Step 2: Create ads with uploaded creatives and CSV ad copy
            console.log('🎯 Creating ads with uploaded creatives and CSV ad copy...');
            const createResponse = await fetch(`${this.apiBase}/campaigns/create-ads-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adsetId: adsetId,
                    referenceAdId: referenceAdId,
                    creativeIds: uploadResult.creativeIds, // Meta image hashes
                    adCopyVariations: this.sheetsAdCopy,
                    creativeFilenames
                })
            });
            
            const createResult = await createResponse.json();
            
            if (!createResult.success) {
                throw new Error('Failed to create ads: ' + (createResult.error || 'Unknown error'));
            }
            
            // Success! Show results
            const totalAds = createResult.successful || 0;
            const failedAds = createResult.failed || 0;
            
            let message = `✅ Successfully created ${totalAds} ads`;
            if (failedAds > 0) {
                message += ` (${failedAds} failed)`;
            }
            
            this.showAlert(message, 'success');
            
            console.log('🎉 Ad creation completed:', {
                successful: totalAds,
                failed: failedAds,
                results: createResult.results
            });
            
        } catch (error) {
            console.error('❌ Error creating ads:', error);
            this.showAlert('Error creating ads: ' + error.message, 'error');
        } finally {
            const button = document.getElementById('create-ads');
            button.innerHTML = 'Create All Ad Combinations';
            button.disabled = false;
        }
    }

    // Campaign and adset loading functions
    async loadInitialData() {
        await this.loadCampaigns();
    }

    async loadCampaigns() {
        try {
            const response = await fetch(`${this.apiBase}/campaigns`);
            const data = await response.json();
            
            // Populate both campaign dropdowns
            const campaignSelect = document.getElementById('campaign-select');
            const campaignSelectDuplicate = document.getElementById('campaign-select-duplicate');
            
            if (campaignSelect) {
                campaignSelect.innerHTML = '<option value="">Select a campaign...</option>';
                data.campaigns.forEach(campaign => {
                    const option = document.createElement('option');
                    option.value = campaign.id;
                    option.textContent = `${campaign.name} (${campaign.effective_status})`;
                    campaignSelect.appendChild(option);
                });
            }
            
            if (campaignSelectDuplicate) {
                campaignSelectDuplicate.innerHTML = '<option value="">Select a campaign...</option>';
                data.campaigns.forEach(campaign => {
                    const option = document.createElement('option');
                    option.value = campaign.id;
                    option.textContent = `${campaign.name} (${campaign.effective_status})`;
                    campaignSelectDuplicate.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error('Error loading campaigns:', error);
            this.showAlert('Error loading campaigns: ' + error.message, 'error');
        }
    }

    async loadAdSets(campaignId) {
        if (!campaignId) {
            document.getElementById('adset-select').innerHTML = '<option value="">Select a campaign first</option>';
            document.getElementById('adset-select').disabled = true;
            document.getElementById('reference-ad-select').innerHTML = '<option value="">Select an adset first</option>';
            document.getElementById('reference-ad-select').disabled = true;
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/campaigns/${campaignId}`);
            const data = await response.json();
            
            const adsetSelect = document.getElementById('adset-select');
            adsetSelect.innerHTML = '<option value="">Select an adset...</option>';
            
            data.adsets.forEach(adset => {
                const option = document.createElement('option');
                option.value = adset.id;
                option.textContent = `${adset.name} (${adset.effective_status})`;
                adsetSelect.appendChild(option);
            });
            
            adsetSelect.disabled = false;
            
        } catch (error) {
            console.error('Error loading adsets:', error);
            this.showAlert('Error loading adsets: ' + error.message, 'error');
        }
    }

    async loadReferenceAds(adsetId) {
        if (!adsetId) {
            document.getElementById('reference-ad-select').innerHTML = '<option value="">Select an adset first</option>';
            document.getElementById('reference-ad-select').disabled = true;
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/campaigns/adset/${adsetId}/ads`);
            const data = await response.json();
            
            const referenceAdSelect = document.getElementById('reference-ad-select');
            referenceAdSelect.innerHTML = '<option value="">Select a reference ad...</option>';
            
            data.ads.forEach(ad => {
                const option = document.createElement('option');
                option.value = ad.id;
                option.textContent = `${ad.name} (${ad.effective_status})`;
                referenceAdSelect.appendChild(option);
            });
            
            referenceAdSelect.disabled = false;
            
        } catch (error) {
            console.error('Error loading reference ads:', error);
            this.showAlert('Error loading reference ads: ' + error.message, 'error');
        }
    }

    // CSV handling functions (original tab) - using API route
    loadCSVData() {
        console.log('📄 loadCSVData() called');
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput && fileInput.files.length > 0) {
            this.uploadCSVFile(fileInput.files[0], 'original');
        } else {
            this.showAlert('Please select a CSV file first', 'error');
        }
    }

    handleCSVFileSelect(file) {
        console.log('📄 handleCSVFileSelect() called with file:', file.name);
        
        const csvUploadArea = document.getElementById('csv-upload-area');
        const fileInput = csvUploadArea.querySelector('#csv-file-input');
        
        // Update upload area display - preserve the file input element
        const paragraphs = csvUploadArea.querySelectorAll('p');
        paragraphs.forEach(p => p.remove());
        
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = `📄 Selected: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
        csvUploadArea.insertBefore(newParagraph, fileInput);
        
        // Store the file for later upload when user clicks the button
        console.log('📄 File stored, ready for upload when user clicks Upload CSV button');
    }

    async uploadCSVFile(file, tabType = 'original') {
        try {
            console.log(`📤 Uploading CSV file to server: ${file.name} (${tabType} tab)`);
            
            const formData = new FormData();
            formData.append('csvFile', file);
            
            const response = await fetch(`${this.apiBase}/csv/upload-ad-copy`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'CSV upload failed');
            }
            
            console.log('✅ CSV processed successfully:', result);
            this.sheetsAdCopy = result.adCopy;
            
            // Show preview based on tab type
            if (tabType === 'duplicate') {
                this.displayCSVPreviewDuplicate(result.adCopy);
                this.updateAdSetCreationInfo();
            } else {
                this.displayCSVPreview(result.adCopy);
                this.updateCreateAdsButton();
            }
            
            this.showAlert(`Successfully loaded ${result.totalVariations} ad copy variations`, 'success');
            
        } catch (error) {
            console.error('❌ Error uploading CSV:', error);
            this.showAlert('Error processing CSV: ' + error.message, 'error');
        }
    }

    displayCSVPreview(data) {
        const previewElement = document.getElementById('csv-preview');
        const previewDataElement = document.getElementById('csv-data-preview');
        
        if (data.length === 0) {
            previewElement.classList.add('hidden');
            return;
        }

        // Show first 3 rows as preview
        const previewData = data.slice(0, 3);
        const previewHtml = `
            <div style="font-size: 0.875rem;">
                <strong>${data.length} ad copy variations loaded</strong>
                ${previewData.map((item, index) => `
                    <div style="margin: 0.5rem 0; padding: 0.5rem; background: white; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <div><strong>Book:</strong> ${item.bookId} | <strong>Variation:</strong> ${item.variation}</div>
                        <div><strong>Primary:</strong> ${item.primaryText.substring(0, 80)}${item.primaryText.length > 80 ? '...' : ''}</div>
                        <div><strong>Headline:</strong> ${item.headline}</div>
                    </div>
                `).join('')}
                ${data.length > 3 ? `<div style="text-align: center; color: #718096; font-style: italic;">...and ${data.length - 3} more</div>` : ''}
            </div>
        `;
        
        previewDataElement.innerHTML = previewHtml;
        previewElement.classList.remove('hidden');
    }

    updateCreateAdsButton() {
        const button = document.getElementById('create-ads');
        const totalCombinations = this.uploadedFiles.length * this.sheetsAdCopy.length;
        
        if (totalCombinations > 0) {
            button.disabled = false;
            button.textContent = `Create ${totalCombinations} Ad Combinations`;
        } else {
            button.disabled = true;
            button.textContent = 'Create All Ad Combinations';
        }
    }

    // File upload handling
    handleFileUpload(files) {
        console.log('📤 handleFileUpload() called with files:', files.length);

        // Make upload cumulative - add new files to existing ones
        const newFiles = Array.from(files);

        // Filter out duplicates based on file name and size
        const existingFileKeys = new Set(
            this.uploadedFiles.map(f => `${f.name}_${f.size}`)
        );

        const uniqueNewFiles = newFiles.filter(file => {
            const fileKey = `${file.name}_${file.size}`;
            return !existingFileKeys.has(fileKey);
        });

        if (uniqueNewFiles.length < newFiles.length) {
            const duplicateCount = newFiles.length - uniqueNewFiles.length;
            console.log(`⚠️ Skipped ${duplicateCount} duplicate file(s)`);
            this.showAlert(`Skipped ${duplicateCount} duplicate file(s)`, 'warning');
        }

        // Add unique new files to existing files
        this.uploadedFiles = [...this.uploadedFiles, ...uniqueNewFiles];

        // Update both tabs' displays
        this.updateFileDisplay();
        this.updateCreateAdsButton();
        this.updateAdSetCreationInfo();

        console.log('✅ Total files uploaded:', this.uploadedFiles.map(f => f.name));
    }

    updateFileDisplay() {
        // Update original tab
        const uploadedFilesElement = document.getElementById('uploaded-files');
        const filesListElement = document.getElementById('files-list');
        
        // Update duplicate tab
        const uploadedFilesElementDuplicate = document.getElementById('uploaded-files-duplicate');
        const filesListElementDuplicate = document.getElementById('files-list-duplicate');
        
        if (this.uploadedFiles.length === 0) {
            if (uploadedFilesElement) uploadedFilesElement.classList.add('hidden');
            if (uploadedFilesElementDuplicate) uploadedFilesElementDuplicate.classList.add('hidden');
            return;
        }

        const filesHtml = this.uploadedFiles.map((file, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;">
                <div>
                    <strong>${file.name}</strong>
                    <span style="color: #718096; margin-left: 0.5rem;">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button class="remove-file-btn" data-index="${index}" style="background: #fed7d7; color: #c53030; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">Remove</button>
            </div>
        `).join('');

        // Update both tabs
        if (filesListElement) {
            filesListElement.innerHTML = filesHtml;
            uploadedFilesElement.classList.remove('hidden');
            // Add event listeners to remove buttons
            this.attachRemoveButtonListeners(filesListElement);
        }

        if (filesListElementDuplicate) {
            filesListElementDuplicate.innerHTML = filesHtml;
            uploadedFilesElementDuplicate.classList.remove('hidden');
            // Add event listeners to remove buttons
            this.attachRemoveButtonListeners(filesListElementDuplicate);
        }
    }

    removeFile(index) {
        console.log(`🗑️ Removing file at index ${index}`);
        this.uploadedFiles.splice(index, 1);
        this.updateFileDisplay();
        this.updateCreateAdsButton();
        this.updateAdSetCreationInfo();
        this.showAlert('File removed', 'success');
    }

    attachRemoveButtonListeners(container) {
        const removeButtons = container.querySelectorAll('.remove-file-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(button.getAttribute('data-index'));
                this.removeFile(index);
            });
        });
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
        // Insert at the top of the container
        const container = document.querySelector('.container');
        container.insertBefore(alertDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }


    downloadSampleCSV() {
        // Use the API route to download the sample CSV
        const link = document.createElement('a');
        link.href = `${this.apiBase}/csv/sample-format`;
        link.download = 'ad-copy-sample.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Duplicate CSV handling functions (using same API route)
    loadCSVDataDuplicate() {
        console.log('📄 loadCSVDataDuplicate() called');
        const fileInput = document.getElementById('csv-file-input-duplicate');
        if (fileInput && fileInput.files.length > 0) {
            this.uploadCSVFile(fileInput.files[0], 'duplicate');
        } else {
            this.showAlert('Please select a CSV file first', 'error');
        }
    }

    handleCSVFileSelectDuplicate(file) {
        console.log('📄 handleCSVFileSelectDuplicate() called with file:', file.name);
        
        const csvUploadArea = document.getElementById('csv-upload-area-duplicate');
        const fileInput = csvUploadArea.querySelector('#csv-file-input-duplicate');
        
        // Update upload area display - preserve the file input element
        const paragraphs = csvUploadArea.querySelectorAll('p');
        paragraphs.forEach(p => p.remove());
        
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = `📄 Selected: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
        csvUploadArea.insertBefore(newParagraph, fileInput);
        
        // Store the file for later upload when user clicks the button
        console.log('📄 File stored (duplicate), ready for upload when user clicks Upload CSV button');
    }

    displayCSVPreviewDuplicate(data) {
        const previewElement = document.getElementById('csv-preview-duplicate');
        const previewDataElement = document.getElementById('csv-data-preview-duplicate');
        
        if (data.length === 0) {
            previewElement.classList.add('hidden');
            return;
        }

        // Show first 3 rows as preview - identical to original
        const previewData = data.slice(0, 3);
        const previewHtml = `
            <div style="font-size: 0.875rem;">
                <strong>${data.length} ad copy variations loaded</strong>
                ${previewData.map((item, index) => `
                    <div style="margin: 0.5rem 0; padding: 0.5rem; background: white; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <div><strong>Book:</strong> ${item.bookId} | <strong>Variation:</strong> ${item.variation}</div>
                        <div><strong>Primary:</strong> ${item.primaryText.substring(0, 80)}${item.primaryText.length > 80 ? '...' : ''}</div>
                        <div><strong>Headline:</strong> ${item.headline}</div>
                    </div>
                `).join('')}
                ${data.length > 3 ? `<div style="text-align: center; color: #718096; font-style: italic;">...and ${data.length - 3} more</div>` : ''}
            </div>
        `;
        
        previewDataElement.innerHTML = previewHtml;
        previewElement.classList.remove('hidden');
    }

    // Tab navigation functions
    setupTabNavigation() {
        // Main tabs
        document.querySelectorAll('.tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.getAttribute('data-tab');
                this.showTab(tabId);
            });
        });
    }

    showTab(tabId) {
        // Main tabs
        if (tabId === 'creative-ads' || tabId === 'performance-monitoring') {
            // Hide all main tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active from all main tabs
            document.querySelectorAll('.tab[data-tab]').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected main tab
            document.getElementById(`${tabId}-tab`).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        }
        
        // Sub-tabs within creative-ads
        if (tabId === 'add-to-existing' || tabId === 'create-new-adset') {
            // Hide all sub-tab contents
            document.getElementById('add-to-existing-tab').classList.remove('active');
            document.getElementById('create-new-adset-tab').classList.remove('active');
            
            // Remove active from all sub-tabs
            document.querySelectorAll('.tab[data-tab="add-to-existing"], .tab[data-tab="create-new-adset"]').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected sub-tab
            document.getElementById(`${tabId}-tab`).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        }
        
        // Sub-tabs within performance-monitoring
        if (tabId === 'ctr-monitoring' || tabId === 'multi-kpi-monitoring') {
            // Hide all performance monitoring sub-tab contents
            document.getElementById('ctr-monitoring-tab').classList.remove('active');
            document.getElementById('multi-kpi-monitoring-tab').classList.remove('active');
            
            // Remove active from all performance monitoring sub-tabs
            document.querySelectorAll('#performance-monitoring-tab .tab[data-tab]').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected performance monitoring sub-tab
            document.getElementById(`${tabId}-tab`).classList.add('active');
            document.querySelector(`#performance-monitoring-tab [data-tab="${tabId}"]`).classList.add('active');
        }
    }

    // Duplicate adset functions
    async loadAdSetsDuplicate(campaignId) {
        if (!campaignId) {
            document.getElementById('adset-select-duplicate').innerHTML = '<option value="">Select a campaign first</option>';
            document.getElementById('adset-select-duplicate').disabled = true;
            document.getElementById('reference-ad-select-duplicate').innerHTML = '<option value="">Select an adset first</option>';
            document.getElementById('reference-ad-select-duplicate').disabled = true;
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/campaigns/${campaignId}`);
            const data = await response.json();
            
            const adsetSelect = document.getElementById('adset-select-duplicate');
            adsetSelect.innerHTML = '<option value="">Select an adset to duplicate...</option>';
            
            data.adsets.forEach(adset => {
                const option = document.createElement('option');
                option.value = adset.id;
                option.textContent = `${adset.name} (${adset.effective_status})`;
                adsetSelect.appendChild(option);
            });
            
            adsetSelect.disabled = false;
            
        } catch (error) {
            console.error('Error loading adsets for duplicate:', error);
            this.showAlert('Error loading adsets: ' + error.message, 'error');
        }
    }

    async loadReferenceAdsDuplicate(adsetId) {
        if (!adsetId) {
            document.getElementById('reference-ad-select-duplicate').innerHTML = '<option value="">Select an adset first</option>';
            document.getElementById('reference-ad-select-duplicate').disabled = true;
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/campaigns/adset/${adsetId}/ads`);
            const data = await response.json();
            
            const referenceAdSelect = document.getElementById('reference-ad-select-duplicate');
            referenceAdSelect.innerHTML = '<option value="">Select a reference ad...</option>';
            
            data.ads.forEach(ad => {
                const option = document.createElement('option');
                option.value = ad.id;
                option.textContent = `${ad.name} (${ad.effective_status})`;
                referenceAdSelect.appendChild(option);
            });
            
            referenceAdSelect.disabled = false;
            
        } catch (error) {
            console.error('Error loading reference ads for duplicate:', error);
            this.showAlert('Error loading reference ads: ' + error.message, 'error');
        }
    }

    updateAdSetCreationInfo() {
        const totalCombinations = this.uploadedFiles.length * this.sheetsAdCopy.length;
        const adsetsNeeded = Math.ceil(totalCombinations / 50);
        
        document.getElementById('total-combinations').textContent = totalCombinations;
        document.getElementById('adsets-needed').textContent = adsetsNeeded;
        
        const button = document.getElementById('create-duplicate-adset');
        if (totalCombinations > 0) {
            button.disabled = false;
            button.textContent = `Create ${adsetsNeeded} AdSet${adsetsNeeded > 1 ? 's' : ''} & ${totalCombinations} Ads`;
        } else {
            button.disabled = true;
            button.textContent = 'Create New AdSet & Ads';
        }
    }

    async createDuplicateAdSet() {
        console.log('🚀 createDuplicateAdSet() called');
        
        try {
            // Get selected values
            const campaignId = document.getElementById('campaign-select-duplicate').value;
            const referenceAdsetId = document.getElementById('adset-select-duplicate').value;
            const referenceAdId = document.getElementById('reference-ad-select-duplicate').value;
            
            if (!campaignId || !referenceAdsetId || !referenceAdId) {
                this.showAlert('Please select campaign, reference adset, and reference ad', 'error');
                return;
            }
            
            if (this.uploadedFiles.length === 0) {
                this.showAlert('Please upload creative files first', 'error');
                return;
            }
            
            if (this.sheetsAdCopy.length === 0) {
                this.showAlert('Please upload CSV ad copy data first', 'error');
                return;
            }
            
            const button = document.getElementById('create-duplicate-adset');
            const originalText = button.innerHTML;
            button.innerHTML = '⏳ Creating duplicate adset(s)...';
            button.disabled = true;
            
            // Calculate how many adsets we need
            const totalCombinations = this.uploadedFiles.length * this.sheetsAdCopy.length;
            const adsetsNeeded = Math.ceil(totalCombinations / 50);
            
            console.log(`📊 Creating ${adsetsNeeded} adset(s) for ${totalCombinations} ad combinations`);
            
            // Step 1: Upload creative files to server and get Meta hashes
            console.log('📤 Uploading creative files to server...');
            const formData = new FormData();
            this.uploadedFiles.forEach(file => {
                formData.append('creatives', file);
            });
            formData.append('adsetId', referenceAdsetId); // Use reference adset for image upload context
            
            const uploadResponse = await fetch(`${this.apiBase}/creatives/upload-for-adset`, {
                method: 'POST',
                body: formData
            });
            
            const uploadResult = await uploadResponse.json();
            
            if (!uploadResult.success || uploadResult.creativeIds.length === 0) {
                throw new Error('Failed to upload creative files: ' + (uploadResult.error || 'No creative IDs returned'));
            }
            
            console.log('✅ Creative files uploaded successfully. Meta hashes:', uploadResult.creativeIds);

            // Create filename mapping: creativeId -> originalName
            const creativeFilenames = {};
            if (uploadResult.files) {
                uploadResult.files.forEach(file => {
                    const creativeId = file.metaHash || file.metaVideoId;
                    if (creativeId && file.originalName) {
                        creativeFilenames[creativeId] = file.originalName;
                    }
                });
            }
            console.log('📁 Creative filename mapping:', creativeFilenames);

            // Step 2: Create duplicate adset(s) with ads
            console.log('🎯 Creating duplicate adset(s) and ads...');
            const createResponse = await fetch(`${this.apiBase}/campaigns/create-duplicate-adset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId: campaignId,
                    referenceAdsetId: referenceAdsetId,
                    referenceAdId: referenceAdId,
                    creativeIds: uploadResult.creativeIds, // Meta image hashes
                    adCopyVariations: this.sheetsAdCopy,
                    maxAdsPerAdset: 50,
                    creativeFilenames
                })
            });
            
            const createResult = await createResponse.json();
            
            if (!createResult.success) {
                throw new Error('Failed to create duplicate adset: ' + (createResult.error || 'Unknown error'));
            }
            
            // Success! Show results
            const totalAds = createResult.totalAdsCreated || 0;
            const adsetsCreated = createResult.adsetsCreated || 0;
            const failedAds = createResult.failedAds || 0;
            
            let message = `✅ Successfully created ${adsetsCreated} duplicate adset(s) with ${totalAds} ads`;
            if (failedAds > 0) {
                message += ` (${failedAds} ads failed)`;
            }
            
            this.showAlert(message, 'success');
            
            console.log('🎉 Duplicate adset creation completed:', {
                adsetsCreated: adsetsCreated,
                totalAdsCreated: totalAds,
                failedAds: failedAds,
                results: createResult.results
            });
            
        } catch (error) {
            console.error('❌ Error creating duplicate adset:', error);
            this.showAlert('Error creating duplicate adset: ' + error.message, 'error');
        } finally {
            const button = document.getElementById('create-duplicate-adset');
            button.innerHTML = 'Create New AdSet & Ads';
            button.disabled = false;
        }
    }

    // Performance Monitoring Methods
    setupPerformanceMonitoring() {
        // CTR Monitoring Tab
        const ctrCampaignSelect = document.getElementById('ctr-campaign-select');
        if (ctrCampaignSelect) {
            ctrCampaignSelect.addEventListener('change', (e) => this.loadCTRAdSets(e.target.value));
        }

        const startCTRBtn = document.getElementById('start-ctr-monitoring');
        if (startCTRBtn) {
            startCTRBtn.addEventListener('click', () => this.startCTRMonitoring());
        }

        const stopCTRBtn = document.getElementById('stop-ctr-monitoring');
        if (stopCTRBtn) {
            stopCTRBtn.addEventListener('click', () => this.stopCTRMonitoring());
        }

        const triggerCTRBtn = document.getElementById('trigger-ctr-check');
        if (triggerCTRBtn) {
            triggerCTRBtn.addEventListener('click', () => this.triggerCTRCheck());
        }

        // Multi-KPI Monitoring Tab
        const multiCampaignSelect = document.getElementById('multi-campaign-select');
        if (multiCampaignSelect) {
            multiCampaignSelect.addEventListener('change', (e) => this.loadMultiAdSets(e.target.value));
        }

        const startMultiBtn = document.getElementById('start-multi-monitoring');
        if (startMultiBtn) {
            startMultiBtn.addEventListener('click', () => this.startMultiMonitoring());
        }

        const stopMultiBtn = document.getElementById('stop-multi-monitoring');
        if (stopMultiBtn) {
            stopMultiBtn.addEventListener('click', () => this.stopMultiMonitoring());
        }

        const triggerMultiBtn = document.getElementById('trigger-multi-check');
        if (triggerMultiBtn) {
            triggerMultiBtn.addEventListener('click', () => this.triggerMultiCheck());
        }

        // Threshold Forms
        const ctrThresholdForm = document.getElementById('ctr-threshold-form');
        if (ctrThresholdForm) {
            ctrThresholdForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateCTRThreshold();
            });
        }

        const multiThresholdForm = document.getElementById('multi-kpi-thresholds-form');
        if (multiThresholdForm) {
            multiThresholdForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateMultiThresholds();
            });
        }

        // Load campaigns for performance monitoring
        this.loadMonitoringCampaigns();
    }

    async loadMonitoringCampaigns() {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/campaigns`);
            const data = await response.json();

            // Populate CTR campaign select
            const ctrSelect = document.getElementById('ctr-campaign-select');
            if (ctrSelect) {
                ctrSelect.innerHTML = '<option value="">Choose a campaign...</option>';
                data.campaigns.forEach(campaign => {
                    ctrSelect.innerHTML += `<option value="${campaign.id}">${campaign.name}</option>`;
                });
            }

            // Populate Multi-KPI campaign select
            const multiSelect = document.getElementById('multi-campaign-select');
            if (multiSelect) {
                multiSelect.innerHTML = '<option value="">Choose a campaign...</option>';
                data.campaigns.forEach(campaign => {
                    multiSelect.innerHTML += `<option value="${campaign.id}">${campaign.name}</option>`;
                });
            }
        } catch (error) {
            console.error('Error loading monitoring campaigns:', error);
        }
    }

    async loadCTRAdSets(campaignId) {
        if (!campaignId) {
            document.getElementById('ctr-adset-selection').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/monitoring/campaigns/${campaignId}/adsets`);
            const data = await response.json();

            const checkboxContainer = document.getElementById('ctr-adset-checkboxes');
            checkboxContainer.innerHTML = '';

            // Add select all checkbox
            checkboxContainer.innerHTML += `
                <div class="checkbox-item select-all-checkbox">
                    <input type="checkbox" id="ctr-select-all" checked>
                    <label for="ctr-select-all">Select All AdSets</label>
                </div>
            `;

            // Add individual adset checkboxes
            data.adsets.forEach(adset => {
                const checkboxId = `ctr-adset-${adset.id}`;
                checkboxContainer.innerHTML += `
                    <div class="checkbox-item">
                        <input type="checkbox" id="${checkboxId}" value="${adset.id}" checked>
                        <label for="${checkboxId}">${adset.name} (${adset.effective_status})</label>
                    </div>
                `;
            });

            // Show the selection area
            document.getElementById('ctr-adset-selection').style.display = 'block';

            // Setup select all functionality
            document.getElementById('ctr-select-all').addEventListener('change', (e) => {
                const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#ctr-select-all)');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });

            // Update select all when individual checkboxes change
            checkboxContainer.addEventListener('change', (e) => {
                if (e.target.id !== 'ctr-select-all') {
                    const allCheckboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#ctr-select-all)');
                    const checkedBoxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#ctr-select-all):checked');
                    document.getElementById('ctr-select-all').checked = allCheckboxes.length === checkedBoxes.length;
                }
            });

        } catch (error) {
            console.error('Error loading CTR adsets:', error);
            this.showAlert('Error loading adsets: ' + error.message, 'error');
        }
    }

    async loadMultiAdSets(campaignId) {
        if (!campaignId) {
            document.getElementById('multi-adset-selection').style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/monitoring/campaigns/${campaignId}/adsets`);
            const data = await response.json();

            const checkboxContainer = document.getElementById('multi-adset-checkboxes');
            checkboxContainer.innerHTML = '';

            // Add select all checkbox
            checkboxContainer.innerHTML += `
                <div class="checkbox-item select-all-checkbox">
                    <input type="checkbox" id="multi-select-all" checked>
                    <label for="multi-select-all">Select All AdSets</label>
                </div>
            `;

            // Add individual adset checkboxes
            data.adsets.forEach(adset => {
                const checkboxId = `multi-adset-${adset.id}`;
                checkboxContainer.innerHTML += `
                    <div class="checkbox-item">
                        <input type="checkbox" id="${checkboxId}" value="${adset.id}" checked>
                        <label for="${checkboxId}">${adset.name} (${adset.effective_status})</label>
                    </div>
                `;
            });

            // Show the selection area
            document.getElementById('multi-adset-selection').style.display = 'block';

            // Setup select all functionality
            document.getElementById('multi-select-all').addEventListener('change', (e) => {
                const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#multi-select-all)');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });

            // Update select all when individual checkboxes change
            checkboxContainer.addEventListener('change', (e) => {
                if (e.target.id !== 'multi-select-all') {
                    const allCheckboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#multi-select-all)');
                    const checkedBoxes = checkboxContainer.querySelectorAll('input[type="checkbox"]:not(#multi-select-all):checked');
                    document.getElementById('multi-select-all').checked = allCheckboxes.length === checkedBoxes.length;
                }
            });

        } catch (error) {
            console.error('Error loading Multi-KPI adsets:', error);
            this.showAlert('Error loading adsets: ' + error.message, 'error');
        }
    }

    getSelectedCTRAdSets() {
        const checkboxes = document.querySelectorAll('#ctr-adset-checkboxes input[type="checkbox"]:not(#ctr-select-all):checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    getSelectedMultiAdSets() {
        const checkboxes = document.querySelectorAll('#multi-adset-checkboxes input[type="checkbox"]:not(#multi-select-all):checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // CTR Monitoring
    ctrMonitoringInterval = null;
    ctrMonitoringStatus = false;

    async startCTRMonitoring() {
        const campaignId = document.getElementById('ctr-campaign-select').value;
        if (!campaignId) {
            this.showAlert('Please select a campaign to monitor', 'error');
            return;
        }

        const selectedAdSets = this.getSelectedCTRAdSets();
        if (selectedAdSets.length === 0) {
            this.showAlert('Please select at least one AdSet to monitor', 'error');
            return;
        }

        const intervalSeconds = parseInt(document.getElementById('ctr-check-interval').value) || 30;
        const minCTR = parseFloat(document.getElementById('min-ctr').value) || 1.0;

        this.ctrMonitoringStatus = true;
        this.updateCTRMonitoringUI(true);

        // Perform initial check
        await this.performCTRCheck(campaignId, selectedAdSets, minCTR);

        // Set up interval
        this.ctrMonitoringInterval = setInterval(() => {
            this.performCTRCheck(campaignId, selectedAdSets, minCTR);
        }, intervalSeconds * 1000);

        this.showAlert('CTR monitoring started', 'success');
    }

    stopCTRMonitoring() {
        if (this.ctrMonitoringInterval) {
            clearInterval(this.ctrMonitoringInterval);
            this.ctrMonitoringInterval = null;
        }
        this.ctrMonitoringStatus = false;
        this.updateCTRMonitoringUI(false);
        this.showAlert('CTR monitoring stopped', 'success');
    }

    async triggerCTRCheck() {
        const campaignId = document.getElementById('ctr-campaign-select').value;
        if (!campaignId) {
            this.showAlert('Please select a campaign', 'error');
            return;
        }

        const selectedAdSets = this.getSelectedCTRAdSets();
        const minCTR = parseFloat(document.getElementById('min-ctr').value) || 1.0;

        await this.performCTRCheck(campaignId, selectedAdSets, minCTR);
    }

    async performCTRCheck(campaignId, adSetIds, minCTR) {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/check-ctr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, adSetIds, minCTR })
            });

            const data = await response.json();

            // Update last check time
            document.getElementById('ctr-last-check').textContent = new Date().toLocaleTimeString();

            // Update underperforming ads list
            this.displayCTRUnderperformingAds(data.underperformingAds);

            // Update pause log if any ads were paused
            if (data.pausedAds && data.pausedAds.length > 0) {
                this.updateCTRPauseLog(data.pausedAds);
            }

        } catch (error) {
            console.error('Error performing CTR check:', error);
        }
    }

    displayCTRUnderperformingAds(ads) {
        const container = document.getElementById('ctr-underperforming-ads-list');
        const badge = document.getElementById('ctr-underperforming-badge');

        badge.textContent = `${ads.length} ads`;
        badge.className = `status-badge ${ads.length > 0 ? 'status-stopped' : 'status-running'}`;

        if (ads.length === 0) {
            container.innerHTML = '<p>No underperforming ads found! 🎉</p>';
            return;
        }

        const adsHtml = ads.map(ad => `
            <div class="metric" style="margin-bottom: 1rem; padding: 1rem; background: #fff7ed; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>${ad.name}</strong>
                    <span class="status-badge status-stopped">CTR: ${ad.ctr.toFixed(2)}%</span>
                </div>
                <div style="font-size: 0.875rem; color: #718096;">
                    AdSet: ${ad.adSetName}<br>
                    Impressions: ${ad.impressions} | Clicks: ${ad.clicks}
                </div>
            </div>
        `).join('');

        container.innerHTML = adsHtml;
    }

    updateCTRPauseLog(pausedAds) {
        const container = document.getElementById('ctr-pause-log');
        const timestamp = new Date().toLocaleString();

        const logEntry = `
            <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fee; border-radius: 4px;">
                <div style="font-weight: 500;">${timestamp}</div>
                <div style="font-size: 0.875rem; color: #718096;">
                    Paused ${pausedAds.length} ads due to low CTR
                </div>
            </div>
        `;

        container.innerHTML = logEntry + container.innerHTML;
    }

    updateCTRMonitoringUI(isRunning) {
        const statusBadge = document.getElementById('ctr-monitoring-status');
        const startBtn = document.getElementById('start-ctr-monitoring');
        const stopBtn = document.getElementById('stop-ctr-monitoring');

        if (isRunning) {
            statusBadge.textContent = 'Running';
            statusBadge.className = 'status-badge status-running';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            statusBadge.textContent = 'Stopped';
            statusBadge.className = 'status-badge status-stopped';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    // Multi-KPI Monitoring
    multiMonitoringInterval = null;
    multiMonitoringStatus = false;

    async startMultiMonitoring() {
        const campaignId = document.getElementById('multi-campaign-select').value;
        if (!campaignId) {
            this.showAlert('Please select a campaign to monitor', 'error');
            return;
        }

        const selectedAdSets = this.getSelectedMultiAdSets();
        if (selectedAdSets.length === 0) {
            this.showAlert('Please select at least one AdSet to monitor', 'error');
            return;
        }

        const intervalSeconds = parseInt(document.getElementById('multi-check-interval').value) || 30;
        const thresholds = this.getMultiKPIThresholds();

        this.multiMonitoringStatus = true;
        this.updateMultiMonitoringUI(true);

        // Perform initial check
        await this.performMultiCheck(campaignId, selectedAdSets, thresholds);

        // Set up interval
        this.multiMonitoringInterval = setInterval(() => {
            this.performMultiCheck(campaignId, selectedAdSets, thresholds);
        }, intervalSeconds * 1000);

        this.showAlert('Multi-KPI monitoring started', 'success');
    }

    stopMultiMonitoring() {
        if (this.multiMonitoringInterval) {
            clearInterval(this.multiMonitoringInterval);
            this.multiMonitoringInterval = null;
        }
        this.multiMonitoringStatus = false;
        this.updateMultiMonitoringUI(false);
        this.showAlert('Multi-KPI monitoring stopped', 'success');
    }

    async triggerMultiCheck() {
        const campaignId = document.getElementById('multi-campaign-select').value;
        if (!campaignId) {
            this.showAlert('Please select a campaign', 'error');
            return;
        }

        const selectedAdSets = this.getSelectedMultiAdSets();
        const thresholds = this.getMultiKPIThresholds();

        await this.performMultiCheck(campaignId, selectedAdSets, thresholds);
    }

    getMultiKPIThresholds() {
        const maxCostStreak = document.getElementById('max-cost-streak').value;
        const maxCostPurchase = document.getElementById('max-cost-purchase').value;
        const minROAS = document.getElementById('min-roas').value;

        const thresholds = {};
        if (maxCostStreak) thresholds.maxCostPerStreak = parseFloat(maxCostStreak);
        if (maxCostPurchase) thresholds.maxCostPerPurchase = parseFloat(maxCostPurchase);
        if (minROAS) thresholds.minROAS = parseFloat(minROAS);

        return thresholds;
    }

    async performMultiCheck(campaignId, adSetIds, thresholds) {
        try {
            const response = await fetch(`${this.apiBase}/monitoring/check-multi-kpi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, adSetIds, thresholds })
            });

            const data = await response.json();

            // Update last check time
            document.getElementById('multi-last-check').textContent = new Date().toLocaleTimeString();

            // Update underperforming ads list
            this.displayMultiUnderperformingAds(data.underperformingAds);

            // Update pause log if any ads were paused
            if (data.pausedAds && data.pausedAds.length > 0) {
                this.updateMultiPauseLog(data.pausedAds);
            }

        } catch (error) {
            console.error('Error performing Multi-KPI check:', error);
        }
    }

    displayMultiUnderperformingAds(ads) {
        const container = document.getElementById('multi-underperforming-ads-list');
        const badge = document.getElementById('multi-underperforming-badge');

        badge.textContent = `${ads.length} ads`;
        badge.className = `status-badge ${ads.length > 0 ? 'status-stopped' : 'status-running'}`;

        if (ads.length === 0) {
            container.innerHTML = '<p>No underperforming ads found! 🎉</p>';
            return;
        }

        const adsHtml = ads.map(ad => `
            <div class="metric" style="margin-bottom: 1rem; padding: 1rem; background: #fff7ed; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>${ad.name}</strong>
                    <span class="status-badge status-stopped">${ad.violations.join(', ')}</span>
                </div>
                <div style="font-size: 0.875rem; color: #718096;">
                    AdSet: ${ad.adSetName}<br>
                    ${ad.metrics}
                </div>
            </div>
        `).join('');

        container.innerHTML = adsHtml;
    }

    updateMultiPauseLog(pausedAds) {
        const container = document.getElementById('multi-pause-log');
        const timestamp = new Date().toLocaleString();

        const logEntry = `
            <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fee; border-radius: 4px;">
                <div style="font-weight: 500;">${timestamp}</div>
                <div style="font-size: 0.875rem; color: #718096;">
                    Paused ${pausedAds.length} ads due to KPI violations
                </div>
            </div>
        `;

        container.innerHTML = logEntry + container.innerHTML;
    }

    updateMultiMonitoringUI(isRunning) {
        const statusBadge = document.getElementById('multi-monitoring-status');
        const startBtn = document.getElementById('start-multi-monitoring');
        const stopBtn = document.getElementById('stop-multi-monitoring');

        if (isRunning) {
            statusBadge.textContent = 'Running';
            statusBadge.className = 'status-badge status-running';
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            statusBadge.textContent = 'Stopped';
            statusBadge.className = 'status-badge status-stopped';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    updateCTRThreshold() {
        const minCTR = document.getElementById('min-ctr').value;
        localStorage.setItem('ctr-threshold', minCTR);
        this.showAlert('CTR threshold updated', 'success');
    }

    updateMultiThresholds() {
        const thresholds = this.getMultiKPIThresholds();
        localStorage.setItem('multi-kpi-thresholds', JSON.stringify(thresholds));
        this.showAlert('Multi-KPI thresholds updated', 'success');
    }

}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Meta Ads Dashboard...');
    const dashboard = new MetaAdsDashboard();
    window.dashboard = dashboard; // Make it accessible globally for debugging
    
    // FAILSAFE: Global click handler for performance tabs
    document.addEventListener('click', function(e) {
        // Check if clicked element or its parent is a performance monitoring tab
        const target = e.target;
        const parent = target.parentElement;
        
        if (target.getAttribute('data-tab') === 'ctr-monitoring' || 
            (parent && parent.getAttribute('data-tab') === 'ctr-monitoring')) {
            console.log('🚨 FAILSAFE: CTR tab clicked!');
            e.preventDefault();
            e.stopPropagation();
            dashboard.switchToPerformanceTab('ctr');
        }
        
        if (target.getAttribute('data-tab') === 'multi-kpi-monitoring' || 
            (parent && parent.getAttribute('data-tab') === 'multi-kpi-monitoring')) {
            console.log('🚨 FAILSAFE: Multi-KPI tab clicked!');
            e.preventDefault();
            e.stopPropagation();
            dashboard.switchToPerformanceTab('multi');
        }
    }, true); // Use capture phase
});