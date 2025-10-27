const express = require('express');
const metaService = require('../services/metaService');
const { FacebookAdsApi, Ad, AdSet, AdCreative, Campaign } = require('facebook-nodejs-business-sdk');
const router = express.Router();

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);

// Duplicate an existing ad with new copy and URL
router.post('/duplicate-ad', async (req, res) => {
  try {
    const {
      sourceAdId,
      newAdCopy, // { primaryText, headline, description, callToAction }
      newLandingUrl,
      newUrlParameters = {},
      newAdName,
      quantity = 1,
      adCopyVariations = [] // Array of different copy variations
    } = req.body;

    if (!sourceAdId) {
      return res.status(400).json({ error: 'sourceAdId is required' });
    }

    // Get the source ad configuration
    const sourceAdConfig = await getCompleteAdConfiguration(sourceAdId);
    
    const duplicatedAds = [];
    const errors = [];

    // Handle multiple variations
    const variations = adCopyVariations.length > 0 ? adCopyVariations : [newAdCopy];

    for (let i = 0; i < variations.length; i++) {
      const variation = variations[i];
      
      try {
        // Create new ad creative with updated copy and URL
        const newCreative = await createUpdatedAdCreative(
          sourceAdConfig.creative,
          variation,
          newLandingUrl,
          newUrlParameters
        );

        // Create new ad with the same settings but new creative
        const newAd = await createDuplicateAd(
          sourceAdConfig.ad,
          newCreative.id,
          newAdName ? `${newAdName}_v${i + 1}` : `${sourceAdConfig.ad.name}_duplicate_v${i + 1}`
        );

        duplicatedAds.push({
          adId: newAd.id,
          adName: newAd.name,
          creativeId: newCreative.id,
          variation: variation,
          landingUrl: buildLandingUrl(newLandingUrl, newUrlParameters),
          status: 'created'
        });

        // Rate limiting
        await sleep(500);

      } catch (error) {
        console.error(`Error duplicating ad variation ${i + 1}:`, error);
        errors.push({
          variation: i + 1,
          error: error.message,
          adCopy: variation
        });
      }
    }

    res.json({
      message: 'Ad duplication completed',
      sourceAdId,
      duplicatedAds,
      totalCreated: duplicatedAds.length,
      errors,
      summary: {
        successful: duplicatedAds.length,
        failed: errors.length,
        total: variations.length
      }
    });

  } catch (error) {
    console.error('Error in ad duplication:', error);
    res.status(500).json({ error: error.message });
  }
});

