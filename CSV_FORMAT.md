# CSV Ad Copy Format Guide

## Updated Format (Now with Custom Landing Page URLs!)

### CSV Columns

Your CSV file should have **6 columns** in this exact order:

| Column | Name | Required | Example | Description |
|--------|------|----------|---------|-------------|
| A | BookID | ✅ Yes | `3106` | Your book identifier |
| B | Variation | ❌ No | `v1` or leave empty | Ad variation name (auto-generated if empty) |
| C | PrimaryText | ✅ Yes | `"Discover steamy romance..."` | Main ad text (max 125 chars) |
| D | Headline | ✅ Yes | `"Hot New Release"` | Ad headline (max 40 chars) |
| E | Description | ✅ Yes | `"Get it now!"` | Ad description (max 30 chars) |
| F | BaseLandingPageURL | ✅ Yes | `"https://sparkereader.com/481/"` | Base URL for landing page |

### Landing Page URL Generation

**The final landing page URL** is created by combining:
```
BaseLandingPageURL + BookID
```

**Example:**
- BookID: `3106`
- BaseLandingPageURL: `https://sparkereader.com/481/`
- **Result**: `https://sparkereader.com/481/3106`

### Sample CSV File

```csv
BookID,Variation,PrimaryText,Headline,Description,BaseLandingPageURL
3106,v1,"Discover steamy romance in our latest collection","Hot New Release","Get it now!","https://sparkereader.com/481/"
3106,v2,"Fall in love with our latest bestseller","Romance Awaits","Download now!","https://sparkereader.com/481/"
3107,,"Mystery and suspense await you","Thrilling Mystery","Read today!","https://sparkereader.com/481/"
3108,,"Another single variation book","Great Story","Check it out!","https://sparkereader.com/482/"
```

### Important Notes

1. **Quotes for Text**: If your text contains commas, wrap it in double quotes
2. **Variation Column**: Can be left empty - system will auto-generate `v1`, `v2`, etc.
3. **Trailing Slash**: The system automatically adds `/` if your BaseLandingPageURL doesn't end with one
4. **Multiple Books**: You can have different base URLs for different books in the same CSV

### Examples

#### Same base URL for all variations of one book:
```csv
BookID,Variation,PrimaryText,Headline,Description,BaseLandingPageURL
3106,v1,"Text 1","Headline 1","Desc 1","https://sparkereader.com/481/"
3106,v2,"Text 2","Headline 2","Desc 2","https://sparkereader.com/481/"
3106,v3,"Text 3","Headline 3","Desc 3","https://sparkereader.com/481/"
```
All three ads will point to different variations but same landing page base: `https://sparkereader.com/481/3106`

#### Different books with different base URLs:
```csv
BookID,Variation,PrimaryText,Headline,Description,BaseLandingPageURL
3106,,"Book 3106 ad copy","Great Book","Read now","https://sparkereader.com/481/"
3107,,"Book 3107 ad copy","Amazing Story","Get it","https://sparkereader.com/482/"
3108,,"Book 3108 ad copy","Must Read","Download","https://sparkereader.com/483/"
```
Results:
- Book 3106 → `https://sparkereader.com/481/3106`
- Book 3107 → `https://sparkereader.com/482/3107`
- Book 3108 → `https://sparkereader.com/483/3108`

### Backward Compatibility

If you leave the `BaseLandingPageURL` column empty, the system will fall back to the old format:
```
https://yourdomain.com/lp1?book_id={BookID}
```

But it's recommended to always provide the `BaseLandingPageURL` for cleaner URLs.

### Testing Your CSV

1. Download the sample CSV from the dashboard ("Download Sample CSV" button)
2. Edit it with your book data
3. Upload and test with a small batch first
4. Check the generated landing page URLs in the ad preview

### Common Mistakes to Avoid

❌ **Wrong**: Missing the BaseLandingPageURL column entirely
✅ **Right**: Include all 6 columns even if some are empty

❌ **Wrong**: `https://sparkereader.com/481/3106` (including bookId in base URL)
✅ **Right**: `https://sparkereader.com/481/` (base URL only, system adds bookId)

❌ **Wrong**: Forgetting quotes around text with commas: `Hello, world`
✅ **Right**: Using quotes: `"Hello, world"`
