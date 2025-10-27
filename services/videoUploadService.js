/**
 * Video Upload Support for Meta Ads Launcher
 *
 * This adds MP4/MOV video upload capability to the creative upload system.
 * Videos will be uploaded to Meta and video IDs will be returned for ad creation.
 */

const { FacebookAdsApi, AdAccount, AdVideo } = require('facebook-nodejs-business-sdk');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

// Initialize Facebook API
FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

/**
 * Upload a video file to Meta Ads using direct HTTP API
 * @param {string} filePath - Path to the video file
 * @param {string} fileName - Original filename
 * @returns {Promise<Object>} Object with videoId and thumbnailUrl
 */
async function uploadVideoToMeta(filePath, fileName) {
    console.log(`🎥 Uploading video to Meta: ${fileName}`);

    try {
        // Get file size for logging
        const stats = fs.statSync(filePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Video size: ${fileSizeInMB} MB`);

        // Method 1: Direct HTTP API call with multipart form-data
        console.log(`🔄 Attempting direct HTTP upload with form-data...`);
        const form = new FormData();
        form.append('source', fs.createReadStream(filePath));
        form.append('name', fileName);
        form.append('access_token', process.env.META_ACCESS_TOKEN);

        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
            form,
            {
                headers: {
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        console.log(`🔍 Raw video upload response:`, JSON.stringify(response.data, null, 2));

        // Extract video ID from response
        const videoId = response.data.id || response.data.video_id;

        if (!videoId) {
            throw new Error('Meta API returned success but no video ID found in response');
        }

        console.log(`✅ Video uploaded successfully! Video ID: ${videoId}`);

        // Fetch video details to get auto-generated thumbnail
        console.log(`🖼️ Fetching auto-generated thumbnail for video ${videoId}...`);
        const videoDetails = await checkVideoStatus(videoId);

        const thumbnailUrl = videoDetails?.thumbnails?.data?.[0]?.uri ||
                            videoDetails?.picture ||
                            null;

        if (thumbnailUrl) {
            console.log(`✅ Auto-generated thumbnail URL: ${thumbnailUrl}`);
        } else {
            console.log(`⚠️ No thumbnail found, will use thumbnail URL in ad creation`);
        }

        return {
            videoId,
            thumbnailUrl
        };

    } catch (error) {
        console.error(`❌ Video upload failed:`, error.response?.data || error.message);

        // Fallback: Try with SDK method
        try {
            console.log(`🔄 Trying SDK upload method...`);

            const videoData = await account.createAdVideo([], {
                source: fs.createReadStream(filePath),
                name: fileName
            });

            const videoId = videoData.id ||
                           videoData.video_id ||
                           videoData._data?.id;

            if (!videoId) {
                throw new Error('SDK method: No video ID in response');
            }

            console.log(`✅ SDK upload successful! Video ID: ${videoId}`);

            // Try to get thumbnail
            const videoDetails = await checkVideoStatus(videoId);
            const thumbnailUrl = videoDetails?.thumbnails?.data?.[0]?.uri ||
                                videoDetails?.picture ||
                                null;

            return {
                videoId,
                thumbnailUrl
            };

        } catch (fallbackError) {
            console.error(`❌ All video upload methods failed`);
            const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            const fallbackDetails = fallbackError.response?.data ? JSON.stringify(fallbackError.response.data) : fallbackError.message;
            throw new Error(`Video upload failed: ${errorDetails}. Fallback also failed: ${fallbackDetails}`);
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
 * @param {Object} adData - Ad configuration including adsetId, videoId, adCopy, and imageHash (for thumbnail)
 * @returns {Promise<Object>} Created ad details
 */
async function createAdWithVideo(adData) {
    const { adsetId, videoId, adCopy, imageHash } = adData;

    console.log(`📝 Creating video ad in adset ${adsetId}`);

    const adParams = {
        name: adData.name || `Video_Ad_${Date.now()}`,
        adset_id: adsetId,
        creative: {
            object_story_spec: {
                page_id: process.env.META_PAGE_ID,
                video_data: {
                    video_id: videoId,
                    image_hash: imageHash, // Thumbnail image required by Meta
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
