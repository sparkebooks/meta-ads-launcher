const express = require('express');
const { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad, AdCreative, AdImage, AdVideo } = require('facebook-nodejs-business-sdk');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Initialize Facebook Ads API
FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);

const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

// Create campaign with multiple ad sets and ads
router.post('/create-campaign', async (req, res) => {
  try {
    const {
      bookId,
      campaignName,
      creativeFiles,
      adCopyVariations,
      landingPageUrl,
      budget,
      bidStrategy,
      targetAudience
    } = req.body;

    const results = {
      campaignId: null,
      adSets: [],
      ads: [],
      errors: []
    };

    // Step 1: Create Campaign
    const campaign = await createCampaign(campaignName, budget.daily);
    results.campaignId = campaign.id;

    // Step 2: Upload creatives
    const uploadedCreatives = await uploadCreatives(creativeFiles);

    // Step 3: Create ad sets and ads for each creative + copy combination
    for (const creative of uploadedCreatives) {
      for (const adCopy of adCopyVariations) {
        try {
          // Create AdSet
          const adSet = await createAdSet(campaign.id, {
            name: generateAdSetName(bookId, creative.name, adCopy.variation),
            targetAudience: targetAudience,
            budget: budget.adSet,
            bidStrategy: bidStrategy
          });

          // Create Ad Creative
          const adCreative = await createAdCreative({
            creative: creative,
            adCopy: adCopy,
            landingPageUrl: `${landingPageUrl}?book_id=${bookId}&creative=${creative.id}&variation=${adCopy.variation}`
          });

          // Create Ad
          const ad = await createAd(adSet.id, adCreative.id, {
            name: generateAdName(bookId, creative.name, adCopy.variation),
            status: 'PAUSED' // Start paused for review
          });

          results.adSets.push({
            id: adSet.id,
            name: adSet.name,
            creative: creative.name
          });

          results.ads.push({
            id: ad.id,
            name: ad.name,
            adSetId: adSet.id,
            creativeId: adCreative.id,
            landingPageUrl: adCreative.object_story_spec.link_data.link
          });

        } catch (error) {
          results.errors.push({
            creative: creative.name,
            adCopy: adCopy.variation,
            error: error.message
          });
        }
      }
    }

    // Save campaign info to database
    await saveCampaignInfo(results);

    res.json({
      message: 'Campaign creation completed',
      results: results
    });

  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign performance data
router.get('/campaign/:campaignId/performance', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const performance = await getCampaignPerformance(campaignId);
    res.json(performance);
  } catch (error) {
    console.error('Error getting campaign performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause underperforming ads
router.post('/pause-ads', async (req, res) => {
  try {
    const { adIds, reason } = req.body;
    const results = [];

    for (const adId of adIds) {
      try {
        await pauseAd(adId);
        results.push({ adId, status: 'paused', reason });
      } catch (error) {
        results.push({ adId, status: 'error', error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error pausing ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function createCampaign(name, dailyBudget) {
  const campaignData = {
    name: name,
    objective: 'LINK_CLICKS',
    status: 'PAUSED',
    daily_budget: Math.round(dailyBudget * 100), // Convert to cents
    buying_type: 'AUCTION'
  };

  const campaign = await account.createCampaign([], campaignData);
  return campaign;
}

async function createAdSet(campaignId, config) {
  const adSetData = {
    name: config.name,
    campaign_id: campaignId,
    daily_budget: Math.round(config.budget * 100), // Convert to cents
    billing_event: 'LINK_CLICKS',
    optimization_goal: 'LINK_CLICKS',
    bid_strategy: config.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    targeting: {
      geo_locations: {
        countries: config.targetAudience.countries || ['US']
      },
      age_min: config.targetAudience.ageMin || 18,
      age_max: config.targetAudience.ageMax || 65,
      genders: config.targetAudience.genders || [1, 2], // All genders
      interests: config.targetAudience.interests || []
    }
  };

  const adSet = await account.createAdSet([], adSetData);
  return adSet;
}

async function uploadCreatives(creativeFiles) {
  const uploadedCreatives = [];

  for (const file of creativeFiles) {
    try {
      let creative;
      const filePath = path.join(__dirname, '..', 'uploads', file.path);

      if (file.type === 'image') {
        creative = await uploadImage(filePath, file.name);
      } else if (file.type === 'video') {
        creative = await uploadVideo(filePath, file.name);
      }

      uploadedCreatives.push({
        id: creative.id,
        name: file.name,
        type: file.type,
        hash: creative.hash || creative.id
      });

    } catch (error) {
      console.error(`Error uploading creative ${file.name}:`, error);
    }
  }

  return uploadedCreatives;
}

async function uploadImage(filePath, fileName) {
  const image = new AdImage(null, process.env.META_AD_ACCOUNT_ID);
  const imageData = {
    filename: filePath,
    name: fileName
  };

  return await image.create([], imageData);
}

async function uploadVideo(filePath, fileName) {
  const video = new AdVideo(null, process.env.META_AD_ACCOUNT_ID);
  const videoData = {
    source: fs.createReadStream(filePath),
    name: fileName
  };

  return await video.create([], videoData);
}

async function createAdCreative(config) {
  const { creative, adCopy, landingPageUrl } = config;

  const creativeData = {
    name: `Creative_${creative.name}_${adCopy.variation}`,
    object_story_spec: {
      page_id: process.env.META_PAGE_ID,
      link_data: {
        link: landingPageUrl,
        message: adCopy.primaryText,
        name: adCopy.headline,
        description: adCopy.description || '',
        call_to_action: {
          type: 'LEARN_MORE'
        }
      }
    }
  };

  // Add image or video hash
  if (creative.type === 'image') {
    creativeData.object_story_spec.link_data.image_hash = creative.hash;
  } else if (creative.type === 'video') {
    creativeData.object_story_spec.video_data = {
      video_id: creative.id
    };
  }

  const adCreative = await account.createAdCreative([], creativeData);
  return adCreative;
}

async function createAd(adSetId, creativeId, config) {
  const adData = {
    name: config.name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: config.status || 'PAUSED'
  };

  const ad = await account.createAd([], adData);
  return ad;
}

async function getCampaignPerformance(campaignId) {
  const campaign = new Campaign(campaignId);
  const insights = await campaign.getInsights([
    'impressions',
    'clicks',
    'ctr',
    'cpm',
    'cpc',
    'spend',
    'actions',
    'cost_per_action_type'
  ]);

  return insights;
}

async function pauseAd(adId) {
  const ad = new Ad(adId);
  return await ad.update([], { status: 'PAUSED' });
}

function generateAdSetName(bookId, creativeName, variation) {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${bookId}_${creativeName}_${variation}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

function generateAdName(bookId, creativeName, variation) {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `AD_${bookId}_${creativeName}_${variation}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function saveCampaignInfo(campaignData) {
  const campaignLogPath = path.join(__dirname, '..', 'data', 'campaigns.json');
  
  try {
    let existingData = [];
    try {
      const data = fs.readFileSync(campaignLogPath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet
    }

    const campaignRecord = {
      ...campaignData,
      createdAt: new Date().toISOString()
    };

    existingData.push(campaignRecord);
    
    // Ensure data directory exists
    const dataDir = path.dirname(campaignLogPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(campaignLogPath, JSON.stringify(existingData, null, 2));
  } catch (error) {
    console.error('Error saving campaign info:', error);
  }
}

module.exports = router;