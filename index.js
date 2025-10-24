const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// ✅ Explicit CORS setup for allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://www.hungryboys.live',
  'https://hungryboys2-0.vercel.app',
  'https://hungryboys-backend-production.up.railway.app',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ✅ Handle preflight requests

app.use(bodyParser.json());

// ✅ Load credentials from environment variable (more secure)
let credentials;
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  // Use base64 encoded credentials from environment variable
  const credentialsJSON = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
  credentials = JSON.parse(credentialsJSON);
} else {
  // Fallback to credentials.json file (for development)
  const credentialsPath = path.join(__dirname, 'credentials.json');
  credentials = require(credentialsPath);
}

// ✅ Authenticate with Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ✅ Google Sheets Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID ;

// ✅ Root route
app.get('/', (req, res) => {
  res.send('✅ Google Sheets API backend is running!');
});

// ✅ Google Sheets Management Endpoints

// Get all sheet tabs
app.get('/api/sheets/tabs', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetsList = response.data.sheets.map(sheet => ({
      name: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
      index: sheet.properties.index
    }));

    res.json(sheetsList);
  } catch (error) {
    console.error('❌ Error getting sheet tabs:', error);
    res.status(500).json({ error: 'Failed to get sheet tabs' });
  }
});

// Create sheet tab
app.post('/api/sheets/create', async (req, res) => {
  try {
    const { universityName, campusName } = req.body;
    const tabName = `${universityName}_${campusName}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 30);

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: tabName,
              gridProperties: {
                rowCount: 1000,
                columnCount: 22  // Increased for new gender-specific columns
              }
            }
          }
        }]
      }
    });

    // Add headers to the new sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
      'maleOrders', 'maleOrderDetails', // New columns for male orders
      'femaleOrders', 'femaleOrderDetails' // New columns for female orders
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:V1`,  // Extended range for new columns
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    // Optional: verify headers were written (silent on success)
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tabName}!A1:V1`
      });
    } catch (vErr) {
      // verification error handled in the following verification block
    }

    // Verify headers were written; if not, attempt a recreate (clear + write) once.
    try {
      const readResp = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tabName}!A1:V1`
      });
      const written = (readResp.data.values && readResp.data.values[0]) || [];
      // If key columns missing, run a recreate to ensure full header set
      if (!written.includes('maleOrders') || !written.includes('femaleOrders')) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${tabName}!A:Z`
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${tabName}!A1:V1`,
          valueInputOption: 'RAW',
          resource: { values: [headers] }
        });
      }
    } catch (verifyErr) {
      console.error('Header verification/recreate fallback failed for', tabName, verifyErr);
    }

    res.json(response.data);
  } catch (error) {
    console.error('❌ Error creating sheet tab:', error);
    res.status(500).json({ error: 'Failed to create sheet tab' });
  }
});

