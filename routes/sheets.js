const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Initialize Google Sheets API
const sheets = google.sheets('v4');

async function getGoogleAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return await auth.getClient();
}

// Generate landing page URL with book_id parameter
function generateLandingPageUrl(bookId) {
  const baseUrl = process.env.BASE_LANDING_PAGE_URL || 'https://yourdomain.com';
  return `${baseUrl}/lp1?book_id=${bookId}`;
}

// Get ad copy variations from Google Sheets
router.get('/ad-copy/:bookId?', async (req, res) => {
  try {
    const { bookId } = req.params;
    const auth = await getGoogleAuth();

    // Read from the main ad copy sheet
    const response = await sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'AdCopy!A:E', // Columns: BookID, Variation, PrimaryText, Headline, Description
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ adCopy: [], message: 'No data found in sheet' });
    }

    // Parse the data
    const adCopyData = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const adCopyItem = {
        bookId: row[0] || '',
        variation: row[1] || `variation_${i}`,
        primaryText: row[2] || '',
        headline: row[3] || '',
        description: row[4] || '',
        callToAction: 'LEARN_MORE', // Default CTA
        landingPageUrl: generateLandingPageUrl(row[0]) // Auto-generate landing page
      };

      // Filter by bookId if specified
      if (!bookId || adCopyItem.bookId === bookId) {
        adCopyData.push(adCopyItem);
      }
    }

    res.json({
      adCopy: adCopyData,
      totalVariations: adCopyData.length,
      bookId: bookId || 'all'
    });

  } catch (error) {
    console.error('Error reading from Google Sheets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ad copy from URL-based Google Sheets (for simplified UI)
router.post('/ad-copy-from-url', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    const auth = await getGoogleAuth();

    // Read from the main ad copy sheet
    const response = await sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: spreadsheetId,
      range: 'Sheet1!A:E', // Assuming first sheet, columns: BookID, Variation, PrimaryText, Headline, Description
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ adCopy: [], message: 'No data found in sheet' });
    }

    // Parse the data (skip header row)
    const adCopyData = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Skip empty rows
      if (!row[0] && !row[2] && !row[3]) continue;
      
      const adCopyItem = {
        bookId: row[0] || '',
        variation: row[1] || `variation_${i}`,
        primaryText: row[2] || '',
        headline: row[3] || '',
        description: row[4] || '',
        callToAction: 'LEARN_MORE', // Default CTA
        landingPageUrl: generateLandingPageUrl(row[0]) // Auto-generate landing page
      };

      adCopyData.push(adCopyItem);
    }

    res.json({
      adCopy: adCopyData,
      totalVariations: adCopyData.length,
      spreadsheetId: spreadsheetId
    });

  } catch (error) {
    console.error('Error reading from Google Sheets URL:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Make sure the Google Sheets URL is public and accessible'
    });
  }
});

// Update ad copy in Google Sheets (simplified)
router.post('/ad-copy', async (req, res) => {
  try {
    const { bookId, variation, primaryText, headline, description } = req.body;
    const auth = await getGoogleAuth();

    // Find the next empty row
    const response = await sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'AdCopy!A:A',
    });

    const nextRow = (response.data.values?.length || 1) + 1;

    // Add the new ad copy (without CallToAction column)
    await sheets.spreadsheets.values.update({
      auth: auth,
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `AdCopy!A${nextRow}:E${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[bookId, variation, primaryText, headline, description]]
      }
    });

    res.json({ 
      message: 'Ad copy added successfully', 
      row: nextRow,
      landingPageUrl: generateLandingPageUrl(bookId)
    });

  } catch (error) {
    console.error('Error updating Google Sheets:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;