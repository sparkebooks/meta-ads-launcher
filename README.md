# Meta Ads Launcher

A comprehensive automated system for creating and managing Meta (Facebook/Instagram) ad campaigns for romance book apps with intelligent performance monitoring and auto-pause capabilities.

## 🚀 Features

### ✅ Creative Management
- **Organized File Upload**: Upload images and videos into book-specific folders
- **Automatic Organization**: Files are sorted by Book ID and campaign type
- **Format Support**: JPG, PNG, MP4, MOV files up to 50MB each
- **Metadata Extraction**: Automatic dimension and duration detection

### ✅ Automated Ad Creation
- **Meta API Integration**: Direct integration with Facebook Business API
- **Bulk Campaign Creation**: Create multiple ads from creative combinations
- **Smart Naming**: Consistent, automated ad and campaign naming
- **Landing Page URLs**: Automatic URL parameter generation for tracking

### ✅ Google Sheets Integration
- **Ad Copy Management**: Pull headlines, primary text, and descriptions from Google Sheets
- **Campaign Configuration**: Centralized budget and targeting settings
- **Landing Page Setup**: URL parameter configuration per book
- **Bulk Operations**: Upload multiple ad variations at once

### ✅ Performance Monitoring
- **Real-time Tracking**: Monitor CTR, CPA, retention rates, and more
- **Supabase Integration**: Pull mobile app analytics for retention metrics
- **Automated Pausing**: Pause underperforming ads based on configurable thresholds
- **Multi-metric Analysis**: Combines Meta ads data with app retention data

### ✅ Dashboard Interface
- **Web-based Dashboard**: Clean, responsive interface for campaign management
- **Real-time Updates**: Live status updates and performance metrics
- **Manual Controls**: Start/stop monitoring, trigger checks, pause campaigns
- **Visual Analytics**: Performance summaries and underperforming ad alerts

## 📋 Prerequisites

### Required Accounts & APIs:
1. **Meta Business Account** with Ads API access
2. **Supabase** database for mobile app analytics (optional)
3. **Node.js** (version 16 or higher)

### Required Permissions:
- Meta Ads API: `ads_management`, `ads_read`, `business_management`
- Supabase: Read access to user analytics tables (optional)

## 🛠️ Installation

1. **Clone and Install Dependencies**:
```bash
cd meta-ads-launcher
npm install
```

2. **Environment Configuration**:
```bash
cp .env.example .env
```

Edit `.env` with your API credentials:
```env
# Meta/Facebook API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_long_lived_access_token
META_AD_ACCOUNT_ID=act_your_ad_account_id
META_PAGE_ID=your_facebook_page_id

# Supabase (optional - for performance monitoring)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Settings
BASE_LANDING_PAGE_URL=https://yourdomain.com
PORT=3000
```

3. **CSV Ad Copy Setup**:

Create a CSV file with this structure:

**CSV Format** (columns A-E):
| BookID | Variation | PrimaryText | Headline | Description |
|--------|-----------|-------------|----------|-------------|
| book_123 | v1 | "Discover steamy romance..." | "Hot New Release" | "Get it now!" |
| book_123 | v2 | "Fall in love with our latest..." | "Romance Awaits" | "Download now!" |
| book_456 | *(empty)* | "Mystery and suspense await you" | "Thrilling Mystery" | "Read today!" |

**Variation Column (Column B)**:
- **Optional**: Can be left empty if you only have one variation per book
- **Auto-generated**: Empty variations will be automatically named `v1`, `v2`, etc.
- **Manual**: You can specify your own variation names like `v1`, `test_a`, `headline_variant`, etc.

**Landing Page Generation**:
Landing pages are automatically generated using the format: `https://yourdomain.com/lp1?book_id=book_123`
- The BookID from column A is used as the `book_id` URL parameter
- Call-to-action is automatically set to "LEARN_MORE"
- Your landing page script will read this parameter to display the correct content
- All ads use the same `/lp1` landing page with different `book_id` parameters

**CSV Requirements**:
- File must be in CSV format (.csv extension)
- First row can be headers (will be automatically skipped)
- Maximum file size: 5MB
- Required columns: BookID, Variation, PrimaryText, Headline, Description

4. **Database Setup** (Supabase):

Create these tables in your Supabase database:

```sql
-- User analytics table
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    ad_id VARCHAR(50),
    campaign_id VARCHAR(50),
    adset_id VARCHAR(50),
    install_date TIMESTAMP,
    day_1_retention BOOLEAN,
    day_3_retention BOOLEAN,
    day_7_retention BOOLEAN,
    session_count INTEGER,
    total_time_spent INTEGER,
    revenue_generated DECIMAL,
    ltv_prediction DECIMAL,
    last_active_date TIMESTAMP
);

-- Performance summary table (updated by cron)
CREATE TABLE ad_performance_summary (
    ad_id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50),
    adset_id VARCHAR(50),
    install_date DATE,
    total_installs INTEGER,
    day_1_retention_rate DECIMAL,
    day_3_retention_rate DECIMAL,
    day_7_retention_rate DECIMAL,
    avg_session_count DECIMAL,
    avg_time_spent DECIMAL,
    total_revenue DECIMAL,
    avg_ltv DECIMAL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ad pause log
CREATE TABLE ad_pause_log (
    id SERIAL PRIMARY KEY,
    ad_id VARCHAR(50),
    pause_reason TEXT,
    pause_date TIMESTAMP,
    metrics_at_pause JSONB,
    automated BOOLEAN DEFAULT true
);
```

