# Video Upload Support - Now Live!

## ✅ What's New

Your Meta Ads Launcher now supports **MP4 and MOV video uploads** for bulk ad creation!

## How It Works

### 1. Upload Videos

Just like images, you can now upload video files:

- **Supported formats**: MP4, MOV
- **Max size**: 1GB per video (Meta's limit)
- **Upload location**: Same "Upload Creative Files" area in the dashboard

### 2. System Automatically Handles Everything

When you upload videos:

1. **Videos are uploaded to Meta** → Get video IDs back
2. **System detects** video vs image automatically
3. **Creates the right ad type**:
   - Videos → Video ads with `video_data`
   - Images → Image ads with `link_data`

### 3. Mixed Uploads Work Too!

You can upload **images AND videos** in the same batch:
- Upload 2 JPGs + 3 MP4s → System handles all 5 correctly
- Each gets the right ad creative type

## Testing Video Uploads

### Step 1: Upload Videos

1. Go to "Creative Upload & Ad Creation" tab
2. Select your AdSet
3. **Upload MP4 or MOV files** (same as you did before, but this time they'll work!)
4. Upload your CSV with ad copy

### Step 2: Create Ads

Click "Create Ads" - the system will:
- Upload each video to Meta
- Get video IDs back
- Create video ads automatically

### What You'll See in Console

```
🎥 Uploading video to Meta: my-video.mp4
📊 Video size: 15.3 MB
✅ Video uploaded successfully! Video ID: 123456789012345
📝 Creating ad: book_123_v1_12345678
🎬 Creative type: VIDEO (123456789012345)
✅ Created ad: book_123_v1_12345678 (ad_id_here)
```

## Video Ad Structure

Video ads are created with:
- **Video player** with your uploaded video
- **Primary text** (message above video)
- **Headline** (title)
- **Description** (link description)
- **Call-to-action button** → Links to your landing page
- **Landing page URL** from CSV (now with custom base URLs!)

## Troubleshooting

### "Video upload failed"

**Possible causes:**
- File too large (>1GB)
- Unsupported format (use MP4 or MOV)
- Meta API rate limiting (wait a minute and try again)

### "No creative IDs returned"

Make sure you're uploading:
- **Images**: JPG, PNG
- **Videos**: MP4, MOV

Other file types won't work.

### Video Processing Time

Videos may take 30-60 seconds to process on Meta's servers. The system waits for the video ID, so this is normal.

## Technical Details

### How System Detects Video vs Image

The system looks at the creative ID:
- **Video IDs**: Numeric, 15+ digits (e.g., `123456789012345`)
- **Image hashes**: Alphanumeric, shorter (e.g., `abc123xyz`)

### Video Upload Process

1. File uploaded to your server
2. Server uploads to Meta Ads API
3. Meta returns video ID
4. Video ID used to create ad
5. Ad created in PAUSED status

### API Endpoints Used

- **Upload**: `POST /api/creatives/upload-for-adset`
- **Video Service**: `services/videoUploadService.js`
- **Ad Creation**: `POST /api/campaigns/create-ads-batch`

## Example Workflow

### Upload 2 Images + 2 Videos

**Files:**
- `book-cover-1.jpg` → Upload → Image hash: `abc123`
- `book-cover-2.jpg` → Upload → Image hash: `def456`
- `promo-video-1.mp4` → Upload → Video ID: `123456789012345`
- `promo-video-2.mp4` → Upload → Video ID: `987654321098765`

**CSV:**
```csv
BookID,Variation,PrimaryText,Headline,Description,BaseLandingPageURL
3106,v1,"Check out this amazing book!","Best Seller","Read now","https://sparkereader.com/481/"
3106,v2,"Fall in love with this story","Romance Awaits","Get it","https://sparkereader.com/481/"
```

**Result:** 8 ads created
- 2 images × 2 ad copy = 4 image ads
- 2 videos × 2 ad copy = 4 video ads
- All with landing pages: `https://sparkereader.com/481/3106`

## Ready to Test!

Pull the latest code and try uploading videos:

```powershell
git pull origin claude/meta-ads-launcher-011CUXq2FCi5MQXQuD8B17sP
npm start
```

Then upload those MP4 files you tried earlier - they'll work now! 🎥✨
