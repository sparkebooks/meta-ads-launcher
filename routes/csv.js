const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Configure multer for CSV file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'csv');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'adcopy-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Generate landing page URL with book_id parameter
function generateLandingPageUrl(bookId) {
  const baseUrl = process.env.BASE_LANDING_PAGE_URL || 'https://yourdomain.com';
  return `${baseUrl}/lp1?book_id=${bookId}`;
}

// Upload and parse CSV file
router.post('/upload-ad-copy', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvFilePath = req.file.path;
    const adCopyData = [];

    // First pass: read all rows to understand the data structure
    const allRows = [];
    const bookVariationCounts = {};

    const stream = fs.createReadStream(csvFilePath)
      .pipe(csv({
        headers: ['bookId', 'variation', 'primaryText', 'headline', 'description'],
        skipEmptyLines: true
      }));

    // Read all rows first
    for await (const row of stream) {
      // Skip header row if it contains column names
      if (row.bookId === 'BookID' || row.bookId === 'bookId') {
        continue;
      }

      // Skip empty rows
      if (!row.bookId && !row.primaryText && !row.headline) {
        continue;
      }

      allRows.push(row);
    }

    // Second pass: process rows and assign variation names
    for (const row of allRows) {
      // Auto-generate variation name if empty
      let variationName = row.variation;
      if (!variationName || variationName.trim() === '') {
        // Track how many variations we've seen for this bookId
        if (!bookVariationCounts[row.bookId]) {
          bookVariationCounts[row.bookId] = 0;
        }
        bookVariationCounts[row.bookId]++;
        
        // Use incremental naming per book
        variationName = `v${bookVariationCounts[row.bookId]}`;
      }

      const adCopyItem = {
        bookId: row.bookId || '',
        variation: variationName,
        primaryText: row.primaryText || '',
        headline: row.headline || '',
        description: row.description || '',
        callToAction: 'LEARN_MORE', // Default CTA
        landingPageUrl: generateLandingPageUrl(row.bookId) // Auto-generate landing page
      };

      adCopyData.push(adCopyItem);
    }

    // Clean up uploaded file
    fs.unlinkSync(csvFilePath);

    res.json({
      success: true,
      adCopy: adCopyData,
      totalVariations: adCopyData.length,
      message: `Successfully parsed ${adCopyData.length} ad copy variations from CSV`
    });

  } catch (error) {
    console.error('Error processing CSV file:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: error.message,
      message: 'Error processing CSV file. Please check the format and try again.'
    });
  }
});

// Get sample CSV format
router.get('/sample-format', (req, res) => {
  const sampleCSV = `BookID,Variation,PrimaryText,Headline,Description
book_123,v1,"Discover steamy romance in our latest collection","Hot New Release","Get it now!"
book_123,v2,"Fall in love with our latest bestseller","Romance Awaits","Download now!"
book_456,,"Mystery and suspense await you","Thrilling Mystery","Read today!"
book_789,,"Another single variation book","Great Story","Check it out!"`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ad-copy-sample.csv"');
  res.send(sampleCSV);
});

// Validate CSV format (for client-side validation)
router.post('/validate-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvFilePath = req.file.path;
    const errors = [];
    const warnings = [];
    let rowCount = 0;
    let validRows = 0;

    // Parse CSV file for validation
    const stream = fs.createReadStream(csvFilePath)
      .pipe(csv({
        headers: ['bookId', 'variation', 'primaryText', 'headline', 'description'],
        skipEmptyLines: true
      }));

    for await (const row of stream) {
      rowCount++;

      // Skip header row
      if (row.bookId === 'BookID' || row.bookId === 'bookId') {
        continue;
      }

      // Check required fields
      if (!row.bookId) {
        errors.push(`Row ${rowCount}: BookID is required`);
      }
      if (!row.primaryText) {
        warnings.push(`Row ${rowCount}: PrimaryText is empty`);
      }
      if (!row.headline) {
        warnings.push(`Row ${rowCount}: Headline is empty`);
      }

      // Check field lengths (Meta Ads limits)
      if (row.primaryText && row.primaryText.length > 125) {
        warnings.push(`Row ${rowCount}: PrimaryText too long (${row.primaryText.length}/125 chars)`);
      }
      if (row.headline && row.headline.length > 40) {
        warnings.push(`Row ${rowCount}: Headline too long (${row.headline.length}/40 chars)`);
      }
      if (row.description && row.description.length > 30) {
        warnings.push(`Row ${rowCount}: Description too long (${row.description.length}/30 chars)`);
      }

      if (row.bookId && (row.primaryText || row.headline)) {
        validRows++;
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(csvFilePath);

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      totalRows: rowCount,
      validRows,
      message: errors.length === 0 ? 
        `CSV is valid with ${validRows} rows ready for processing` : 
        `CSV has ${errors.length} errors that need to be fixed`
    });

  } catch (error) {
    console.error('Error validating CSV file:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: error.message,
      message: 'Error validating CSV file'
    });
  }
});

module.exports = router;