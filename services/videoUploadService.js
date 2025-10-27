/**
 * Video Upload Support for Meta Ads Launcher
 *
 * This adds MP4/MOV video upload capability to the creative upload system.
 * Videos will be uploaded to Meta and video IDs will be returned for ad creation.
 */

const { FacebookAdsApi, AdAccount, AdVideo } = require('facebook-nodejs-business-sdk');
const fs = require('fs');

// Initialize Facebook API
FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

/**
 * Upload a video file to Meta Ads
 * @param {string} filePath - Path to the video file
 * @param {string} fileName - Original filename
 * @returns {Promise<string>} Video ID from Meta
 */
async function uploadVideoToMeta(filePath, fileName) {
    console.log(`🎥 Uploading video to Meta: ${fileName}`);

    try {
        // Get file size for logging
        const stats = fs.statSync(filePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Video size: ${fileSizeInMB} MB`);

        // Method 1: Upload with file stream (recommended for large files)
        const videoData = await account.createAdVideo([], {
            file_url: fs.createReadStream(filePath),
            name: fileName
        });

        console.log(`🔍 Raw video upload response:`, JSON.stringify(videoData, null, 2));

        // Extract video ID from response
        const videoId = videoData.id ||
                       videoData.video_id ||
                       videoData._data?.id ||
                       videoData._data?.video_id;

        if (!videoId) {
            throw new Error('Meta API returned success but no video ID found in response');
        }

        console.log(`✅ Video uploaded successfully! Video ID: ${videoId}`);
        return videoId;

    } catch (error) {
        console.error(`❌ Video upload failed: ${error.message}`);

        // Fallback: Try with direct file buffer for smaller files
        try {
            console.log(`🔄 Trying alternative upload method...`);
            const fileBuffer = fs.readFileSync(filePath);

            const videoData = await account.createAdVideo([], {
                source: fileBuffer,
                name: fileName
            });

            const videoId = videoData.id ||
                           videoData.video_id ||
                           videoData._data?.id;

            if (!videoId) {
                throw new Error('Alternative upload method: No video ID in response');
            }

            console.log(`✅ Alternative upload successful! Video ID: ${videoId}`);
            return videoId;

        } catch (fallbackError) {
            console.error(`❌ All video upload methods failed`);
            throw new Error(`Video upload failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
        }
    }
}

/**
 * Check video upload status
 * Videos might need time to process on Meta's servers
 * @param {string} videoId - Video ID from Meta
 * @returns {Promise<Object>} Video status and details
 */
async function checkVideoStatus(videoId) {
    try {
        const video = new AdVideo(videoId);
        const videoDetails = await video.read([
            'id',
            'title',
            'status',
            'thumbnails',
            'length',
            'updated_time'
        ]);

        console.log(`📹 Video status:`, {
            id: videoDetails.id,
            status: videoDetails.status?.video_status || 'unknown',
            length: videoDetails.length,
            processing: videoDetails.status?.processing_progress || 'N/A'
        });

        return videoDetails;
    } catch (error) {
        console.error(`Error checking video status: ${error.message}`);
        return null;
    }
}

/**
 * Create ad with video creative
 * @param {Object} adData - Ad configuration
 * @param {string} videoId - Video ID from Meta
 * @returns {Promise<Object>} Created ad details
 */
async function createAdWithVideo(adData) {
    const { adsetId, videoId, adCopy } = adData;

    console.log(`📝 Creating video ad in adset ${adsetId}`);

    const adParams = {
        name: adData.name || `Video_Ad_${Date.now()}`,
        adset_id: adsetId,
        creative: {
            object_story_spec: {
                page_id: process.env.META_PAGE_ID,
                video_data: {
                    video_id: videoId,
                    message: adCopy.primaryText,
                    title: adCopy.headline,
                    link_description: adCopy.description,
                    call_to_action: {
                        type: adCopy.callToAction || 'LEARN_MORE',
                        value: {
                            link: adCopy.landingPageUrl
                        }
                    }
                }
            }
        },
        status: 'PAUSED' // Start paused for safety
    };

    try {
        const newAd = await account.createAd([], adParams);
        console.log(`✅ Video ad created: ${newAd.id}`);
        return newAd;
    } catch (error) {
        console.error(`❌ Failed to create video ad: ${error.message}`);
        throw error;
    }
}

module.exports = {
    uploadVideoToMeta,
    checkVideoStatus,
    createAdWithVideo
};
