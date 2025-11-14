const supabaseService = require('./supabaseClient');
const metaService = require('./metaService');

class KPIService {
  constructor() {
    this.defaultThresholds = {
      maxCostPerStreakActivation: 10.0, // $10 max
      maxCostPerPurchase: 25.0, // $25 max
      minROAS: 1.5, // 1.5x minimum return
      
      // Minimum data requirements
      minInstallsForAnalysis: 10,
      minDaysForAnalysis: 3
    };
  }

  // Get comprehensive KPI analysis for an ad
  async getAdKPIAnalysis(adId, timeframe = '7d') {
    try {
      // Get app analytics data
      const appMetrics = await supabaseService.getKPIMetricsByAdId(adId, timeframe);
      
      // Get Meta ad spend data
      const metaInsights = await metaService.getAdInsights(adId, 'last_7_days');
      const adSpend = metaInsights ? parseFloat(metaInsights.spend) || 0 : 0;

      // Calculate cost per key events
      const costPerStreakActivation = appMetrics.streakActivations > 0 
        ? adSpend / appMetrics.streakActivations 
        : Infinity;

      const costPerPurchase = appMetrics.purchases > 0 
        ? adSpend / appMetrics.purchases 
        : Infinity;

      const roas = adSpend > 0 
        ? appMetrics.totalRevenue / adSpend 
        : 0;

      // Determine if ad should be paused
      const shouldPause = this.shouldPauseAd({
        costPerStreakActivation,
        costPerPurchase,
        roas,
        totalUsers: appMetrics.totalUsers,
        adSpend
      });

      return {
        adId,
        timeframe,
        
        // Spend data
        adSpend,
        
        // App metrics
        totalUsers: appMetrics.totalUsers,
        streakActivations: appMetrics.streakActivations,
        streakActivationRate: appMetrics.streakActivationRate,
        purchases: appMetrics.purchases,
        purchaseRate: appMetrics.purchaseRate,
        totalRevenue: appMetrics.totalRevenue,
        
        // Cost metrics (key for decision making)
        costPerStreakActivation,
        costPerPurchase,
        roas,
        
        // Meta metrics
        impressions: metaInsights?.impressions || 0,
        clicks: metaInsights?.clicks || 0,
        ctr: metaInsights?.ctr || 0,
        cpm: metaInsights?.cpm || 0,
        cpc: metaInsights?.cpc || 0,
        
        // Decision metrics
        shouldPause,
        pauseReasons: shouldPause ? this.getPauseReasons({
          costPerStreakActivation,
          costPerPurchase, 
          roas,
          totalUsers: appMetrics.totalUsers
        }) : [],
        
        // Performance scoring
        performanceScore: this.calculatePerformanceScore({
          costPerStreakActivation,
          costPerPurchase,
          roas,
          streakActivationRate: appMetrics.streakActivationRate,
          purchaseRate: appMetrics.purchaseRate
        })
      };
    } catch (error) {
      console.error(`Error getting KPI analysis for ad ${adId}:`, error);
      return {
        adId,
        error: error.message,
        shouldPause: false,
        pauseReasons: []
      };
    }
  }

  // Check if ad should be paused based on KPI thresholds
  shouldPauseAd(metrics, customThresholds = {}) {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };
    
    // Need minimum data for reliable analysis
    if (metrics.totalUsers < thresholds.minInstallsForAnalysis) {
      return false; // Not enough data yet
    }

    // Check each threshold
    if (metrics.costPerStreakActivation > thresholds.maxCostPerStreakActivation) {
      return true;
    }

    if (metrics.costPerPurchase > thresholds.maxCostPerPurchase) {
      return true;
    }

    if (metrics.roas < thresholds.minROAS && metrics.adSpend > 50) {
      return true; // Only check ROAS if significant spend
    }

