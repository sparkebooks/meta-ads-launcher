# Video Upload Support Implementation

## Overview

This document outlines the changes needed to add MP4/MOV video upload support to the Meta Ads Launcher bulk ad creation system.

## Current State

- ✅ Images (JPG/PNG) are uploaded to Meta and image hashes are returned
- ❌ Videos (MP4/MOV) are saved locally but NOT uploaded to Meta
- ❌ No video IDs are returned, causing "No creative IDs" error

## Solution

### 1. New Service Created

**File:** `services/videoUploadService.js`

This service provides:
- `uploadVideoToMeta(filePath, fileName)` - Uploads video to Meta Ads
- `checkVideoStatus(videoId)` - Checks if video is processed and ready
- `createAdWithVideo(adData)` - Creates ad using video creative

### 2. Changes Needed to `routes/creatives.js`

Update the `/upload-for-adset` endpoint to handle videos:

```javascript
// Around line 138, replace the image-only code with:

for (const file of req.files) {
    try {
        let metaHash = null;
        let metaVideoId = null;

        // Handle IMAGE uploads
        if (file.mimetype.startsWith('image/')) {
            console.log(`🖼️ Uploading image to Meta: ${file.originalname}`);
            // ... existing image upload code ...
            metaHash = imageData.hash; // Save image hash
        }

        // Handle VIDEO uploads (NEW)
        else if (file.mimetype.startsWith('video/')) {
            console.log(`🎥 Uploading video to Meta: ${file.originalname}`);

            const videoUploadService = require('../services/videoUploadService');
            metaVideoId = await videoUploadService.uploadVideoToMeta(
                file.path,
                file.originalname
            );

            console.log(`✅ Video uploaded, ID: ${metaVideoId}`);
        }

        const fileInfo = {
            id: uuidv4(),
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            adsetId: adsetId,
            metaHash: metaHash,        // For images
            metaVideoId: metaVideoId,  // For videos (NEW)
            uploadedAt: new Date().toISOString(),
            status: 'ready'
        };

        uploadedFiles.push(fileInfo);
    }
}

// Update the response to include video IDs:
const successfulUploads = uploadedFiles.filter(f =>
    f.status === 'ready' && (f.metaHash || f.metaVideoId)
);

res.json({
    success: successfulUploads.length > 0,
    message: `Creative files processed: ${successfulUploads.length} successful`,
    creativeIds: successfulUploads.map(f => f.metaHash || f.metaVideoId),
    files: uploadedFiles,
    totalFiles: uploadedFiles.length
});
```

### 3. Changes Needed to `routes/campaigns.js`

Update the ad creation code to handle video creatives:

```javascript
// Around line 488, in the create-ads-batch endpoint:

const adData = {
    name: adName,
    adset_id: adsetId,
    creative: {}
};

// Check if this is a video or image
if (creativeId.startsWith('video_')) {
    // Video creative
    adData.creative = {
        object_story_spec: {
            page_id: process.env.META_PAGE_ID,
            video_data: {
                video_id: creativeId,
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
    };
} else {
    // Image creative (existing code)
    adData.creative = {
        object_story_spec: {
            page_id: process.env.META_PAGE_ID,
            link_data: {
                link: adCopy.landingPageUrl,
                message: adCopy.primaryText,
                name: adCopy.headline,
                description: adCopy.description,
                call_to_action: {
                    type: adCopy.callToAction || 'LEARN_MORE'
                },
                image_hash: creativeId
            }
        }
    };
}

const newAd = await metaService.createAd(adData);
```

## Testing Steps

Once implemented:

1. **Test Image Upload** (should still work):
   - Upload JPG/PNG files
   - Verify image hashes are returned
   - Create ads successfully

2. **Test Video Upload** (new functionality):
   - Upload MP4/MOV files
   - Verify video IDs are returned
   - Create ads successfully

3. **Test Mixed Upload** (images + videos):
   - Upload both JPG and MP4 files
   - Verify both types are handled correctly
   - Create ads with mixed creatives

## API Notes

### Video Upload Requirements

- **Max file size**: 1GB (Meta's limit)
- **Supported formats**: MP4, MOV
- **Processing time**: Videos may take 30-60 seconds to process on Meta's servers
- **Status check**: Use `checkVideoStatus()` to verify video is ready before creating ads

### Video ID Format

Video IDs from Meta typically look like:
- `123456789012345` (numeric)
- Different from image hashes which are alphanumeric

## Rollout Plan

**Phase 1: Preparation** (Current)
- ✅ Created `videoUploadService.js`
- ✅ Documented implementation plan

**Phase 2: Implementation**
- Update `routes/creatives.js` with video upload code
- Update `routes/campaigns.js` with video ad creation code
- Test with sample videos

**Phase 3: Testing**
- Test image uploads (ensure nothing broke)
- Test video uploads
- Test mixed uploads
- Verify ads are created correctly

**Phase 4: Deployment**
- Commit changes
- Update documentation
- Deploy to production

## Questions to Consider

1. **Video processing delay**: Should we check video status before allowing ad creation?
2. **File size limits**: Should we warn users about large video uploads?
3. **Thumbnail selection**: Should we allow users to choose video thumbnails?
4. **Aspect ratios**: Should we validate video aspect ratios (1:1, 9:16, 16:9)?

## Ready to Implement?

When user confirms image upload test works, apply these changes to add video support.
