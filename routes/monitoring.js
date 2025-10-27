const express = require('express');
const performanceMonitor = require('../services/performanceMonitor');
const supabaseService = require('../services/supabaseClient');
const metaService = require('../services/metaService');
const router = express.Router();

// Get monitoring status
router.get('/status', (req, res) => {
  const status = performanceMonitor.getStatus();
  res.json(status);
});

// Start monitoring
router.post('/start', (req, res) => {
  try {
    performanceMonitor.start();
    res.json({ message: 'Performance monitoring started', status: 'running' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop monitoring
router.post('/stop', (req, res) => {
  try {
    performanceMonitor.stop();
    res.json({ message: 'Performance monitoring stopped', status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual performance check
router.post('/check', async (req, res) => {
  try {
    await performanceMonitor.triggerCheck();
    res.json({ message: 'Manual performance check completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get underperforming ads
router.get('/underperforming', async (req, res) => {
  try {
    const { thresholds } = req.query;
    const customThresholds = thresholds ? JSON.parse(thresholds) : undefined;
    
    const underperformingAds = await supabaseService.getUnderperformingAds(customThresholds);
    res.json({
      underperformingAds,
      count: underperformingAds.length,
      thresholds: customThresholds
    });
  } catch (error) {
    console.error('Error getting underperforming ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ad performance metrics
router.get('/ad-performance/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const { timeframe = '7d' } = req.query;

    // Get both Meta and Supabase metrics
    const [metaInsights, retentionData] = await Promise.all([
      metaService.getAdInsights(adId, 'last_7_days'),
      supabaseService.getUserRetentionByAdId(adId, timeframe)
    ]);

    res.json({
      adId,
      metaInsights,
      retentionData,
      combinedScore: calculateCombinedScore(metaInsights, retentionData)
    });

  } catch (error) {
    console.error('Error getting ad performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause specific ads manually
router.post('/pause-ads', async (req, res) => {
  try {
    const { adIds, reason = 'Manual pause' } = req.body;

    if (!adIds || !Array.isArray(adIds)) {
      return res.status(400).json({ error: 'adIds must be an array' });
    }

    const results = await metaService.batchPauseAds(adIds, reason);

    // Log pause actions in Supabase
    for (const result of results) {
      if (result.status === 'success') {
        await supabaseService.logAdPauseAction(result.adId, reason, {
          manualPause: true,
          pausedAt: new Date().toISOString()
        });
      }
    }

    res.json({
      message: 'Batch pause operation completed',
      results,
      successCount: results.filter(r => r.status === 'success').length,
      errorCount: results.filter(r => r.status === 'error').length
    });

  } catch (error) {
    console.error('Error pausing ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get real-time dashboard metrics
router.get('/dashboard', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    // Get various metrics for dashboard
    const [
      realTimeMetrics,
      underperformingAds,
      activeCampaigns
    ] = await Promise.all([
      supabaseService.getRealTimeMetrics(timeframe),
      supabaseService.getUnderperformingAds(),
      metaService.getActiveCampaigns()
    ]);

    // Calculate summary statistics
    const summary = {
      totalActiveCampaigns: activeCampaigns.length,
      totalUnderperformingAds: underperformingAds.length,
      monitoringStatus: performanceMonitor.getStatus(),
      lastCheckTime: new Date().toISOString()
    };

    res.json({
      summary,
      realTimeMetrics,
      underperformingAds: underperformingAds.slice(0, 10), // Top 10 worst performers
      activeCampaigns: activeCampaigns.slice(0, 5) // Top 5 campaigns
    });

  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get monitoring logs
router.get('/logs', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const { limit = 100 } = req.query;

    const logPath = path.join(__dirname, '..', 'logs', 'performance_monitor.log');
    
    try {
      const logData = await fs.readFile(logPath, 'utf8');
      const logs = logData.trim().split('\n')
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { timestamp: new Date().toISOString(), message: line };
          }
        })
        .reverse() // Most recent first
        .slice(0, parseInt(limit));

      res.json({ logs, count: logs.length });

    } catch (error) {
      res.json({ logs: [], count: 0, message: 'No logs found' });
    }

  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update monitoring thresholds
router.post('/thresholds', (req, res) => {
  try {
    const newThresholds = req.body;
    
    // Validate thresholds
    const validThresholds = {};
    const allowedKeys = [
      'minDay1Retention', 'minDay3Retention', 'minDay7Retention',
      'minSessionCount', 'minTimeSpent', 'minInstalls',
      'minCTR', 'maxCPM', 'minROAS', 'maxCPA'
    ];

    for (const key of allowedKeys) {
      if (newThresholds[key] !== undefined) {
        const value = parseFloat(newThresholds[key]);
        if (!isNaN(value)) {
          validThresholds[key] = value;
        }
      }
    }

    // Update performance monitor thresholds
    Object.assign(performanceMonitor.thresholds, validThresholds);

    res.json({
      message: 'Thresholds updated successfully',
      thresholds: performanceMonitor.thresholds
    });

  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test API connections
router.get('/test-connections', async (req, res) => {
  try {
    // Test Meta API connection
    const metaConnection = await metaService.validateApiConnection();

    // Test Supabase connection
    let supabaseConnection;
    try {
      await supabaseService.getRealTimeMetrics('1h');
      supabaseConnection = {
        connected: true,
        message: 'Successfully connected to Supabase'
      };
    } catch (error) {
      supabaseConnection = {
        connected: false,
        error: error.message,
        message: 'Failed to connect to Supabase'
      };
    }

    res.json({
      connections: {
        meta: metaConnection,
        supabase: supabaseConnection
      },
      allConnected: metaConnection.connected && supabaseConnection.connected
    });

  } catch (error) {
    console.error('Error testing connections:', error);
    res.status(500).json({ error: error.message });
  }
});

// CTR Monitoring Check
router.post('/check-ctr', async (req, res) => {
  try {
    const { campaignId, adSetIds, minCTR } = req.body;
    
    const underperformingAds = [];
    const pausedAds = [];

    // Get ads for each adset
    for (const adSetId of adSetIds) {
      try {
        const ads = await metaService.getAdSetAds(adSetId);
        
        for (const ad of ads) {
          // Get ad insights to calculate CTR
          const insights = await metaService.getAdInsights(ad.id, 'today');
          
          if (insights && insights.length > 0) {
            const metrics = insights[0];
            const impressions = parseInt(metrics.impressions || 0);
            const clicks = parseInt(metrics.clicks || 0);
            
            if (impressions > 100) { // Only check ads with significant impressions
              const ctr = (clicks / impressions) * 100;
              
              if (ctr < minCTR) {
                const adInfo = {
                  id: ad.id,
                  name: ad.name,
                  adSetId: adSetId,
                  adSetName: ad.adset?.name || 'Unknown AdSet',
                  ctr: ctr,
                  impressions: impressions,
                  clicks: clicks,
                  status: ad.effective_status
                };
                
                underperformingAds.push(adInfo);
                
                // Auto-pause if CTR is below threshold and ad is active
                if (ad.effective_status === 'ACTIVE') {
                  try {
                    await metaService.pauseAd(ad.id);
                    pausedAds.push({
                      ...adInfo,
                      pausedAt: new Date().toISOString(),
                      reason: `CTR ${ctr.toFixed(2)}% below threshold ${minCTR}%`
                    });
                  } catch (pauseError) {
                    console.error(`Failed to pause ad ${ad.id}:`, pauseError);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error checking adset ${adSetId}:`, error);
      }
    }

    res.json({
      success: true,
      underperformingAds,
      pausedAds,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in CTR check:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Multi-KPI Monitoring Check
router.post('/check-multi-kpi', async (req, res) => {
  try {
    const { campaignId, adSetIds, thresholds } = req.body;
    
    const underperformingAds = [];
    const pausedAds = [];

    // Get ads for each adset
    for (const adSetId of adSetIds) {
      try {
        const ads = await metaService.getAdSetAds(adSetId);
        
        for (const ad of ads) {
          // Get ad insights
          const insights = await metaService.getAdInsights(ad.id, 'today');
          
          if (insights && insights.length > 0) {
            const metrics = insights[0];
            const violations = [];
            let metricsSummary = [];
            
            // Check Cost Per Streak (if threshold set)
            if (thresholds.maxCostPerStreak && metrics.cost_per_action_type) {
              const streakActions = metrics.cost_per_action_type.find(a => a.action_type === 'mobile_app_install');
              if (streakActions) {
                const costPerStreak = parseFloat(streakActions.value);
                metricsSummary.push(`Cost/Streak: $${costPerStreak.toFixed(2)}`);
                if (costPerStreak > thresholds.maxCostPerStreak) {
                  violations.push(`High Cost/Streak: $${costPerStreak.toFixed(2)}`);
                }
              }
            }
            
            // Check Cost Per Purchase (if threshold set)
            if (thresholds.maxCostPerPurchase && metrics.cost_per_action_type) {
              const purchaseActions = metrics.cost_per_action_type.find(a => a.action_type === 'purchase');
              if (purchaseActions) {
                const costPerPurchase = parseFloat(purchaseActions.value);
                metricsSummary.push(`Cost/Purchase: $${costPerPurchase.toFixed(2)}`);
                if (costPerPurchase > thresholds.maxCostPerPurchase) {
                  violations.push(`High Cost/Purchase: $${costPerPurchase.toFixed(2)}`);
                }
              }
            }
            
            // Check ROAS (if threshold set)
            if (thresholds.minROAS && metrics.purchase_roas) {
              const roas = parseFloat(metrics.purchase_roas[0]?.value || 0);
              metricsSummary.push(`ROAS: ${roas.toFixed(2)}x`);
              if (roas < thresholds.minROAS) {
                violations.push(`Low ROAS: ${roas.toFixed(2)}x`);
              }
            }
            
            // If any violations, add to underperforming
            if (violations.length > 0) {
              const adInfo = {
                id: ad.id,
                name: ad.name,
                adSetId: adSetId,
                adSetName: ad.adset?.name || 'Unknown AdSet',
                violations: violations,
                metrics: metricsSummary.join(' | '),
                status: ad.effective_status
              };
              
              underperformingAds.push(adInfo);
              
              // Auto-pause if ad is active
              if (ad.effective_status === 'ACTIVE') {
                try {
                  await metaService.pauseAd(ad.id);
                  pausedAds.push({
                    ...adInfo,
                    pausedAt: new Date().toISOString(),
                    reason: violations.join(', ')
                  });
                } catch (pauseError) {
                  console.error(`Failed to pause ad ${ad.id}:`, pauseError);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error checking adset ${adSetId}:`, error);
      }
    }

    res.json({
      success: true,
      underperformingAds,
      pausedAds,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in Multi-KPI check:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get campaigns for monitoring selection
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await metaService.getActiveCampaigns();
    res.json({
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.effective_status
      })),
      count: campaigns.length
    });
  } catch (error) {
    console.error('Error getting campaigns for monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get adsets for specific campaign
router.get('/campaigns/:campaignId/adsets', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const adsets = await metaService.getCampaignAdSets(campaignId);
    res.json({
      campaignId,
      adsets: adsets.map(a => ({
        id: a.id,
        name: a.name,
        status: a.effective_status
      })),
      count: adsets.length
    });
  } catch (error) {
    console.error('Error getting adsets for campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function
function calculateCombinedScore(metaInsights, retentionData) {
  let score = 100;

  if (metaInsights) {
    if (metaInsights.ctr < 1.0) score -= 20;
    if (metaInsights.cpm > 10) score -= 15;
    if (metaInsights.cpa > 20) score -= 25;
  }

  if (retentionData) {
    if (retentionData.day1Retention < 0.3) score -= 30;
    if (retentionData.day3Retention < 0.15) score -= 20;
    if (retentionData.avgSessionCount < 2) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

module.exports = router;