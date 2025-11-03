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
 * Upload large video using Meta's resumable upload API with chunking
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
        console.log(`   - File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`   - Ad Account: ${process.env.META_AD_ACCOUNT_ID}`);

        const initResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
            null,
            {
                params: {
                    upload_phase: 'start',
                    file_size: fileSize,
                    access_token: process.env.META_ACCESS_TOKEN
                },
                timeout: 30000
            }
        );

        console.log(`📥 Init response:`, JSON.stringify(initResponse.data, null, 2));

        const uploadSessionId = initResponse.data.upload_session_id;
        // Convert to integers - API returns strings
        let startOffset = parseInt(initResponse.data.start_offset || '0', 10);
        let endOffset = parseInt(initResponse.data.end_offset, 10);

        console.log(`✅ Upload session created: ${uploadSessionId}`);
        console.log(`📍 Total file size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`📍 Meta's start_offset: ${startOffset} (parsed from "${initResponse.data.start_offset}")`);
        console.log(`📍 Meta's end_offset: ${endOffset} (parsed from "${initResponse.data.end_offset}")`);
        console.log(`📍 Calculated chunk size: ${endOffset - startOffset} bytes (${((endOffset - startOffset) / 1024 / 1024).toFixed(2)} MB)`);

        // Step 2: Upload video file in chunks (keep file open for speed)
        console.log(`📤 Step 2: Uploading video data in chunks...`);

        let currentOffset = startOffset; // Start from Meta's specified offset, not 0
        let chunkNumber = 1;
        let fileHandle;

        try {
            // Open file once and keep it open for all chunks
            fileHandle = await fs.promises.open(filePath, 'r');

            while (currentOffset < fileSize) {
                // Calculate how much to upload: from currentOffset to endOffset (or end of file)
                const chunkSize = Math.min(endOffset - currentOffset, fileSize - currentOffset);

                console.log(`📦 Chunk ${chunkNumber}: uploading bytes ${currentOffset} to ${currentOffset + chunkSize} (${(chunkSize / 1024 / 1024).toFixed(2)} MB)`);

                // Read chunk from file
                const chunkBuffer = Buffer.alloc(chunkSize);
                const readResult = await fileHandle.read(chunkBuffer, 0, chunkSize, currentOffset);

                // Verify we read the expected number of bytes
                console.log(`📖 Read ${readResult.bytesRead} bytes (expected ${chunkSize})`);
                if (readResult.bytesRead !== chunkSize) {
                    throw new Error(`Read mismatch: expected ${chunkSize} bytes but read ${readResult.bytesRead}`);
                }

                // Log first and last few bytes for debugging
                const firstBytes = chunkBuffer.slice(0, 16).toString('hex');
                const lastBytes = chunkBuffer.slice(-16).toString('hex');
                console.log(`🔍 Buffer first 16 bytes: ${firstBytes}`);
                console.log(`🔍 Buffer last 16 bytes: ${lastBytes}`);
                console.log(`🔍 Buffer actual length: ${chunkBuffer.length}`);

                // Upload this chunk with retry logic
                let uploadSuccess = false;
                let retries = 0;
                const maxRetries = 3;

                while (!uploadSuccess && retries < maxRetries) {
                    try {
                        console.log(`📤 Sending chunk to Meta API...`);
                        console.log(`   - URL: https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`);
                        console.log(`   - Session ID: ${uploadSessionId}`);
                        console.log(`   - Start offset: ${currentOffset}`);
                        console.log(`   - Chunk size: ${chunkBuffer.length}`);

                        // Meta requires chunks to be sent as multipart/form-data with 'video_file_chunk' field
                        const formData = new FormData();
                        formData.append('video_file_chunk', chunkBuffer, {
                            filename: 'chunk',
                            contentType: 'application/octet-stream'
                        });

                        const uploadResponse = await axios.post(
                            `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/advideos`,
                            formData,
                            {
                                params: {
                                    upload_phase: 'transfer',
                                    upload_session_id: uploadSessionId,
                                    start_offset: currentOffset,
                                    access_token: process.env.META_ACCESS_TOKEN
                                },
                                headers: {
                                    ...formData.getHeaders()
                                },
                                maxContentLength: Infinity,
                                maxBodyLength: Infinity,
                                timeout: 300000, // 5 minutes per chunk
                            }
                        );

                        console.log(`✅ Chunk ${chunkNumber} uploaded successfully`);
                        console.log(`📥 Response:`, JSON.stringify(uploadResponse.data, null, 2));
                        uploadSuccess = true;

                        // Update offset for next chunk
                        currentOffset += chunkSize;
                        chunkNumber++;

                        // Check if Meta provides new offsets for next chunk
                        if (uploadResponse.data.start_offset !== undefined && uploadResponse.data.end_offset !== undefined) {
                            startOffset = parseInt(uploadResponse.data.start_offset, 10);
                            endOffset = parseInt(uploadResponse.data.end_offset, 10);
                            console.log(`📍 Next chunk range: ${startOffset} - ${endOffset} (${((endOffset - startOffset) / 1024 / 1024).toFixed(2)} MB)`);
                        }

                    } catch (error) {
                        retries++;
                        console.error(`❌ Chunk ${chunkNumber} upload error (attempt ${retries}/${maxRetries}):`);
                        console.error(`   - Status: ${error.response?.status}`);
                        console.error(`   - Status Text: ${error.response?.statusText}`);
                        console.error(`   - Error Message: ${error.message}`);
                        console.error(`   - Response Headers:`, error.response?.headers);
                        console.error(`   - Response Data:`, JSON.stringify(error.response?.data, null, 2));

                        if (retries < maxRetries) {
                            console.log(`⚠️ Retrying chunk ${chunkNumber} in ${2000 * retries}ms...`);
                            await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Exponential backoff
                        } else {
                            console.error(`❌ Chunk ${chunkNumber} failed after ${maxRetries} attempts`);
                            throw error;
                        }
                    }
                }

                // If we've uploaded everything, break
                if (currentOffset >= fileSize) {
                    console.log(`✅ All chunks uploaded (${currentOffset} / ${fileSize} bytes)`);
                    break;
                }
            }
        } finally {
            // Always close file handle
            if (fileHandle) {
                try {
                    await fileHandle.close();
                    console.log(`📁 File closed`);
                } catch (closeError) {
                    console.error('⚠️ Error closing file handle:', closeError.message);
                }
            }
        }

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
                },
                timeout: 30000
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