## 🚀 Usage

### Starting the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Open your browser to `http://localhost:3000`

### Basic Workflow

1. **Upload Creatives**:
   - Go to "Upload Creatives" tab
   - Enter Book ID (e.g., "book_123")
   - Choose campaign type (e.g., "launch", "retargeting")
   - Upload your image and video files
   - Files are automatically organized into folders

2. **Prepare Ad Copy**:
   - Create a CSV file with your ad variations
   - Include primary text, headlines, descriptions in the correct format
   - Download the sample CSV from the dashboard if needed

3. **Create Campaign**:
   - Click "Upload & Create Campaign"
   - System automatically creates ads for each creative + copy combination
   - Ads start in PAUSED status for review

4. **Monitor Performance**:
   - Start the monitoring system
   - Set performance thresholds
   - System automatically pauses underperforming ads
   - View real-time dashboard with metrics

### Performance Monitoring

The system monitors these key metrics:

**Meta Ads Metrics**:
- Click-through Rate (CTR)
- Cost Per Acquisition (CPA)  
- Cost Per Mille (CPM)
- Conversion rates

**Mobile App Metrics** (from Supabase):
- Day 1, 3, 7 retention rates
- Session count per user
- Time spent in app
- Revenue per user

**Auto-pause Triggers**:
- CTR < 0.8%
- CPA > $25
- Day 1 retention < 30%
- Day 3 retention < 15%
- Average session count < 2

### API Endpoints

#### Creative Management
- `POST /api/creatives/upload` - Upload creative files
- `GET /api/creatives/folders` - Get organized folders
- `GET /api/creatives/folder/:bookId/:campaignType` - Get files in folder

#### Campaign Management  
- `POST /api/campaigns/create` - Create new campaign
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns/:id/pause` - Pause campaign

#### Monitoring
- `GET /api/monitoring/status` - Get monitoring status
- `POST /api/monitoring/start` - Start monitoring
- `POST /api/monitoring/stop` - Stop monitoring
- `POST /api/monitoring/check` - Trigger manual check
- `GET /api/monitoring/underperforming` - Get underperforming ads

#### CSV Ad Copy Integration
- `POST /api/csv/upload-ad-copy` - Upload and parse CSV file with ad copy data
- `GET /api/csv/sample-format` - Download sample CSV file with correct format
- `POST /api/csv/validate-csv` - Validate CSV format and content

## 🔧 Configuration

### Performance Thresholds

Update thresholds via the dashboard or environment variables:

```env
MIN_D1_RETENTION=0.30    # 30% Day 1 retention
MIN_D3_RETENTION=0.15    # 15% Day 3 retention  
MIN_D7_RETENTION=0.08    # 8% Day 7 retention
MIN_SESSION_COUNT=2      # Minimum sessions per user
MIN_TIME_SPENT=300       # 5 minutes minimum
MIN_CTR_THRESHOLD=0.8    # 0.8% CTR minimum
MAX_CPA_THRESHOLD=25.0   # $25 maximum CPA
```

### Monitoring Frequency

```env
PERFORMANCE_CHECK_INTERVAL_HOURS=2  # Check every 2 hours
```

## 📊 Dashboard Features

### Upload Tab
- Drag & drop file uploads
- Automatic folder organization  
- Real-time upload progress
- File type validation

### Campaigns Tab
- Active campaign overview
- Campaign performance metrics
- Pause/activate controls
- Recent activity log

### Monitoring Tab  
- Underperforming ads list
- Performance threshold settings
- Real-time monitoring status
- Manual check triggers

### Settings Tab
- API connection testing
- System log viewer
- Configuration validation

## 🔍 Troubleshooting

### Common Issues

1. **Meta API Connection Failed**:
   - Verify access token is valid and has required permissions
   - Check ad account ID format (should start with "act_")
   - Ensure app has been approved for ads management

2. **Google Sheets Access Denied**:
   - Verify service account email has edit access to spreadsheet
   - Check private key format (should include newlines)
   - Ensure Google Sheets API is enabled

3. **Supabase Connection Issues**:
   - Verify service role key has read access to required tables
   - Check table names match the schema
   - Ensure RLS policies allow service role access

4. **File Upload Failures**:
   - Check file size limits (50MB max)
   - Verify supported file types
   - Ensure upload directory has write permissions

### Logs

System logs are available at:
- Performance monitoring: `/logs/performance_monitor.log`
- Campaign actions: `/logs/campaign_actions.log`  
- Error logs: Check console output

## 🚦 Production Deployment

### Environment Setup
```bash
NODE_ENV=production
PORT=3000
```

### Process Management (PM2)
```bash
npm install -g pm2
pm2 start server.js --name "meta-ads-launcher"
pm2 startup
pm2 save
```

### Security Considerations
- Use HTTPS in production
- Implement rate limiting
- Regular token rotation
- Monitor API usage limits
- Backup database regularly

## 📈 Scaling

### Performance Optimization
- Enable Redis caching for API responses
- Implement database connection pooling
- Use CDN for static assets
- Add database indexing for analytics queries

### Multi-account Setup
- Separate .env files per account
- Multiple server instances
- Load balancer configuration
- Centralized monitoring dashboard

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review system logs
3. Test API connections via dashboard
4. Verify Google Sheets configuration

---

**🚀 Meta Ads Launcher - Automated Romance Book Marketing at Scale**