// Duplicate an entire adset with new copy variations
router.post('/duplicate-adset', async (req, res) => {
  try {
    const {
      sourceAdSetId,
      newAdSetName,
      adCopyVariations = [], // Array of copy variations for all ads in the adset
      newLandingUrl,
      newUrlParameters = {},
      budgetAdjustment, // Optional: { daily_budget: 1000 } in cents
      targetingAdjustment // Optional: targeting modifications
    } = req.body;

    if (!sourceAdSetId) {
      return res.status(400).json({ error: 'sourceAdSetId is required' });
    }

    // Get source adset configuration
    const sourceAdSetConfig = await getCompleteAdSetConfiguration(sourceAdSetId);
    
    // Create new adset with same settings
    const newAdSet = await createDuplicateAdSet(
      sourceAdSetConfig.adset,
      newAdSetName || `${sourceAdSetConfig.adset.name}_duplicate`,
      budgetAdjustment,
      targetingAdjustment
    );

    const duplicatedAds = [];
    const errors = [];

    // Duplicate all ads in the adset
    for (const sourceAd of sourceAdSetConfig.ads) {
      for (let i = 0; i < adCopyVariations.length; i++) {
        const variation = adCopyVariations[i];
        
        try {
          // Get source ad's creative config
          const sourceAdConfig = await getCompleteAdConfiguration(sourceAd.id);
          
          // Create new creative with updated copy
          const newCreative = await createUpdatedAdCreative(
            sourceAdConfig.creative,
            variation,
            newLandingUrl,
            newUrlParameters
          );

          // Create new ad in the new adset
          const newAd = await createDuplicateAdInAdSet(
            sourceAdConfig.ad,
            newAdSet.id,
            newCreative.id,
            `${sourceAd.name}_${variation.variation || i + 1}`
          );

          duplicatedAds.push({
            adId: newAd.id,
            adName: newAd.name,
            sourceAdId: sourceAd.id,
            creativeId: newCreative.id,
            variation: variation
          });

          await sleep(500);

        } catch (error) {
          console.error(`Error duplicating ad ${sourceAd.id} with variation ${i + 1}:`, error);
          errors.push({
            sourceAdId: sourceAd.id,
            variation: i + 1,
            error: error.message
          });
        }
      }
    }

    res.json({
      message: 'AdSet duplication completed',
      sourceAdSetId,
      newAdSetId: newAdSet.id,
      newAdSetName: newAdSet.name,
      duplicatedAds,
      totalAdsCreated: duplicatedAds.length,
      errors,
      summary: {
        sourceAdsCount: sourceAdSetConfig.ads.length,
        variationsCount: adCopyVariations.length,
        expectedAds: sourceAdSetConfig.ads.length * adCopyVariations.length,
        actualAdsCreated: duplicatedAds.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('Error in adset duplication:', error);
    res.status(500).json({ error: error.message });
  }
});

// Duplicate ads into an existing campaign
router.post('/duplicate-to-campaign', async (req, res) => {
  try {
    const {
      targetCampaignId,
      sourceAdIds = [], // Array of ad IDs to duplicate
      adCopyVariations = [],
      newLandingUrl,
      newUrlParameters = {},
      adSetNamePrefix = 'Duplicated'
    } = req.body;

    if (!targetCampaignId || sourceAdIds.length === 0) {
      return res.status(400).json({ 
        error: 'targetCampaignId and sourceAdIds are required' 
      });
    }

    const results = [];
    const errors = [];

    for (const sourceAdId of sourceAdIds) {
      try {
        // Get source ad configuration
        const sourceAdConfig = await getCompleteAdConfiguration(sourceAdId);
        
        // Create new adset in target campaign
        const newAdSet = await createDuplicateAdSetInCampaign(
          sourceAdConfig.adset,
          targetCampaignId,
          `${adSetNamePrefix}_${sourceAdConfig.adset.name}`
        );

        const adsInThisAdSet = [];

        // Create ads with variations
        for (const variation of adCopyVariations) {
          try {
            const newCreative = await createUpdatedAdCreative(
              sourceAdConfig.creative,
              variation,
              newLandingUrl,
              newUrlParameters
            );

            const newAd = await createDuplicateAdInAdSet(
              sourceAdConfig.ad,
              newAdSet.id,
              newCreative.id,
              `${sourceAdConfig.ad.name}_${variation.variation || 'v1'}`
            );

            adsInThisAdSet.push({
              adId: newAd.id,
              adName: newAd.name,
              creativeId: newCreative.id,
              variation: variation
            });

            await sleep(500);

          } catch (error) {
            errors.push({
              sourceAdId,
              variation,
              error: error.message
            });
          }
        }

        results.push({
          sourceAdId,
          newAdSetId: newAdSet.id,
          newAdSetName: newAdSet.name,
          ads: adsInThisAdSet
        });

      } catch (error) {
        console.error(`Error processing source ad ${sourceAdId}:`, error);
        errors.push({
          sourceAdId,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Campaign duplication completed',
      targetCampaignId,
      results,
      totalAdSetsCreated: results.length,
      totalAdsCreated: results.reduce((sum, r) => sum + r.ads.length, 0),
      errors
    });

  } catch (error) {
    console.error('Error in campaign duplication:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get duplication preview (shows what will be duplicated)
router.get('/preview/:sourceAdId', async (req, res) => {
  try {
    const { sourceAdId } = req.params;
    const config = await getCompleteAdConfiguration(sourceAdId);
    
    res.json({
      sourceAdId,
      preview: {
        ad: {
          name: config.ad.name,
          status: config.ad.status,
          created_time: config.ad.created_time
        },
        adset: {
          name: config.adset.name,
          daily_budget: config.adset.daily_budget,
          targeting: config.adset.targeting
        },
        creative: {
          name: config.creative.name,
          primaryText: config.creative.object_story_spec?.link_data?.message,
          headline: config.creative.object_story_spec?.link_data?.name,
          description: config.creative.object_story_spec?.link_data?.description,
          landingUrl: config.creative.object_story_spec?.link_data?.link,
          callToAction: config.creative.object_story_spec?.link_data?.call_to_action?.type
        },
        campaign: {
          name: config.campaign.name,
          objective: config.campaign.objective
        }
      }
    });

  } catch (error) {
    console.error('Error getting duplication preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function getCompleteAdConfiguration(adId) {
  const ad = new Ad(adId);
  
  // Get ad details
  const adData = await ad.read([
    'name',
    'status',
    'effective_status',
    'created_time',
    'updated_time',
    'adset_id',
    'creative'
  ]);

  // Get adset details
  const adSet = new AdSet(adData.adset_id);
  const adSetData = await adSet.read([
    'name',
    'status',
    'campaign_id',
    'daily_budget',
    'billing_event',
    'optimization_goal',
    'bid_strategy',
    'targeting'
  ]);

  // Get campaign details
  const campaign = new Campaign(adSetData.campaign_id);
  const campaignData = await campaign.read([
    'name',
    'objective',
    'status'
  ]);

  // Get creative details
  const creative = new AdCreative(adData.creative.creative_id);
  const creativeData = await creative.read([
    'name',
    'object_story_spec',
    'image_hash',
    'video_id'
  ]);

  return {
    ad: adData,
    adset: adSetData,
    campaign: campaignData,
    creative: creativeData
  };
}

async function getCompleteAdSetConfiguration(adSetId) {
  const adSet = new AdSet(adSetId);
  
  // Get adset details
  const adSetData = await adSet.read([
    'name',
    'status',
    'campaign_id',
    'daily_budget',
    'billing_event',
    'optimization_goal',
    'bid_strategy',
    'targeting'
  ]);

  // Get all ads in the adset
  const ads = await adSet.getAds([
    'name',
    'status',
    'effective_status',
    'created_time'
  ]);

  return {
    adset: adSetData,
    ads: ads
  };
}

async function createUpdatedAdCreative(sourceCreative, newAdCopy, newLandingUrl, newUrlParameters) {
  const sourceSpec = sourceCreative.object_story_spec;
  
  // Build new landing URL with parameters
  const finalLandingUrl = buildLandingUrl(newLandingUrl, newUrlParameters);
  
  const newCreativeData = {
    name: `${sourceCreative.name}_updated_${Date.now()}`,
    object_story_spec: {
      page_id: sourceSpec.page_id,
      link_data: {
        link: finalLandingUrl,
        message: newAdCopy.primaryText || sourceSpec.link_data.message,
        name: newAdCopy.headline || sourceSpec.link_data.name,
        description: newAdCopy.description || sourceSpec.link_data.description,
        call_to_action: {
          type: newAdCopy.callToAction || sourceSpec.link_data.call_to_action?.type || 'LEARN_MORE'
        }
      }
    }
  };

  // Preserve image or video
  if (sourceCreative.image_hash) {
    newCreativeData.object_story_spec.link_data.image_hash = sourceCreative.image_hash;
  } else if (sourceCreative.video_id) {
    newCreativeData.object_story_spec.video_data = {
      video_id: sourceCreative.video_id
    };
  }

  const account = require('facebook-nodejs-business-sdk').AdAccount;
  const adAccount = new account(process.env.META_AD_ACCOUNT_ID);
  
  return await adAccount.createAdCreative([], newCreativeData);
}

async function createDuplicateAd(sourceAd, newCreativeId, newAdName) {
  const newAdData = {
    name: newAdName,
    adset_id: sourceAd.adset_id,
    creative: { creative_id: newCreativeId },
    status: 'PAUSED' // Start paused for review
  };

  const account = require('facebook-nodejs-business-sdk').AdAccount;
  const adAccount = new account(process.env.META_AD_ACCOUNT_ID);
  
  return await adAccount.createAd([], newAdData);
}

async function createDuplicateAdInAdSet(sourceAd, newAdSetId, newCreativeId, newAdName) {
  const newAdData = {
    name: newAdName,
    adset_id: newAdSetId,
    creative: { creative_id: newCreativeId },
    status: 'PAUSED'
  };

  const account = require('facebook-nodejs-business-sdk').AdAccount;
  const adAccount = new account(process.env.META_AD_ACCOUNT_ID);
  
  return await adAccount.createAd([], newAdData);
}

async function createDuplicateAdSet(sourceAdSet, newAdSetName, budgetAdjustment, targetingAdjustment) {
  const newAdSetData = {
    name: newAdSetName,
    campaign_id: sourceAdSet.campaign_id,
    daily_budget: budgetAdjustment?.daily_budget || sourceAdSet.daily_budget,
    billing_event: sourceAdSet.billing_event,
    optimization_goal: sourceAdSet.optimization_goal,
    bid_strategy: sourceAdSet.bid_strategy,
    targeting: targetingAdjustment || sourceAdSet.targeting,
    status: 'PAUSED'
  };

  const account = require('facebook-nodejs-business-sdk').AdAccount;
  const adAccount = new account(process.env.META_AD_ACCOUNT_ID);
  
  return await adAccount.createAdSet([], newAdSetData);
}

async function createDuplicateAdSetInCampaign(sourceAdSet, targetCampaignId, newAdSetName) {
  const newAdSetData = {
    name: newAdSetName,
    campaign_id: targetCampaignId,
    daily_budget: sourceAdSet.daily_budget,
    billing_event: sourceAdSet.billing_event,
    optimization_goal: sourceAdSet.optimization_goal,
    bid_strategy: sourceAdSet.bid_strategy,
    targeting: sourceAdSet.targeting,
    status: 'PAUSED'
  };

  const account = require('facebook-nodejs-business-sdk').AdAccount;
  const adAccount = new account(process.env.META_AD_ACCOUNT_ID);
  
  return await adAccount.createAdSet([], newAdSetData);
}

function buildLandingUrl(baseUrl, parameters) {
  if (!baseUrl) return null;
  
  const url = new URL(baseUrl);
  
  // Add new parameters
  Object.keys(parameters).forEach(key => {
    url.searchParams.set(key, parameters[key]);
  });
  
  return url.toString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;