# Running Meta Ads Launcher Locally

## Quick Setup

### 1. Pull Latest Code

Open PowerShell:

```powershell
cd C:\Users\robin\Desktop\aidev\claudecodeproject1\meta-ads-launcher
git pull origin claude/meta-ads-launcher-011CUXq2FCi5MQXQuD8B17sP
```

### 2. Update Your `.env` File

Open `.env` in your editor and update this line:

```env
META_ACCESS_TOKEN=EAAXqZCooBNBYBPy6lFrCkioIZBniAD23cKmhUGRrooNslLpxoef1mKVBf3B1Ri4kfqy93xYaVZAAZAbAZCcqqZCsUT6jWd4QT6q0Lk57pkZAoloO0m5unD8Ks2nhq0jL4UvqtZAjVhC3CltPwC6DG7ZA8doSsCtMQlcgZAYsKLzoyWvDoM5hMKhMS5YI2w6r3p65QAmuY8I2ZBiFePdBgZDZD
```

**Token expires:** December 26, 2025

### 3. Start the Server

```powershell
npm start
```

Or for development mode with auto-reload:

```powershell
npm run dev
```

You should see:

```
🚀 Meta Ads Launcher running on http://localhost:3000
```

### 4. Open in Your Browser

Go to: **http://localhost:3000**

---

## The Dashboard

Once the server is running, your browser will show the Meta Ads Launcher dashboard with these tabs:

### 📤 Upload Creatives Tab
- Upload images/videos for your book campaigns
- Organize by Book ID and campaign type

### 📊 Campaigns Tab
- View all your Meta campaigns
- See campaign performance
- Pause/activate campaigns

### 🎯 Create Ads Tab
- **Bulk ad creation** - This is what you want to test!
- Select adset, upload CSV with ad copy, select creatives
- Creates multiple ads automatically

### 📈 Monitoring Tab
- View performance metrics
- Auto-pause underperforming ads
- Set performance thresholds

---

## Testing Bulk Ad Creation

1. **Go to the "Create Ads" or "Campaigns" tab**
2. **You should see your existing campaigns and adsets**
3. **Use the bulk creation interface** to create multiple ads
4. **All your previous functionality should work**

---

## Troubleshooting

### Server won't start
```powershell
# Make sure dependencies are installed
npm install
```

### Can't access localhost:3000
- Make sure the server is running (you should see the startup message)
- Try http://127.0.0.1:3000 instead
- Check if another app is using port 3000

### "Access denied" errors in the app
- Make sure you updated META_ACCESS_TOKEN in `.env`
- Restart the server after updating `.env`

---

## That's It!

Your Meta Ads Launcher is ready to use. The bulk ad creation feature you already tested should work perfectly with the updated token.
