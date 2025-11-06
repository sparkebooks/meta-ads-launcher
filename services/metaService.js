const { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad } = require('facebook-nodejs-business-sdk');

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

class MetaService {
  async getCampaignInsights(campaignId, dateRange = 'last_7_days') {
    try {
      const campaign = new Campaign(campaignId);
      
      const insights = await campaign.getInsights([
        'impressions',
        'clicks',
        'ctr',
        'cpm',
        'cpc',
        'spend',
        'actions',
        'cost_per_action_type',
        'unique_clicks',
        'reach',
        'frequency'
      ], {
        date_preset: dateRange,
        level: 'ad',
        breakdowns: ['ad_id']
      });

      return insights.map(insight => ({
        ad_id: insight.ad_id,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        cpc: parseFloat(insight.cpc) || 0,
        spend: parseFloat(insight.spend) || 0,
        reach: parseInt(insight.reach) || 0,
        frequency: parseFloat(insight.frequency) || 0,
        actions: this.parseActions(insight.actions),
        cpa: this.calculateCPA(insight)
      }));

    } catch (error) {
      console.error(`Error getting campaign insights for ${campaignId}:`, error);
      return [];
    }
  }

  async getAdInsights(adId, dateRange = 'last_7_days') {
    try {
      const ad = new Ad(adId);
      
      const insights = await ad.getInsights([
        'impressions',
        'clicks',
        'ctr',
        'cpm',
        'cpc',
        'spend',
        'actions',
        'cost_per_action_type',
        'unique_clicks',
        'reach',
        'frequency',
        'conversion_rate_ranking',
        'quality_ranking',
        'engagement_rate_ranking'
      ], {
        date_preset: dateRange
      });

      if (insights.length === 0) return null;

      const insight = insights[0];
      return {
        ad_id: adId,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        cpc: parseFloat(insight.cpc) || 0,
        spend: parseFloat(insight.spend) || 0,
        reach: parseInt(insight.reach) || 0,
        frequency: parseFloat(insight.frequency) || 0,
        actions: this.parseActions(insight.actions),
        cpa: this.calculateCPA(insight),
        qualityRanking: insight.quality_ranking,
        engagementRanking: insight.engagement_rate_ranking,
        conversionRanking: insight.conversion_rate_ranking
      };

    } catch (error) {
      console.error(`Error getting ad insights for ${adId}:`, error);
      return null;
    }
  }

  async pauseAd(adId) {
    try {
      const ad = new Ad(adId);
      await ad.update([], { status: 'PAUSED' });
      console.log(`✅ Successfully paused ad ${adId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to pause ad ${adId}:`, error);
      throw error;
    }
  }

  async pauseAdSet(adSetId) {
    try {
      const adSet = new AdSet(adSetId);
      await adSet.update([], { status: 'PAUSED' });
      console.log(`✅ Successfully paused ad set ${adSetId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to pause ad set ${adSetId}:`, error);
      throw error;
    }
  }

  async pauseCampaign(campaignId) {
    try {
      const campaign = new Campaign(campaignId);
      await campaign.update([], { status: 'PAUSED' });
      console.log(`✅ Successfully paused campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to pause campaign ${campaignId}:`, error);
      throw error;
    }
  }

  async activateAd(adId) {
    try {
      const ad = new Ad(adId);
      await ad.update([], { status: 'ACTIVE' });
      console.log(`✅ Successfully activated ad ${adId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to activate ad ${adId}:`, error);
      throw error;
    }
  }