// Delete sheet tab
app.delete('/api/sheets/delete', async (req, res) => {
  try {
    const { universityName, campusName } = req.body;
    const tabName = `${universityName}_${campusName}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 30);

    // First get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === tabName);
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteSheet: {
            sheetId: sheet.properties.sheetId
          }
        }]
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ Error deleting sheet tab:', error);
    res.status(500).json({ error: 'Failed to delete sheet tab' });
  }
});

// Get orders from sheet
app.get('/api/sheets/orders/:sheetName', async (req, res) => {
  try {
    const { sheetName } = req.params;
    const maxRows = req.query.maxRows || 100;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:V${maxRows + 1}`,
    });

    const rows = response.data.values || [];
    const orders = rows.map((row, index) => {
      const order = {};
      const columns = [
        'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
        'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
        'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
        'maleOrders', 'maleOrderDetails', 'femaleOrders', 'femaleOrderDetails'
      ];
      
      columns.forEach((column, colIndex) => {
        order[column] = row[colIndex] || '';
      });
      order.rowNumber = index + 2;
      return order;
    });

    res.json(orders.filter(order => order.firstName));
  } catch (error) {
    console.error('❌ Error getting orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Append order to specific sheet
app.post('/api/sheets/orders/:sheetName', async (req, res) => {
  try {
    const { sheetName } = req.params;
    const { values } = req.body;

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:V`, // Ensure append covers all columns including gender-specific ones
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ Error appending order:', error);
    res.status(500).json({ error: 'Failed to append order' });
  }
});

// Create master sheet
app.post('/api/sheets/master', async (req, res) => {
  try {
    // Check if master sheet already exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const masterExists = spreadsheet.data.sheets.find(s => s.properties.title === 'Master');
    if (masterExists) {
      return res.json({ message: 'Master sheet already exists' });
    }

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: 'Master',
              gridProperties: {
                rowCount: 10000,
                columnCount: 22  // Increased for gender-specific columns
              }
            }
          }
        }]
      }
    });

    // Add headers to master sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
      'maleOrders', 'maleOrderDetails', // New columns for male orders
      'femaleOrders', 'femaleOrderDetails' // New columns for female orders
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master!A1:V1',  // Extended range for gender columns
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ Error creating master sheet:', error);
    res.status(500).json({ error: 'Failed to create master sheet' });
  }
});

// ✅ Recreate master sheet with updated structure
app.post('/api/sheets/recreate-master', async (req, res) => {
  try {
    // Clear the master sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master!A:Z'
    });

    // Add updated headers to master sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
      'maleOrders', 'maleOrderDetails', // New columns for male orders
      'femaleOrders', 'femaleOrderDetails' // New columns for female orders
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master!A1:V1',  // Extended range for new columns
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });
    // Master sheet recreated
    res.json({ message: 'Master sheet recreated successfully with gender column' });
  } catch (error) {
    console.error('❌ Error recreating master sheet:', error);
    res.status(500).json({ error: 'Failed to recreate master sheet' });
  }
});

// ✅ Recreate campus sheet with updated structure
app.post('/api/sheets/recreate-campus/:tabName', async (req, res) => {
  try {
    const { tabName } = req.params;

    // Clear the campus sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:Z`
    });

    // Add updated headers to campus sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
      'maleOrders', 'maleOrderDetails', // New columns for male orders
      'femaleOrders', 'femaleOrderDetails' // New columns for female orders
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:V1`,  // Extended range for new columns
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });
    res.json({ message: `Campus sheet ${tabName} recreated successfully with gender column` });
  } catch (error) {
    console.error(`❌ Error recreating campus sheet ${req.params.tabName}:`, error);
    res.status(500).json({ error: 'Failed to recreate campus sheet' });
  }
});

// ✅ Recreate campus sheet (body variant) - accepts { tabName } in POST body
app.post('/api/sheets/recreate-campus', async (req, res) => {
  try {
    const { tabName } = req.body;
    if (!tabName) return res.status(400).json({ error: 'tabName is required in request body' });

    // Clear the campus sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:Z`
    });

    // Add updated headers to campus sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email', 'gender',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions',
      'maleOrders', 'maleOrderDetails', // New columns for male orders
      'femaleOrders', 'femaleOrderDetails' // New columns for female orders
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:V1`,  // Extended range for new columns
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });
    res.json({ message: `Campus sheet ${tabName} recreated successfully with gender column` });
  } catch (error) {
    console.error(`❌ Error recreating campus sheet (body):`, error);
    res.status(500).json({ error: 'Failed to recreate campus sheet' });
  }
});

// ✅ Submit order endpoint
app.post('/submit-order', async (req, res) => {
  const order = req.body;
  const recaptchaToken = order.recaptchaToken;

  try {
    // 1. Verify reCAPTCHA
    const recaptchaResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
      }
    );

    if (!recaptchaResponse.data.success) {
      return res.status(400).json({ error: '❌ reCAPTCHA verification failed' });
    }

    // 2. Prepare data for Google Sheets
    const timestamp = new Date().toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Format orders for gender-specific columns
    const orderSummary = `Order at ${timestamp}:
Total: Rs. ${order.grandTotal}
Items: ${order.cartItems || ''}`;

    const orderData = [[
      order.firstName || '',
      order.lastName || '',
      order.room || '',
      order.phone || '',
      order.email || '',
      order.gender || '',  // Include gender in main columns
      order.persons || '',
      order.deliveryCharge || '',
      order.itemTotal || '',
      order.grandTotal || '',
      order.cartItems || '',
      timestamp,
      order.accountTitle || '',
      order.bankName || '',
      order.screenshotURL || '',
      order.specialInstruction || '',
      // Gender-specific columns
      order.gender === 'male' ? order.firstName + ' ' + order.lastName : '',  // Male name
      order.gender === 'male' ? orderSummary : '',  // Male order details
      order.gender === 'female' ? order.firstName + ' ' + order.lastName : '', // Female name
      order.gender === 'female' ? orderSummary : ''  // Female order details
    ]];

    // 3. Append to campus-specific sheet
    const tabName = `${order.universityName}_${order.campusName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Prepare order data for campus sheet (with university and campus names)
    const campusOrderData = [[
      order.universityName || '',
      order.campusName || '',
      order.firstName || '',
      order.lastName || '',
      order.room || '',
      order.phone || '',
      order.email || '',
      order.gender || '',
      order.persons || '',
      order.deliveryCharge || '',
      order.itemTotal || '',
      order.grandTotal || '',
      order.cartItems || '',
      timestamp,
      order.accountTitle || '',
      order.bankName || '',
      order.screenshotURL || '',
      order.specialInstruction || '',
      // Gender-specific columns
      order.gender === 'male' ? order.firstName + ' ' + order.lastName : '',
      order.gender === 'male' ? orderSummary : '',
      order.gender === 'female' ? order.firstName + ' ' + order.lastName : '',
      order.gender === 'female' ? orderSummary : ''
    ]];

    // Append to campus-specific sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A:R`,  // Append to campus-specific sheet
      valueInputOption: 'RAW',
      resource: {
        values: campusOrderData,
      },
    });

    // Also append to Master sheet for overall tracking
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master!A:R',  // Append to Master sheet
      valueInputOption: 'RAW',
      resource: {
        values: campusOrderData,
      },
    });

    res.status(200).json({ message: '✅ Order submitted successfully!' });
  } catch (error) {
    console.error('❌ Error submitting order:', error.response?.data || error.message);
    res.status(500).json({ error: '❌ Failed to submit order to Google Sheets' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
