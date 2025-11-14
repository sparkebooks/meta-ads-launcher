const express = require('express');
const kpiService = require('../services/kpiService');
const router = express.Router();

// Get KPI analysis for a specific ad
router.get('/ad/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const { timeframe = '7d' } = req.query;
    
    const analysis = await kpiService.getAdKPIAnalysis(adId, timeframe);
    res.json(analysis);
  } catch (error) {
    console.error('Error getting ad KPI analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all underperforming ads
router.get('/underperforming', async (req, res) => {
  try {
    const customThresholds = req.query.thresholds ? JSON.parse(req.query.thresholds) : {};
    const underperformingAds = await kpiService.getUnderperformingAds(customThresholds);
    
    res.json({
      underperformingAds,
      count: underperformingAds.length,
      thresholds: kpiService.getThresholds()
    });
  } catch (error) {
    console.error('Error getting underperforming ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ads near threshold (warning status)
router.get('/warning', async (req, res) => {
  try {
    const { warningMultiplier = 0.8 } = req.query;
    const customThresholds = req.query.thresholds ? JSON.parse(req.query.thresholds) : {};
    
    const warningAds = await kpiService.getAdsNearThreshold(
      parseFloat(warningMultiplier), 
      customThresholds
    );
    
    res.json({
      warningAds,
      count: warningAds.length,
      warningMultiplier: parseFloat(warningMultiplier)
    });
  } catch (error) {
    console.error('Error getting warning ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current KPI thresholds
router.get('/thresholds', (req, res) => {
  try {
    const thresholds = kpiService.getThresholds();
    res.json({ thresholds });
  } catch (error) {
    console.error('Error getting thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update KPI thresholds
router.post('/thresholds', (req, res) => {
  try {
    const newThresholds = req.body;
    
    // Validate threshold values
    const validatedThresholds = {};
    
    if (newThresholds.maxCostPerStreakActivation !== undefined) {
      const value = parseFloat(newThresholds.maxCostPerStreakActivation);
      if (!isNaN(value) && value > 0) {
        validatedThresholds.maxCostPerStreakActivation = value;
      }
    }
    
    if (newThresholds.maxCostPerPurchase !== undefined) {
      const value = parseFloat(newThresholds.maxCostPerPurchase);
      if (!isNaN(value) && value > 0) {
        validatedThresholds.maxCostPerPurchase = value;
      }
    }
    
    if (newThresholds.minROAS !== undefined) {
      const value = parseFloat(newThresholds.minROAS);
      if (!isNaN(value) && value > 0) {
        validatedThresholds.minROAS = value;
      }
    }
    
    if (newThresholds.minInstallsForAnalysis !== undefined) {
      const value = parseInt(newThresholds.minInstallsForAnalysis);
      if (!isNaN(value) && value > 0) {
        validatedThresholds.minInstallsForAnalysis = value;
      }
    }

    const updatedThresholds = kpiService.updateThresholds(validatedThresholds);
    
    res.json({
      message: 'Thresholds updated successfully',
      thresholds: updatedThresholds,
      updated: Object.keys(validatedThresholds)
    });
  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get KPI dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const [underperforming, warning] = await Promise.all([
      kpiService.getUnderperformingAds(),
      kpiService.getAdsNearThreshold()
    ]);

    // Calculate summary stats
    const totalUnderperforming = underperforming.length;
    const totalWarning = warning.length;
    
    // Get breakdown by reason
    const pauseReasons = {};
    underperforming.forEach(ad => {
      ad.pauseReasons.forEach(reason => {
        const key = reason.split(':')[0]; // Get reason type
        pauseReasons[key] = (pauseReasons[key] || 0) + 1;
      });
    });

    // Calculate total spend and revenue for underperforming ads
    const underperformingSpend = underperforming.reduce((sum, ad) => sum + ad.adSpend, 0);
    const underperformingRevenue = underperforming.reduce((sum, ad) => sum + ad.totalRevenue, 0);

    res.json({
      summary: {
        totalUnderperforming,
        totalWarning,
        underperformingSpend,
        underperformingRevenue,
        potentialSavings: underperformingSpend - underperformingRevenue
      },
      breakdown: {
        pauseReasons,
        underperformingAds: underperforming.slice(0, 10), // Top 10 worst
        warningAds: warning.slice(0, 10) // Top 10 at risk
      },
      thresholds: kpiService.getThresholds(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting KPI dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch pause underperforming ads
router.post('/pause-underperforming', async (req, res) => {
  try {
    const { customThresholds, dryRun = false } = req.body;
    
    const underperformingAds = await kpiService.getUnderperformingAds(customThresholds);
    
    if (dryRun) {
      return res.json({
        message: 'Dry run completed',
        wouldPause: underperformingAds.length,
        ads: underperformingAds.map(ad => ({
          adId: ad.adId,
          adName: ad.adName,
          reasons: ad.pauseReasons,
          costPerStreakActivation: ad.costPerStreakActivation,
          costPerPurchase: ad.costPerPurchase,
          roas: ad.roas
        }))
      });
    }

    // Actually pause the ads
    const metaService = require('../services/metaService');
    const supabaseService = require('../services/supabaseClient');
    
    const results = [];
    
    for (const ad of underperformingAds) {
      try {
        await metaService.pauseAd(ad.adId);
        
        // Log the pause action
        await supabaseService.logAdPauseAction(
          ad.adId, 
          ad.pauseReasons.join('; '), 
          {
            costPerStreakActivation: ad.costPerStreakActivation,
            costPerPurchase: ad.costPerPurchase,
            roas: ad.roas,
            adSpend: ad.adSpend,
            pausedAt: new Date().toISOString(),
            automated: true,
            kpiTriggered: true
          }
        );
        
        results.push({
          adId: ad.adId,
          adName: ad.adName,
          status: 'paused',
          reasons: ad.pauseReasons
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({
          adId: ad.adId,
          adName: ad.adName,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      message: 'Batch pause completed',
      totalProcessed: underperformingAds.length,
      successful: results.filter(r => r.status === 'paused').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    });

  } catch (error) {
    console.error('Error pausing underperforming ads:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;