  async getActiveCampaigns() {
    try {
      const campaigns = await account.getCampaigns([
        'name',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
        'daily_budget',
        'lifetime_budget',
        'objective'
      ], {
        effective_status: ['ACTIVE', 'PAUSED'],
        limit: 100
      });

      return campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effective_status: campaign.effective_status || campaign.status,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time,
        daily_budget: campaign.daily_budget,
        lifetime_budget: campaign.lifetime_budget,
        objective: campaign.objective
      }));

    } catch (error) {
      console.error('Error getting active campaigns:', error);
      return [];
    }
  }

  async getCampaignAdSets(campaignId) {
    try {
      const campaign = new Campaign(campaignId);
      const adsets = await campaign.getAdSets([
        'name',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
        'daily_budget',
        'lifetime_budget'
      ]);

      return adsets.map(adset => ({
        id: adset.id,
        name: adset.name,
        status: adset.status,
        effective_status: adset.effective_status,
        created_time: adset.created_time,
        updated_time: adset.updated_time,
        daily_budget: adset.daily_budget,
        lifetime_budget: adset.lifetime_budget
      }));

    } catch (error) {
      console.error(`Error getting adsets for campaign ${campaignId}:`, error);
      return [];
    }
  }

  async getCampaignAds(campaignId) {
    try {
      const campaign = new Campaign(campaignId);
      const ads = await campaign.getAds([
        'name',
        'status',
        'effective_status',
        'created_time',
        'updated_time',
        'adset_id'
      ]);

      return ads.map(ad => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        created_time: ad.created_time,
        updated_time: ad.updated_time,
        adset_id: ad.adset_id
      }));

    } catch (error) {
      console.error(`Error getting ads for campaign ${campaignId}:`, error);
      return [];
    }
  }

  async getAdSetAds(adsetId) {
    try {
      const adset = new AdSet(adsetId);
      const ads = await adset.getAds([
        'name',
        'status',
        'effective_status',
        'created_time',
        'updated_time'
      ]);

      return ads.map(ad => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        created_time: ad.created_time,
        updated_time: ad.updated_time
      }));

    } catch (error) {
      console.error(`Error getting ads for adset ${adsetId}:`, error);
      return [];
    }
  }

  async getAdSetPerformance(adSetId, dateRange = 'last_7_days') {
    try {
      const adSet = new AdSet(adSetId);
      
      const insights = await adSet.getInsights([
        'impressions',
        'clicks',
        'ctr',
        'cpm',
        'cpc',
        'spend',
        'actions',
        'cost_per_action_type'
      ], {
        date_preset: dateRange
      });

      if (insights.length === 0) return null;

      const insight = insights[0];
      return {
        adset_id: adSetId,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        cpm: parseFloat(insight.cpm) || 0,
        cpc: parseFloat(insight.cpc) || 0,
        spend: parseFloat(insight.spend) || 0,
        actions: this.parseActions(insight.actions),
        cpa: this.calculateCPA(insight)
      };

    } catch (error) {
      console.error(`Error getting ad set insights for ${adSetId}:`, error);
      return null;
    }
  }

  // Helper methods
  parseActions(actions) {
    if (!actions) return {};

    const actionTypes = {};
    actions.forEach(action => {
      actionTypes[action.action_type] = {
        value: parseInt(action.value) || 0,
        '1d_click': parseInt(action['1d_click']) || 0,
        '7d_click': parseInt(action['7d_click']) || 0,
        '1d_view': parseInt(action['1d_view']) || 0,
        '7d_view': parseInt(action['7d_view']) || 0
      };
    });

    return actionTypes;
  }

  calculateCPA(insight) {
    const spend = parseFloat(insight.spend) || 0;
    const actions = insight.actions;
    
    if (!actions || spend === 0) return 0;

    // Look for mobile app install actions
    const installs = actions.find(a => 
      a.action_type === 'mobile_app_install' || 
      a.action_type === 'app_install'
    );

    if (!installs || !installs.value) return 0;

    return spend / parseInt(installs.value);
  }

  async batchPauseAds(adIds, reason = 'Performance threshold not met') {
    const results = [];
    
    for (const adId of adIds) {
      try {
        await this.pauseAd(adId);
        results.push({
          adId,
          status: 'success',
          action: 'paused',
          reason
        });
        
        // Rate limiting - wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({
          adId,
          status: 'error',
          error: error.message,
          reason
        });
      }
    }

    return results;
  }

  async validateApiConnection() {
    try {
      await account.read(['account_id', 'name', 'account_status']);
      return {
        connected: true,
        accountId: process.env.META_AD_ACCOUNT_ID,
        message: 'Successfully connected to Meta Ads API'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        message: 'Failed to connect to Meta Ads API'
      };
    }
  }

  async getAdDetails(adId) {
    try {
      const ad = new Ad(adId);
      const details = await ad.read([
        'id',
        'name',
        'status',
        'effective_status',
        'creative',
        'adset_id',
        'campaign_id'
      ]);
      
      return details;
    } catch (error) {
      console.error('Error getting ad details:', error);
      throw error;
    }
  }

  async createAd(adData) {
    const maxRetries = 3;
    const timeout = 30000; // 30 seconds per attempt

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔨 Creating Meta ad (attempt ${attempt}/${maxRetries}):`, adData.name);

        const adParams = {
          name: adData.name,
          adset_id: adData.adset_id,
          creative: adData.creative,
          status: adData.status || 'PAUSED'
        };

        // Wrap SDK call in a timeout promise
        const createAdWithTimeout = () => {
          return Promise.race([
            account.createAd([], adParams),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Ad creation timeout after 30s')), timeout)
            )
          ]);
        };

        // Use account to create ad directly with timeout
        const ad = await createAdWithTimeout();
        console.log('✅ SDK returned ad ID:', ad.id);

        // CRITICAL: Verify the ad actually exists in Meta
        // The SDK sometimes returns success even if the ad wasn't created
        try {
          const verification = new Ad(ad.id);
          await verification.read(['id', 'name', 'status']);
          console.log('✅ Verified ad exists in Meta:', ad.id);
          return ad;
        } catch (verifyError) {
          console.error('❌ Ad creation reported success but ad does NOT exist in Meta!');
          console.error('   Attempted ad ID:', ad.id);
          console.error('   Verification error:', verifyError.message);
          throw new Error(`Ad creation failed verification: ${verifyError.message}`);
        }

      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts exhausted for ad:', adData.name);
          throw error;
        }

        // Otherwise, wait before retrying (exponential backoff)
        const waitTime = 2000 * attempt; // 2s, 4s, 6s
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

module.exports = new MetaService();