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
 * Upload a video file to Meta Ads using resumable upload for large files
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
        const fileSizeBytes = stats.size;
        console.log(`📊 Video size: ${fileSizeInMB} MB (${fileSizeBytes} bytes)`);

        // Use resumable upload for files larger than 50MB
        if (fileSizeBytes > 50 * 1024 * 1024) {
            console.log(`📦 File is large (>${fileSizeInMB}MB), using resumable upload...`);
            return await uploadLargeVideoResumable(filePath, fileName, fileSizeBytes);
        }

        // Method 1: Direct HTTP API call with multipart form-data (for small files)
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
                maxBodyLength: Infinity,
                timeout: 300000 // 5 minutes
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
        throw new Error(`Video upload failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Upload large video using Meta's resumable upload API
 * @param {string} filePath - Path to the video file
 * @param {string} fileName - Original filename
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<Object>} Object with videoId and thumbnailUrl
 */
async function uploadLargeVideoResumable(filePath, fileName, fileSize) {
    console.log(`🚀 Starting resumable upload for ${fileName}...`);

    try {
        // Step 1: Initialize upload session
        console.log(`📝 Step 1: Initializing upload session...`);
        const initResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
            null,
            {
                params: {
                    upload_phase: 'start',
                    file_size: fileSize,
                    access_token: process.env.META_ACCESS_TOKEN
                }
            }
        );

        const uploadSessionId = initResponse.data.upload_session_id;
        const startOffset = initResponse.data.start_offset || 0;
        const endOffset = initResponse.data.end_offset;

        console.log(`✅ Upload session created: ${uploadSessionId}`);
        console.log(`📍 Upload range: ${startOffset} - ${endOffset}`);

        // Step 2: Upload video file
        console.log(`📤 Step 2: Uploading video data...`);
        const fileBuffer = fs.readFileSync(filePath);

        const uploadResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
            fileBuffer,
            {
                params: {
                    upload_phase: 'transfer',
                    upload_session_id: uploadSessionId,
                    start_offset: startOffset,
                    access_token: process.env.META_ACCESS_TOKEN
                },
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 600000 // 10 minutes for large files
            }
        );

        console.log(`✅ Video data uploaded successfully`);

        // Step 3: Finalize upload
        console.log(`🏁 Step 3: Finalizing upload...`);
        const finalizeResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
            null,
            {
                params: {
                    upload_phase: 'finish',
                    upload_session_id: uploadSessionId,
                    title: fileName,
                    access_token: process.env.META_ACCESS_TOKEN
                }
            }
        );

        const videoId = finalizeResponse.data.video_id || finalizeResponse.data.id;

        if (!videoId) {
            throw new Error('Resumable upload completed but no video ID returned');
        }

        console.log(`✅ Resumable upload complete! Video ID: ${videoId}`);

        // Fetch thumbnail
        console.log(`🖼️ Fetching auto-generated thumbnail...`);
        const videoDetails = await checkVideoStatus(videoId);
        const thumbnailUrl = videoDetails?.thumbnails?.data?.[0]?.uri ||
                            videoDetails?.picture ||
                            null;

        if (thumbnailUrl) {
            console.log(`✅ Auto-generated thumbnail URL: ${thumbnailUrl}`);
        }

        return {
            videoId,
            thumbnailUrl
        };

    } catch (error) {
        console.error(`❌ Resumable upload failed:`, error.response?.data || error.message);
        throw new Error(`Resumable upload failed: ${error.response?.data?.error?.message || error.message}`);
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
