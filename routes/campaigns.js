const express = require('express');
const metaService = require('../services/metaService');
const supabaseService = require('../services/supabaseClient');
const fs = require('fs').promises;
const path = require('path');
const { FacebookAdsApi, AdAccount } = require('facebook-nodejs-business-sdk');
const router = express.Router();

// Initialize Facebook API for direct AdSet creation
FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const campaigns = await metaService.getActiveCampaigns();
    res.json({ campaigns, count: campaigns.length });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific campaign details
router.get('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Get campaign adsets and ads
    const [adsets, ads] = await Promise.all([
      metaService.getCampaignAdSets(campaignId),
      metaService.getCampaignAds(campaignId)
    ]);
    
    // Get campaign insights
    const insights = await metaService.getCampaignInsights(campaignId);
    
    // Get retention data for all ads in campaign (if Supabase is available)
    let retentionData = [];
    try {
      const adIds = ads.map(ad => ad.id);
      retentionData = await supabaseService.getAdPerformanceMetrics(adIds);
    } catch (error) {
      console.warn('Supabase not available for retention data:', error.message);
      retentionData = [];
    }

    res.json({
      campaignId,
      adsets,
      ads,
      insights,
      retentionData,
      totalAdSets: adsets.length,
      totalAds: ads.length,
      activeAds: ads.filter(ad => ad.effective_status === 'ACTIVE').length
    });

  } catch (error) {
    console.error('Error getting campaign details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get adset ads
router.get('/adset/:adsetId/ads', async (req, res) => {
  try {
    const { adsetId } = req.params;
    const ads = await metaService.getAdSetAds(adsetId);
    
    res.json({
      adsetId,
      ads,
      totalAds: ads.length,
      activeAds: ads.filter(ad => ad.effective_status === 'ACTIVE').length
    });
    
  } catch (error) {
    console.error('Error getting adset ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new campaign from uploaded creatives
router.post('/create', async (req, res) => {
  try {
    const {
      bookId,
      campaignName,
      creativeFolder,
      adCopySheet,
      landingPageConfig,
      budgetConfig,
      targetingConfig
    } = req.body;

    // Validate required fields
    if (!bookId || !campaignName) {
      return res.status(400).json({ 
        error: 'Missing required fields: bookId and campaignName are required' 
      });
    }

    // Get creative files from folder
    const creativeFiles = await getCreativeFiles(bookId, creativeFolder);
    if (creativeFiles.length === 0) {
      return res.status(400).json({ 
        error: 'No creative files found in specified folder' 
      });
    }

    // Get ad copy variations from Google Sheets
    const sheetsService = require('../services/sheetsService');
    const adCopyVariations = await sheetsService.getAdCopyForBook(bookId);
    if (adCopyVariations.length === 0) {
      return res.status(400).json({ 
        error: 'No ad copy variations found for this book' 
      });
    }

    // Create campaign via Meta API
    const campaignResult = await createFullCampaign({
      bookId,
      campaignName,
      creativeFiles,
      adCopyVariations,
      landingPageConfig,
      budgetConfig,
      targetingConfig
    });

    res.json({
      message: 'Campaign creation initiated',
      campaignId: campaignResult.campaignId,
      totalAds: campaignResult.totalAdsCreated,
      totalAdSets: campaignResult.totalAdSetsCreated,
      errors: campaignResult.errors || []
    });

  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause campaign
router.post('/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { reason = 'Manual pause' } = req.body;

    await metaService.pauseCampaign(campaignId);

    // Log the pause action
    const logEntry = {
      campaignId,
      action: 'paused',
      reason,
      timestamp: new Date().toISOString(),
      manual: true
    };

    await logCampaignAction(logEntry);

    res.json({ 
      message: 'Campaign paused successfully',
      campaignId,
      action: 'paused'
    });

  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Activate campaign
router.post('/:campaignId/activate', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Note: Campaign activation might need manual review
    // For now, we'll just log the request
    const logEntry = {
      campaignId,
      action: 'activation_requested',
      timestamp: new Date().toISOString(),
      manual: true,
      note: 'Manual activation required via Meta Ads Manager'
    };

    await logCampaignAction(logEntry);

    res.json({ 
      message: 'Campaign activation requested. Please activate manually in Meta Ads Manager.',
      campaignId,
      action: 'activation_requested'
    });

  } catch (error) {
    console.error('Error requesting campaign activation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign performance summary
router.get('/:campaignId/performance', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { dateRange = 'last_7_days' } = req.query;

    const [insights, ads] = await Promise.all([
      metaService.getCampaignInsights(campaignId, dateRange),
      metaService.getCampaignAds(campaignId)
    ]);

    const adIds = ads.map(ad => ad.id);
    const retentionData = await supabaseService.getAdPerformanceMetrics(adIds);

    // Calculate summary metrics
    const summary = calculateCampaignSummary(insights, retentionData);

    res.json({
      campaignId,
      dateRange,
      summary,
      adPerformance: insights,
      retentionMetrics: retentionData
    });

  } catch (error) {
    console.error('Error getting campaign performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign history
router.get('/:campaignId/history', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const history = await getCampaignHistory(campaignId);
    res.json({ campaignId, history });
  } catch (error) {
    console.error('Error getting campaign history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function getCreativeFiles(bookId, folderName = 'default') {
  try {
    const folderPath = path.join(__dirname, '..', 'uploads', bookId, folderName);
    const files = await fs.readdir(folderPath);
    
    const creativeFiles = [];
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const extension = path.extname(file).toLowerCase();
        let type = 'unknown';
        
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(extension)) {
          type = 'image';
        } else if (['.mp4', '.mov', '.avi'].includes(extension)) {
          type = 'video';
        }

        creativeFiles.push({
          name: file,
          path: path.relative(path.join(__dirname, '..'), filePath),
          type: type,
          size: stats.size,
          extension: extension
        });
      }
    }

    return creativeFiles;
  } catch (error) {
    console.error('Error getting creative files:', error);
    return [];
  }
}

async function createFullCampaign(config) {
  const {
    bookId,
    campaignName,
    creativeFiles,
    adCopyVariations,
    landingPageConfig,
    budgetConfig = { daily: 50, adSet: 10 },
    targetingConfig = { countries: ['US'], ageMin: 18, ageMax: 65 }
  } = config;

  // This would integrate with the Meta API route we created earlier
  const metaRoute = require('./meta');
  
  // Prepare the request payload
  const campaignPayload = {
    bookId,
    campaignName,
    creativeFiles,
    adCopyVariations,
    landingPageUrl: landingPageConfig?.baseUrl || process.env.BASE_LANDING_PAGE_URL,
    budget: budgetConfig,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    targetAudience: targetingConfig
  };

  // Create the campaign (this would call the Meta API)
  // For now, we'll simulate the response
  return {
    campaignId: 'camp_' + Date.now(),
    totalAdsCreated: creativeFiles.length * adCopyVariations.length,
    totalAdSetsCreated: creativeFiles.length * adCopyVariations.length,
    errors: []
  };
}

function calculateCampaignSummary(insights, retentionData) {
  const totalSpend = insights.reduce((sum, ad) => sum + ad.spend, 0);
  const totalImpressions = insights.reduce((sum, ad) => sum + ad.impressions, 0);
  const totalClicks = insights.reduce((sum, ad) => sum + ad.clicks, 0);
  const totalInstalls = retentionData.reduce((sum, ad) => sum + ad.totalUsers, 0);

  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPA = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
  const avgD1Retention = retentionData.length > 0 
    ? retentionData.reduce((sum, ad) => sum + ad.day1Retention, 0) / retentionData.length 
    : 0;

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalInstalls,
    avgCTR,
    avgCPA,
    avgD1Retention,
    performanceScore: calculatePerformanceScore({
      ctr: avgCTR,
      cpa: avgCPA,
      d1Retention: avgD1Retention
    })
  };
}

function calculatePerformanceScore(metrics) {
  let score = 100;
  
  if (metrics.ctr < 1.0) score -= 20;
  if (metrics.cpa > 25) score -= 30;
  if (metrics.d1Retention < 0.3) score -= 30;
  
  return Math.max(0, score);
}

async function logCampaignAction(logEntry) {
  const logPath = path.join(__dirname, '..', 'logs', 'campaign_actions.log');
  const logDir = path.dirname(logPath);

  try {
    await fs.access(logDir);
  } catch {
    await fs.mkdir(logDir, { recursive: true });
  }

  await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
}

async function getCampaignHistory(campaignId) {
  try {
    const logPath = path.join(__dirname, '..', 'logs', 'campaign_actions.log');
    const logData = await fs.readFile(logPath, 'utf8');
    
    const allLogs = logData.trim().split('\n')
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(log => log && log.campaignId === campaignId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allLogs;
  } catch (error) {
    console.error('Error reading campaign history:', error);
    return [];
  }
}

// Create ads batch for existing adset (simplified workflow)
router.post('/create-ads-batch', async (req, res) => {
  try {
    const {
      adsetId,
      referenceAdId,
      creativeIds,
      adCopyVariations,
      creativeFilenames  // New: mapping of creativeId -> original filename
    } = req.body;

    console.log('🚀 Starting batch ad creation:', {
      adsetId,
      referenceAdId,
      creativeCount: creativeIds?.length || 0,
      adCopyCount: adCopyVariations?.length || 0,
      hasFilenameMapping: !!creativeFilenames
    });

    if (!adsetId || !referenceAdId) {
      return res.status(400).json({ error: 'AdSet ID and Reference Ad ID are required' });
    }

    if (!creativeIds || creativeIds.length === 0) {
      return res.status(400).json({ error: 'At least one creative ID is required' });
    }

    if (!adCopyVariations || adCopyVariations.length === 0) {
      return res.status(400).json({ error: 'At least one ad copy variation is required' });
    }

    const results = [];
    let successful = 0;
    let failed = 0;

    // Get reference ad details for configuration
    console.log('📋 Getting reference ad configuration...');
    const referenceAd = await metaService.getAdDetails(referenceAdId);

    // Debug: Log the entire reference ad structure
    console.log(`🔍 Reference ad structure:`, JSON.stringify(referenceAd, null, 2));

    // Detect if this is an app install ad or web conversion ad
    console.log('🔍 Detecting ad type...');
    const { AdSet } = require('facebook-nodejs-business-sdk');
    const adset = new AdSet(adsetId);
    const adsetDetails = await adset.read(['promoted_object', 'optimization_goal']);

    const isAppInstallAd = !!adsetDetails.promoted_object?.application_id;
    const appStoreUrl = adsetDetails.promoted_object?.object_store_url;

    if (isAppInstallAd) {
      console.log('📱 Detected: APP INSTALL AD');
      console.log(`   - Application ID: ${adsetDetails.promoted_object.application_id}`);
      console.log(`   - App Store URL: ${appStoreUrl}`);
      console.log('   - Will use INSTALL_MOBILE_APP CTA and ignore CSV landing page URLs');
    } else {
      console.log('🌐 Detected: WEB CONVERSION AD');
      console.log('   - Will use CSV landing page URLs and web CTAs');
    }
    
    // Check if reference ad has an existing image hash we can reuse
    let existingImageHash = referenceAd?.creative?.object_story_spec?.link_data?.image_hash;
    
    if (!existingImageHash && referenceAd?.creative?.id) {
      console.log(`🔍 No direct image hash, trying to fetch creative details for ID: ${referenceAd.creative.id}`);
      try {
        const { AdCreative } = require('facebook-nodejs-business-sdk');
        const creative = new AdCreative(referenceAd.creative.id);
        const creativeDetails = await creative.read([
          'object_story_spec',
          'image_hash',
          'image_url'
        ]);
        
        console.log(`🔍 Creative details:`, JSON.stringify(creativeDetails, null, 2));
        // Check both link_data (for image ads) and video_data (for video ads)
        existingImageHash = creativeDetails?.object_story_spec?.link_data?.image_hash ||
                           creativeDetails?.object_story_spec?.video_data?.image_hash;

        if (existingImageHash) {
          console.log(`✅ Found image hash in creative details: ${existingImageHash}`);
        }
      } catch (creativeError) {
        console.log(`❌ Failed to fetch creative details: ${creativeError.message}`);
      }
    }
    
    if (existingImageHash) {
      console.log(`✅ Found existing image hash: ${existingImageHash}`);
      console.log(`💡 Will use this as fallback if uploaded images don't have valid hashes`);
    } else {
      console.log(`❌ No image hash found in reference ad or creative details`);
    }
    
    if (!referenceAd) {
      return res.status(400).json({ error: 'Reference ad not found' });
    }

    // Create ads for each combination of creative + ad copy
    for (const adCopy of adCopyVariations) {
      for (const creativeId of creativeIds) {
        try {
          // Use filename from mapping if available, otherwise fall back to old format
          const filename = creativeFilenames?.[creativeId] || `creative_${creativeId.substring(0, 8)}`;
          const adName = `${adCopy.bookId} - ${filename}`;

          console.log(`📝 Creating ad: ${adName}`);
          
          // Determine if this is a video ID or image hash
          // Video IDs are numeric and typically 15+ digits long
          const isVideoId = /^\d{15,}$/.test(creativeId);

          console.log(`🎬 Creative type: ${isVideoId ? 'VIDEO' : 'IMAGE'} (${creativeId.substring(0, 20)}...)`);

          let adData;

          if (isVideoId) {
            // Create video ad with auto-generated thumbnail
            // Fetch video details to get the thumbnail
            console.log(`📹 Fetching video thumbnail for video ID: ${creativeId}`);
            const videoUploadService = require('../services/videoUploadService');
            const videoDetails = await videoUploadService.checkVideoStatus(creativeId);

            const thumbnailUrl = videoDetails?.thumbnails?.data?.[0]?.uri ||
                                videoDetails?.picture;

            if (!thumbnailUrl) {
              console.log(`⚠️ No auto-generated thumbnail found, using reference ad image as fallback`);
            } else {
              console.log(`✅ Using auto-generated thumbnail: ${thumbnailUrl}`);
            }

            // Determine CTA and link based on ad type
            const ctaType = isAppInstallAd ? 'INSTALL_MOBILE_APP' : (adCopy.callToAction || 'LEARN_MORE');
            const destinationLink = isAppInstallAd ? appStoreUrl : adCopy.landingPageUrl;

            console.log(`   - CTA Type: ${ctaType}`);
            console.log(`   - Destination: ${destinationLink}`);

            adData = {
              name: adName,
              adset_id: adsetId,
              creative: {
                object_story_spec: {
                  page_id: referenceAd.creative?.object_story_spec?.page_id || process.env.META_PAGE_ID,
                  video_data: {
                    video_id: creativeId,
                    image_url: thumbnailUrl || undefined, // Use auto-generated thumbnail
                    image_hash: thumbnailUrl ? undefined : existingImageHash, // Fallback to reference image
                    message: adCopy.primaryText,
                    title: adCopy.headline,
                    link_description: adCopy.description,
                    call_to_action: {
                      type: ctaType,
                      value: {
                        link: destinationLink
                      }
                    }
                  }
                }
              },
              status: 'PAUSED'
            };
          } else {
            // Create image ad
            // Use existing image hash from reference ad if creative ID is mock
            let finalImageHash = creativeId;
            if (creativeId.startsWith('mock_hash_') && existingImageHash) {
              finalImageHash = existingImageHash;
              console.log(`🔄 Replacing mock hash with existing image hash: ${finalImageHash}`);
            }

            // Determine CTA and link based on ad type
            const ctaType = isAppInstallAd ? 'INSTALL_MOBILE_APP' : (adCopy.callToAction || 'LEARN_MORE');
            const destinationLink = isAppInstallAd ? appStoreUrl : adCopy.landingPageUrl;

            console.log(`   - CTA Type: ${ctaType}`);
            console.log(`   - Destination: ${destinationLink}`);

            // For app install ads, CTA needs a value object; for web ads, it doesn't
            const callToActionObj = isAppInstallAd ? {
              type: ctaType,
              value: {
                link: destinationLink
              }
            } : {
              type: ctaType
            };

            adData = {
              name: adName,
              adset_id: adsetId,
              creative: {
                object_story_spec: {
                  page_id: referenceAd.creative?.object_story_spec?.page_id || process.env.META_PAGE_ID,
                  link_data: {
                    link: destinationLink,
                    message: adCopy.primaryText,
                    name: adCopy.headline,
                    description: adCopy.description,
                    call_to_action: callToActionObj,
                    image_hash: finalImageHash
                  }
                }
              },
              status: 'PAUSED'
            };
          }

          // Create the actual ad using Meta API
          const newAd = await metaService.createAd(adData);

          results.push({
            adName,
            adId: newAd.id,
            creativeId,
            adCopy: adCopy.variation,
            status: 'created'
          });

          successful++;
          console.log(`✅ Created ad: ${adName} (${newAd.id})`);

        } catch (error) {
          console.error(`❌ Failed to create ad for ${adCopy.variation} + ${creativeId}:`, error);
          
          results.push({
            adName: `${adCopy.bookId}_${adCopy.variation}_${creativeId.substring(0, 8)}`,
            creativeId,
            adCopy: adCopy.variation,
            status: 'failed',
            error: error.message
          });

          failed++;
        }
      }
    }

    console.log(`🎯 Batch ad creation completed: ${successful} successful, ${failed} failed`);

    res.json({
      success: true,
      message: `Batch ad creation completed: ${successful} successful, ${failed} failed`,
      successful,
      failed,
      totalAttempted: successful + failed,
      results
    });

  } catch (error) {
    console.error('Error creating ads batch:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Create duplicate adset with ads
router.post('/create-duplicate-adset', async (req, res) => {
  try {
    const {
      campaignId,
      referenceAdsetId,
      referenceAdId,
      creativeIds,
      adCopyVariations,
      maxAdsPerAdset = 50,
      creativeFilenames  // New: mapping of creativeId -> original filename
    } = req.body;

    console.log('🚀 Starting duplicate adset creation:', {
      campaignId,
      referenceAdsetId,
      referenceAdId,
      creativeCount: creativeIds?.length || 0,
      adCopyCount: adCopyVariations?.length || 0,
      maxAdsPerAdset,
      hasFilenameMapping: !!creativeFilenames
    });

    if (!campaignId || !referenceAdsetId || !referenceAdId) {
      return res.status(400).json({ error: 'Campaign ID, reference AdSet ID, and Reference Ad ID are required' });
    }

    if (!creativeIds || creativeIds.length === 0) {
      return res.status(400).json({ error: 'At least one creative ID is required' });
    }

    if (!adCopyVariations || adCopyVariations.length === 0) {
      return res.status(400).json({ error: 'At least one ad copy variation is required' });
    }

    // Calculate total combinations and how many adsets we need
    const totalCombinations = creativeIds.length * adCopyVariations.length;
    const adsetsNeeded = Math.ceil(totalCombinations / maxAdsPerAdset);
    
    console.log(`📊 Total combinations: ${totalCombinations}, AdSets needed: ${adsetsNeeded}`);

    // Get reference adset details to duplicate
    console.log('📋 Getting reference adset details...');
    const { AdSet } = require('facebook-nodejs-business-sdk');
    const referenceAdset = new AdSet(referenceAdsetId);
    const adsetDetails = await referenceAdset.read([
      'name',
      'optimization_goal',
      'billing_event',
      'bid_amount',
      'daily_budget',
      'lifetime_budget',
      'start_time',
      'end_time',
      'targeting',
      'status',
      'promoted_object'
    ]);
    
    console.log('🔍 Reference AdSet details:', JSON.stringify(adsetDetails, null, 2));

    // Get reference ad details for creative settings
    console.log('📋 Getting reference ad configuration...');
    const referenceAd = await metaService.getAdDetails(referenceAdId);

    // Detect if this is an app install ad or web conversion ad
    console.log('🔍 Detecting ad type from reference adset...');
    const isAppInstallAd = !!adsetDetails.promoted_object?.application_id;
    const appStoreUrl = adsetDetails.promoted_object?.object_store_url;

    if (isAppInstallAd) {
      console.log('📱 Detected: APP INSTALL AD');
      console.log(`   - Application ID: ${adsetDetails.promoted_object.application_id}`);
      console.log(`   - App Store URL: ${appStoreUrl}`);
      console.log('   - Will use INSTALL_MOBILE_APP CTA and ignore CSV landing page URLs');
    } else {
      console.log('🌐 Detected: WEB CONVERSION AD');
      console.log('   - Will use CSV landing page URLs and web CTAs');
    }

    const results = [];
    let totalAdsCreated = 0;
    let failedAds = 0;
    let adsetsCreated = 0;

    // Create all ad combinations
    const allAdCombinations = [];
    for (const adCopy of adCopyVariations) {
      for (const creativeId of creativeIds) {
        allAdCombinations.push({ adCopy, creativeId });
      }
    }

    console.log(`📝 Generated ${allAdCombinations.length} ad combinations`);

    // Split combinations into batches for multiple adsets
    for (let i = 0; i < allAdCombinations.length; i += maxAdsPerAdset) {
      const batchCombinations = allAdCombinations.slice(i, i + maxAdsPerAdset);
      const adsetNumber = Math.floor(i / maxAdsPerAdset) + 1;
      
      console.log(`🏗️ Creating AdSet ${adsetNumber}/${adsetsNeeded} with ${batchCombinations.length} ads...`);

      try {
        // Create new adset with duplicate settings
        const newAdsetName = `${adsetDetails.name} - Copy ${adsetNumber}`;
        const newAdsetParams = {
          name: newAdsetName,
          campaign_id: campaignId,
          optimization_goal: adsetDetails.optimization_goal,
          billing_event: adsetDetails.billing_event,
          daily_budget: adsetDetails.daily_budget,
          targeting: adsetDetails.targeting,
          status: 'PAUSED', // Start paused for safety
          promoted_object: adsetDetails.promoted_object
        };

        // Handle Singapore regional regulation requirement
        if (adsetDetails.targeting?.geo_locations?.countries?.includes('SG')) {
          console.log('🇸🇬 Singapore targeting detected, adding proper DSA regulation parameters...');
          newAdsetParams.regional_regulated_categories = ['SINGAPORE_UNIVERSAL'];
          newAdsetParams.dsa_beneficiary = process.env.META_AD_ACCOUNT_ID; // Use ad account as default
          newAdsetParams.dsa_payor = process.env.META_AD_ACCOUNT_ID; // Use ad account as default
        }

        // Handle bidding requirements based on optimization goal
        if (adsetDetails.bid_amount) {
          newAdsetParams.bid_amount = adsetDetails.bid_amount;
        } else if (adsetDetails.optimization_goal === 'OFFSITE_CONVERSIONS' || adsetDetails.optimization_goal === 'CONVERSIONS') {
          // For conversion optimization without bid_amount, use LOWEST_COST_WITHOUT_CAP strategy
          newAdsetParams.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
        } else if (adsetDetails.optimization_goal === 'VALUE') {
          // For VALUE optimization, we need bid constraints with LOWEST_COST_WITH_MIN_ROAS
          newAdsetParams.bid_strategy = 'LOWEST_COST_WITH_MIN_ROAS';
          newAdsetParams.bid_constraints = {
            roas_average_floor: 1.0 // Minimum 1:1 ROAS
          };
        } else {
          // Default fallback for other optimization goals
          newAdsetParams.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
        }

        console.log(`📝 Creating new AdSet: ${newAdsetName}`);
        console.log(`📝 AdSet parameters:`, JSON.stringify({
          name: newAdsetParams.name,
          optimization_goal: newAdsetParams.optimization_goal,
          billing_event: newAdsetParams.billing_event,
          bid_amount: newAdsetParams.bid_amount,
          bid_strategy: newAdsetParams.bid_strategy,
          bid_constraints: newAdsetParams.bid_constraints
        }, null, 2));
        
        const newAdset = await account.createAdSet([], newAdsetParams);
        const newAdsetId = newAdset.id;
        
        console.log(`✅ Created AdSet: ${newAdsetId}`);
        adsetsCreated++;

        // Create ads in this adset
        let adsInThisAdset = 0;
        let failedInThisAdset = 0;

        for (const { adCopy, creativeId } of batchCombinations) {
          try {
            // Use filename from mapping if available, otherwise fall back to old format
            const filename = creativeFilenames?.[creativeId] || `creative_${creativeId.substring(0, 8)}`;
            const adName = `${adCopy.bookId} - ${filename}`;

            console.log(`📝 Creating ad in AdSet ${adsetNumber}: ${adName}`);
            
            // Determine if this is a video ID or image hash
            // Video IDs are numeric and typically 15+ digits long
            const isVideoId = /^\d{15,}$/.test(creativeId);

            console.log(`🎬 Creative type: ${isVideoId ? 'VIDEO' : 'IMAGE'} (${creativeId.substring(0, 20)}...)`);

            // Get existing image hash for use as video thumbnail or fallback
            // Check both link_data (for image ads) and video_data (for video ads)
            const existingImageHash = referenceAd?.creative?.object_story_spec?.link_data?.image_hash ||
                                     referenceAd?.creative?.object_story_spec?.video_data?.image_hash;

            let adData;

            if (isVideoId) {
              // Create video ad with auto-generated thumbnail
              // Fetch video details to get the thumbnail
              console.log(`📹 Fetching video thumbnail for video ID: ${creativeId}`);
              const videoUploadService = require('../services/videoUploadService');
              const videoDetails = await videoUploadService.checkVideoStatus(creativeId);

              const thumbnailUrl = videoDetails?.thumbnails?.data?.[0]?.uri ||
                                  videoDetails?.picture;

              if (!thumbnailUrl) {
                console.log(`⚠️ No auto-generated thumbnail found, using reference ad image as fallback`);
              } else {
                console.log(`✅ Using auto-generated thumbnail: ${thumbnailUrl}`);
              }

              // Determine CTA and link based on ad type
              const ctaType = isAppInstallAd ? 'INSTALL_MOBILE_APP' : (adCopy.callToAction || 'LEARN_MORE');
              const destinationLink = isAppInstallAd ? appStoreUrl : adCopy.landingPageUrl;

              console.log(`   - CTA Type: ${ctaType}`);
              console.log(`   - Destination: ${destinationLink}`);

              adData = {
                name: adName,
                adset_id: newAdsetId,
                creative: {
                  object_story_spec: {
                    page_id: referenceAd.creative?.object_story_spec?.page_id || process.env.META_PAGE_ID,
                    video_data: {
                      video_id: creativeId,
                      image_url: thumbnailUrl || undefined, // Use auto-generated thumbnail
                      image_hash: thumbnailUrl ? undefined : existingImageHash, // Fallback to reference image
                      message: adCopy.primaryText,
                      title: adCopy.headline,
                      link_description: adCopy.description,
                      call_to_action: {
                        type: ctaType,
                        value: {
                          link: destinationLink
                        }
                      }
                    }
                  }
                },
                status: 'PAUSED'
              };
            } else {
              // Create image ad
              // Use existing image hash from reference ad if creative ID is mock
              let finalImageHash = creativeId;
              if (creativeId.startsWith('mock_hash_') && existingImageHash) {
                finalImageHash = existingImageHash;
                console.log(`🔄 Replacing mock hash with existing image hash: ${finalImageHash}`);
              }

              // Determine CTA and link based on ad type
              const ctaType = isAppInstallAd ? 'INSTALL_MOBILE_APP' : (adCopy.callToAction || 'LEARN_MORE');
              const destinationLink = isAppInstallAd ? appStoreUrl : adCopy.landingPageUrl;

              console.log(`   - CTA Type: ${ctaType}`);
              console.log(`   - Destination: ${destinationLink}`);

              // For app install ads, CTA needs a value object; for web ads, it doesn't
              const callToActionObj = isAppInstallAd ? {
                type: ctaType,
                value: {
                  link: destinationLink
                }
              } : {
                type: ctaType
              };

              adData = {
                name: adName,
                adset_id: newAdsetId,
                creative: {
                  object_story_spec: {
                    page_id: referenceAd.creative?.object_story_spec?.page_id || process.env.META_PAGE_ID,
                    link_data: {
                      link: destinationLink,
                      message: adCopy.primaryText,
                      name: adCopy.headline,
                      description: adCopy.description,
                      call_to_action: callToActionObj,
                      image_hash: finalImageHash
                    }
                  }
                },
                status: 'PAUSED'
              };
            }

            // Create the actual ad using Meta API
            const newAd = await metaService.createAd(adData);

            results.push({
              adsetNumber,
              adsetId: newAdsetId,
              adName,
              adId: newAd.id,
              creativeId,
              adCopy: adCopy.variation,
              status: 'created'
            });

            adsInThisAdset++;
            totalAdsCreated++;
            console.log(`✅ Created ad: ${adName} (${newAd.id})`);

          } catch (error) {
            console.error(`❌ Failed to create ad for ${adCopy.variation} + ${creativeId} in AdSet ${adsetNumber}:`, error);
            
            results.push({
              adsetNumber,
              adsetId: newAdsetId,
              adName: `${adCopy.bookId}_${adCopy.variation}_${creativeId.substring(0, 8)}_AS${adsetNumber}`,
              creativeId,
              adCopy: adCopy.variation,
              status: 'failed',
              error: error.message
            });

            failedInThisAdset++;
            failedAds++;
          }
        }

        console.log(`✅ AdSet ${adsetNumber} completed: ${adsInThisAdset} ads created, ${failedInThisAdset} failed`);

      } catch (error) {
        console.error(`❌ Failed to create AdSet ${adsetNumber}:`, error);
        
        // Mark all ads in this batch as failed
        for (const { adCopy, creativeId } of batchCombinations) {
          results.push({
            adsetNumber,
            adsetId: null,
            adName: `${adCopy.bookId}_${adCopy.variation}_${creativeId.substring(0, 8)}_AS${adsetNumber}`,
            creativeId,
            adCopy: adCopy.variation,
            status: 'failed',
            error: `AdSet creation failed: ${error.message}`
          });
          failedAds++;
        }
      }
    }

    console.log(`🎯 Duplicate adset creation completed: ${adsetsCreated} adsets, ${totalAdsCreated} ads created, ${failedAds} ads failed`);

    res.json({
      success: true,
      message: `Duplicate adset creation completed: ${adsetsCreated} adsets created with ${totalAdsCreated} ads (${failedAds} failed)`,
      adsetsCreated,
      totalAdsCreated,
      failedAds,
      totalAttempted: totalCombinations,
      results
    });

  } catch (error) {
    console.error('Error creating duplicate adset:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;