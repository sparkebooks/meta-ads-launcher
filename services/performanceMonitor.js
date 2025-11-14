const cron = require('node-cron');
const supabaseService = require('./supabaseClient');
const metaService = require('./metaService');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = process.env.PERFORMANCE_CHECK_INTERVAL_HOURS || 2;
    this.thresholds = {
      minDay1Retention: parseFloat(process.env.MIN_D1_RETENTION) || 0.30,
      minDay3Retention: parseFloat(process.env.MIN_D3_RETENTION) || 0.15,
      minDay7Retention: parseFloat(process.env.MIN_D7_RETENTION) || 0.08,
      minSessionCount: parseFloat(process.env.MIN_SESSION_COUNT) || 2,
      minTimeSpent: parseFloat(process.env.MIN_TIME_SPENT) || 300, // 5 minutes
      minInstalls: parseInt(process.env.MIN_INSTALLS) || 10,
      minCTR: parseFloat(process.env.MIN_CTR_THRESHOLD) || 0.8,
      maxCPM: parseFloat(process.env.MIN_CPM_THRESHOLD) || 15.0,
      minROAS: parseFloat(process.env.MIN_ROAS_THRESHOLD) || 1.5,
      maxCPA: parseFloat(process.env.MAX_CPA_THRESHOLD) || 25.0
    };
  }

  start() {
    if (this.isRunning) {
      console.log('Performance monitor is already running');
      return;
    }

    console.log(`🔍 Starting performance monitor - checking every ${this.checkInterval} hours`);
    
    // Schedule the monitoring job
    const cronExpression = `0 */${this.checkInterval} * * *`; // Every X hours
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.runPerformanceCheck();
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    // Run an initial check
    setTimeout(() => {
      this.runPerformanceCheck();
    }, 5000); // Wait 5 seconds after startup

    this.isRunning = true;
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('📴 Performance monitor stopped');
  }

  async runPerformanceCheck() {
    console.log(`🔍 Running performance check at ${new Date().toISOString()}`);
    
    try {
      // Get all active campaigns and ads
      const activeCampaigns = await this.getActiveCampaigns();
      console.log(`Found ${activeCampaigns.length} active campaigns to monitor`);

      if (activeCampaigns.length === 0) {
        console.log('No active campaigns found, skipping check');
        return;
      }

      // Check each campaign's performance
      for (const campaign of activeCampaigns) {
        await this.checkCampaignPerformance(campaign);
      }

      // Log the check completion
      await this.logPerformanceCheck();

    } catch (error) {
      console.error('Error during performance check:', error);
      await this.logError('performance_check_failed', error);
    }
  }

  async checkCampaignPerformance(campaign) {
    try {
      console.log(`📊 Checking campaign: ${campaign.name} (${campaign.id})`);

      // Get ad performance from Meta API
      const metaPerformance = await metaService.getCampaignInsights(campaign.id);
      
      // Get retention data from Supabase
      const adIds = campaign.ads.map(ad => ad.id);
      const retentionData = await supabaseService.getAdPerformanceMetrics(adIds);

      // Combine and analyze performance
      const underperformingAds = await this.analyzeAdPerformance(
        campaign.ads,
        metaPerformance,
        retentionData
      );

      if (underperformingAds.length > 0) {
        console.log(`⚠️  Found ${underperformingAds.length} underperforming ads in campaign ${campaign.name}`);
        await this.handleUnderperformingAds(underperformingAds);
      } else {
        console.log(`✅ All ads in campaign ${campaign.name} are performing well`);
      }

    } catch (error) {
      console.error(`Error checking campaign ${campaign.name}:`, error);
    }
  }

  async analyzeAdPerformance(ads, metaPerformance, retentionData) {
    const underperforming = [];

    for (const ad of ads) {
      const metaMetrics = metaPerformance.find(m => m.ad_id === ad.id) || {};
      const retentionMetrics = retentionData.find(r => r.adId === ad.id) || {};

      const reasons = [];

      // Check Meta performance metrics
      if (metaMetrics.ctr && metaMetrics.ctr < this.thresholds.minCTR) {
        reasons.push(`Low CTR: ${metaMetrics.ctr}% < ${this.thresholds.minCTR}%`);
      }

      if (metaMetrics.cpm && metaMetrics.cpm > this.thresholds.maxCPM) {
        reasons.push(`High CPM: $${metaMetrics.cpm} > $${this.thresholds.maxCPM}`);
      }

      if (metaMetrics.cpa && metaMetrics.cpa > this.thresholds.maxCPA) {
        reasons.push(`High CPA: $${metaMetrics.cpa} > $${this.thresholds.maxCPA}`);
      }

      // Check retention metrics
      if (retentionMetrics.day1Retention !== undefined && retentionMetrics.day1Retention < this.thresholds.minDay1Retention) {
        reasons.push(`Low D1 retention: ${(retentionMetrics.day1Retention * 100).toFixed(1)}% < ${(this.thresholds.minDay1Retention * 100).toFixed(1)}%`);
      }

      if (retentionMetrics.day3Retention !== undefined && retentionMetrics.day3Retention < this.thresholds.minDay3Retention) {
        reasons.push(`Low D3 retention: ${(retentionMetrics.day3Retention * 100).toFixed(1)}% < ${(this.thresholds.minDay3Retention * 100).toFixed(1)}%`);
      }

      if (retentionMetrics.avgSessionCount !== undefined && retentionMetrics.avgSessionCount < this.thresholds.minSessionCount) {
        reasons.push(`Low session count: ${retentionMetrics.avgSessionCount.toFixed(1)} < ${this.thresholds.minSessionCount}`);
      }

      if (retentionMetrics.totalUsers !== undefined && retentionMetrics.totalUsers < this.thresholds.minInstalls) {
        reasons.push(`Insufficient installs: ${retentionMetrics.totalUsers} < ${this.thresholds.minInstalls}`);
      }

      // If there are performance issues, mark for pause
      if (reasons.length > 0) {
        underperforming.push({
          ad: ad,
          metaMetrics: metaMetrics,
          retentionMetrics: retentionMetrics,
          reasons: reasons,
          score: this.calculatePerformanceScore(metaMetrics, retentionMetrics)
        });
      }
    }

    return underperforming;
  }

  async handleUnderperformingAds(underperformingAds) {
    const pauseResults = [];

    for (const adData of underperformingAds) {
      try {
        const { ad, reasons, metaMetrics, retentionMetrics } = adData;

        console.log(`⏸️  Pausing ad: ${ad.name} (${ad.id})`);
        console.log(`   Reasons: ${reasons.join(', ')}`);

        // Pause the ad via Meta API
        await metaService.pauseAd(ad.id);

        // Log the pause action in Supabase
        await supabaseService.logAdPauseAction(ad.id, reasons.join('; '), {
          metaMetrics,
          retentionMetrics,
          pausedAt: new Date().toISOString()
        });

        pauseResults.push({
          adId: ad.id,
          adName: ad.name,
          status: 'paused',
          reasons: reasons
        });

        // Wait a bit between API calls to avoid rate limiting
        await this.sleep(1000);

      } catch (error) {
        console.error(`Failed to pause ad ${adData.ad.id}:`, error);
        pauseResults.push({
          adId: adData.ad.id,
          adName: adData.ad.name,
          status: 'error',
          error: error.message
        });
      }
    }

    // Send notification about paused ads
    await this.sendPauseNotification(pauseResults);

    return pauseResults;
  }

  calculatePerformanceScore(metaMetrics, retentionMetrics) {
    let score = 100;

    // Deduct points for poor Meta performance
    if (metaMetrics.ctr < this.thresholds.minCTR) {
      score -= 20;
    }
    if (metaMetrics.cpm > this.thresholds.maxCPM) {
      score -= 15;
    }
    if (metaMetrics.cpa > this.thresholds.maxCPA) {
      score -= 25;
    }

    // Deduct points for poor retention
    if (retentionMetrics.day1Retention < this.thresholds.minDay1Retention) {
      score -= 30;
    }
    if (retentionMetrics.day3Retention < this.thresholds.minDay3Retention) {
      score -= 20;
    }
    if (retentionMetrics.avgSessionCount < this.thresholds.minSessionCount) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  async getActiveCampaigns() {
    try {
      // Read from campaigns log file
      const campaignLogPath = path.join(__dirname, '..', 'data', 'campaigns.json');
      const data = await fs.readFile(campaignLogPath, 'utf8');
      const campaigns = JSON.parse(data);

      // Filter for active campaigns from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return campaigns
        .filter(c => new Date(c.createdAt) > thirtyDaysAgo)
        .map(c => ({
          id: c.campaignId,
          name: c.campaignName || `Campaign_${c.campaignId}`,
          ads: c.ads || []
        }));

    } catch (error) {
      console.error('Error getting active campaigns:', error);
      return [];
    }
  }

  async logPerformanceCheck() {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'performance_check_completed',
      thresholds: this.thresholds
    };

    await this.writeToLog(logEntry);
  }

  async logError(type, error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: type,
      error: error.message,
      stack: error.stack
    };

    await this.writeToLog(logEntry);
  }

  async writeToLog(entry) {
    try {
      const logPath = path.join(__dirname, '..', 'logs', 'performance_monitor.log');
      const logDir = path.dirname(logPath);

      // Ensure logs directory exists
      try {
        await fs.access(logDir);
      } catch {
        await fs.mkdir(logDir, { recursive: true });
      }

      await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Error writing to log:', error);
    }
  }

  async sendPauseNotification(pauseResults) {
    // This could be expanded to send emails, Slack notifications, etc.
    console.log(`📧 Notification: ${pauseResults.length} ads were automatically paused`);
    
    const summary = pauseResults.map(result => 
      `${result.status === 'paused' ? '✅' : '❌'} ${result.adName}: ${result.reasons?.join(', ') || result.error}`
    ).join('\n');

    console.log('Pause Summary:\n' + summary);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger for testing
  async triggerCheck() {
    console.log('🔍 Manual performance check triggered');
    await this.runPerformanceCheck();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      thresholds: this.thresholds,
      nextCheck: this.cronJob ? 'Running' : 'Stopped'
    };
  }
}

module.exports = new PerformanceMonitor();