    return false;
  }

  // Get reasons why ad should be paused
  getPauseReasons(metrics, customThresholds = {}) {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };
    const reasons = [];

    if (metrics.costPerStreakActivation > thresholds.maxCostPerStreakActivation) {
      reasons.push(`High cost per streak activation: $${metrics.costPerStreakActivation.toFixed(2)} > $${thresholds.maxCostPerStreakActivation}`);
    }

    if (metrics.costPerPurchase > thresholds.maxCostPerPurchase) {
      reasons.push(`High cost per purchase: $${metrics.costPerPurchase.toFixed(2)} > $${thresholds.maxCostPerPurchase}`);
    }

    if (metrics.roas < thresholds.minROAS) {
      reasons.push(`Low ROAS: ${metrics.roas.toFixed(2)}x < ${thresholds.minROAS}x`);
    }

    return reasons;
  }

  // Calculate overall performance score (0-100)
  calculatePerformanceScore(metrics) {
    let score = 100;

    // Penalize high costs
    if (metrics.costPerStreakActivation > this.defaultThresholds.maxCostPerStreakActivation) {
      score -= 30;
    } else if (metrics.costPerStreakActivation > this.defaultThresholds.maxCostPerStreakActivation * 0.8) {
      score -= 15;
    }

    if (metrics.costPerPurchase > this.defaultThresholds.maxCostPerPurchase) {
      score -= 25;
    } else if (metrics.costPerPurchase > this.defaultThresholds.maxCostPerPurchase * 0.8) {
      score -= 10;
    }

    // Penalize low ROAS
    if (metrics.roas < this.defaultThresholds.minROAS) {
      score -= 25;
    } else if (metrics.roas < this.defaultThresholds.minROAS * 1.2) {
      score -= 10;
    }

    // Reward good conversion rates
    if (metrics.streakActivationRate > 0.4) {
      score += 10;
    }
    
    if (metrics.purchaseRate > 0.1) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Get all underperforming ads across all campaigns
  async getUnderperformingAds(customThresholds = {}) {
    try {
      // Get all active ads from Meta
      const campaigns = await metaService.getActiveCampaigns();
      const allAds = [];
      
      for (const campaign of campaigns) {
        const campaignAds = await metaService.getCampaignAds(campaign.id);
        allAds.push(...campaignAds.map(ad => ({ ...ad, campaignId: campaign.id, campaignName: campaign.name })));
      }

      const underperformingAds = [];

      // Analyze each ad
      for (const ad of allAds) {
        if (ad.effective_status !== 'ACTIVE') continue; // Skip paused ads
        
        const analysis = await this.getAdKPIAnalysis(ad.id);
        
        if (analysis.shouldPause) {
          underperformingAds.push({
            ...analysis,
            adName: ad.name,
            campaignId: ad.campaignId,
            campaignName: ad.campaignName,
            adStatus: ad.effective_status,
            createdTime: ad.created_time
          });
        }
      }

      return underperformingAds;
    } catch (error) {
      console.error('Error getting underperforming ads:', error);
      return [];
    }
  }

  // Get ads that are close to being paused (warning threshold)
  async getAdsNearThreshold(warningMultiplier = 0.8, customThresholds = {}) {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };
    const warningThresholds = {
      maxCostPerStreakActivation: thresholds.maxCostPerStreakActivation * warningMultiplier,
      maxCostPerPurchase: thresholds.maxCostPerPurchase * warningMultiplier,
      minROAS: thresholds.minROAS / warningMultiplier
    };

    try {
      const campaigns = await metaService.getActiveCampaigns();
      const allAds = [];
      
      for (const campaign of campaigns) {
        const campaignAds = await metaService.getCampaignAds(campaign.id);
        allAds.push(...campaignAds.map(ad => ({ ...ad, campaignId: campaign.id, campaignName: campaign.name })));
      }

      const warningAds = [];

      for (const ad of allAds) {
        if (ad.effective_status !== 'ACTIVE') continue;
        
        const analysis = await this.getAdKPIAnalysis(ad.id);
        
        // Check if close to thresholds but not yet failing
        const nearThreshold = !analysis.shouldPause && (
          analysis.costPerStreakActivation > warningThresholds.maxCostPerStreakActivation ||
          analysis.costPerPurchase > warningThresholds.maxCostPerPurchase ||
          (analysis.roas < warningThresholds.minROAS && analysis.adSpend > 25)
        );

        if (nearThreshold) {
          warningAds.push({
            ...analysis,
            adName: ad.name,
            campaignId: ad.campaignId,
            campaignName: ad.campaignName,
            warningReasons: this.getWarningReasons(analysis, warningThresholds)
          });
        }
      }

      return warningAds;
    } catch (error) {
      console.error('Error getting ads near threshold:', error);
      return [];
    }
  }

  // Get warning reasons for ads near threshold
  getWarningReasons(metrics, warningThresholds) {
    const reasons = [];

    if (metrics.costPerStreakActivation > warningThresholds.maxCostPerStreakActivation) {
      reasons.push(`Approaching streak activation cost limit: $${metrics.costPerStreakActivation.toFixed(2)}`);
    }

    if (metrics.costPerPurchase > warningThresholds.maxCostPerPurchase) {
      reasons.push(`Approaching purchase cost limit: $${metrics.costPerPurchase.toFixed(2)}`);
    }

    if (metrics.roas < warningThresholds.minROAS) {
      reasons.push(`ROAS below warning threshold: ${metrics.roas.toFixed(2)}x`);
    }

    return reasons;
  }

  // Update thresholds
  updateThresholds(newThresholds) {
    this.defaultThresholds = { ...this.defaultThresholds, ...newThresholds };
    return this.defaultThresholds;
  }

  // Get current thresholds
  getThresholds() {
    return { ...this.defaultThresholds };
  }
}

module.exports = new KPIService();