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
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1VCvhWcx3vOtxeiPe5KuWuDIbWSKfvRZkv4Y1P_M6QuM';

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
                columnCount: 17
              }
            }
          }
        }]
      }
    });

    // Add headers to the new sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:Q1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

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
      range: `${sheetName}!A2:Q${maxRows + 1}`,
    });

    const rows = response.data.values || [];
    const orders = rows.map((row, index) => {
      const order = {};
      const columns = [
        'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email',
        'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
        'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions'
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
      range: `${sheetName}!A:Q`,
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
                columnCount: 17
              }
            }
          }
        }]
      }
    });

    // Add headers to master sheet
    const headers = [
      'universityName', 'campusName', 'firstName', 'lastName', 'room', 'phone', 'email',
      'persons', 'deliveryCharge', 'itemTotal', 'grandTotal', 'cartItems', 'timestamp',
      'accountTitle', 'bankName', 'screenshotURL', 'Special Instructions'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master!A1:Q1',
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
    const orderData = [[
      order.firstName || '',
      order.lastName || '',
      order.room || '',
      order.phone || '',
      order.email || '',
      order.persons || '',
      order.deliveryCharge || '',
      order.itemTotal || '',
      order.grandTotal || '',
      order.cartItems || '',
      new Date().toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      order.accountTitle || '',
      order.bankName || '',
      order.screenshotURL || '',
      order.specialInstruction || '',
    ]];

    // 3. Append to the Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'orders!A2',
      valueInputOption: 'RAW',
      resource: {
        values: orderData,
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
