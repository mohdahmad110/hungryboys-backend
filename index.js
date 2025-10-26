const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const admin = require('firebase-admin');
const { MongoClient } = require('mongodb');

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// ✅ Initialize Firebase Admin (use provided base64 creds or fallback to credentials.json used above)
let firebaseCreds;
if (process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64) {
  const fbJSON = Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString('utf8');
  firebaseCreds = JSON.parse(fbJSON);
} else {
  firebaseCreds = credentials; // fallback to the same service account used for Google APIs
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseCreds)
    });
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e.message);
  }
}

const firestore = (() => {
  try {
    return admin.firestore();
  } catch (e) {
    return null;
  }
})();

// ✅ MongoDB connection (share a single client)
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || 'hungry_boys';
let mongoClient;
let mongoDb;

async function getDb() {
  if (!mongoUri) throw new Error('Missing MONGODB_URI');
  if (mongoDb) return mongoDb;
  mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  await mongoClient.connect();
  mongoDb = mongoClient.db(mongoDbName);
  return mongoDb;
}

// ✅ Auth middleware using Firebase ID token
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ✅ Load user profile (campus enforcement) from Firestore
async function loadUserProfile(req, res, next) {
  if (!firestore) return res.status(500).json({ error: 'Firestore not initialized on server' });
  try {
    const userDoc = await firestore.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) return res.status(403).json({ error: 'User profile not found' });
    const profile = userDoc.data();
    if (profile?.role !== 'user' && profile?.role !== 'campusAdmin' && profile?.role !== 'superAdmin' && profile?.role !== 'restaurantManager') {
      return res.status(403).json({ error: 'Unauthorized role' });
    }
    req.userProfile = profile;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
}

// ✅ Root route
app.get('/', (req, res) => {
  res.send('✅ Google Sheets API backend is running!');
});

// ✅ Google Sheets Management Endpoints

// Get all sheet tabs
app.get('/api/sheets/tabs', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// Create sheet tab
app.post('/api/sheets/create', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// Delete sheet tab
app.delete('/api/sheets/delete', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// Get orders from sheet
app.get('/api/sheets/orders/:sheetName', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// Append order to specific sheet
app.post('/api/sheets/orders/:sheetName', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// Create master sheet
app.post('/api/sheets/master', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// ✅ Recreate master sheet with updated structure
app.post('/api/sheets/recreate-master', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// ✅ Recreate campus sheet with updated structure
app.post('/api/sheets/recreate-campus/:tabName', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
});

// ✅ Recreate campus sheet (body variant) - accepts { tabName } in POST body
app.post('/api/sheets/recreate-campus', async (req, res) => {
  return res.status(410).json({ error: 'Google Sheets integration has been removed' });
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

// =========================
// New: MongoDB Orders API
// Enforces: users can order ONLY from their own campus
// =========================

app.post('/api/orders', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const {
      universityId,
      campusId,
      universityName,
      campusName,
      firstName,
      lastName,
      phone,
      email,
      gender,
      persons,
      deliveryCharge,
      itemTotal,
      grandTotal,
      cartItems,
      cartItemsFormatted,
      restaurantNames,
      accountTitle,
      bankName,
      screenshotURL,
      specialInstruction,
      recaptchaToken
    } = req.body || {};

    // Optional: verify reCAPTCHA if provided and secret is configured

    // Optional: verify reCAPTCHA if provided and secret is configured
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
      try {
        const recaptchaResponse = await axios.post(
          'https://www.google.com/recaptcha/api/siteverify',
          null,
          { params: { secret: process.env.RECAPTCHA_SECRET_KEY, response: recaptchaToken } }
        );
        if (!recaptchaResponse.data.success) {
          return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }
    }

    // Enforce campus restriction
    const assignedCampusId = req.userProfile?.campusId;
    if (!assignedCampusId) {
      return res.status(403).json({ error: 'No campus assigned to user profile' });
    }
    if (!campusId || campusId !== assignedCampusId) {
      return res.status(403).json({
        error: 'You can only place orders from your assigned campus. Please switch back to your campus in the navbar.'
      });
    }

    // Basic field checks (gender is required by validator)
    if (!firstName || !phone || !gender || !grandTotal) {
      return res.status(400).json({ error: 'Missing required order fields' });
    }

    const orderDoc = {
      universityId: universityId || req.userProfile?.universityId || null,
      campusId,
      universityName: universityName || null,
      campusName: campusName || null,
      firstName,
      lastName: lastName || null,
      phone,
      email: email || req.user?.email || null,
      gender,
      persons: persons ?? null,
      deliveryCharge: deliveryCharge ?? null,
      itemTotal: itemTotal ?? null,
      grandTotal,
      cartItems: cartItemsFormatted || (typeof cartItems === 'string' ? cartItems : JSON.stringify(cartItems)), // Keep as string for schema validation
      cartItemsArray: Array.isArray(cartItems) ? cartItems : [], // Store array for filtering
      // Optional: list of restaurant names present in the order for filtering
      ...(Array.isArray(restaurantNames) && restaurantNames.length > 0
        ? { restaurantNames: Array.from(new Set(restaurantNames.map(x => String(x).trim()).filter(Boolean))) }
        : {}),
      timestamp: new Date().toISOString(),
      accountTitle: accountTitle || null,
      bankName: bankName || null,
      screenshotURL: screenshotURL || null,
      specialInstruction: specialInstruction || null,
      createdAt: new Date(),
      status: 'pending'
    };

    const result = await db.collection('orders').insertOne(orderDoc);

    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error('Create order failed:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// List orders (campus-scoped for campus admin, all orders for super admin)
app.get('/api/orders', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { status, limit = 50 } = req.query;
    const isSuperAdminUser = isSuperAdmin(req.userProfile);
    
    // Super admin sees all orders, campus admin sees only their campus
    const filter = isSuperAdminUser ? {} : { campusId: req.userProfile?.campusId };
    
    if (status) filter.status = status;
    const orders = await db.collection('orders')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// Explicit super-admin endpoint for all orders (alias for clarity)
app.get('/api/orders/all', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    if (!isSuperAdmin(req.userProfile)) {
      return res.status(403).json({ error: 'Super admin only' });
    }
    const db = await getDb();
    const { limit = 1000 } = req.query;
    const orders = await db.collection('orders')
      .find({})
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

// Update order status (campus admin and restaurant manager, not super admin)
app.patch('/api/orders/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    // Prevent super admins from updating order status
    if (isSuperAdmin(req.userProfile)) {
      return res.status(403).json({ error: 'Super admins cannot update order status. Only campus admins and restaurant managers can update orders.' });
    }
    
    const db = await getDb();
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Missing status' });
    const { ObjectId } = require('mongodb');

    // Build dual-ID filter to handle legacy string _id documents
    const filters = [];
    try { filters.push({ _id: new ObjectId(id) }); } catch (_) {}
    filters.push({ _id: id });
    
    // Campus admin: filter by campusId
    // Restaurant manager: filter by orders containing their restaurant's items
    let filter;
    if (isCampusAdmin(req.userProfile)) {
      filter = { $or: filters, campusId: req.userProfile?.campusId };
    } else if (isRestaurantManager(req.userProfile)) {
      filter = { $or: filters, 'cartItems.restaurantId': req.userProfile?.restaurantId };
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const upd = await db.collection('orders').updateOne(filter, { $set: { status } });
    if (upd.matchedCount === 0) return res.status(404).json({ error: 'Order not found' });

    const doc = await db.collection('orders').findOne(filter);
    if (!doc) return res.status(404).json({ error: 'Order not found after update' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// =========================
// User Management API
// =========================

// Create user via Firebase Admin (prevents automatic sign-in)
app.post('/api/users', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    if (!isSuperAdmin(req.userProfile)) {
      return res.status(403).json({ error: 'Super admin only' });
    }
    
    const { firstName, lastName, email, password, role, universityId, campusId, universityName, campusName, restaurantId, restaurantName } = req.body;
    
    if (!firstName || !lastName || !email || !password || !role || !universityId || !campusId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate restaurantId for restaurant managers
    if (role === 'restaurantManager' && !restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required for restaurant managers' });
    }
    
    // Create user in Firebase Auth using Admin SDK
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });
    
    // Create user profile in Firestore
    const newUser = {
      firstName,
      lastName,
      email,
      role,
      universityId,
      campusId,
      universityName,
      campusName,
      createdAt: new Date().toISOString(),
      uid: userRecord.uid,
    };
    
    // Add restaurant info for restaurant managers
    if (role === 'restaurantManager') {
      newUser.restaurantId = restaurantId;
      newUser.restaurantName = restaurantName;
    }
    
    await admin.firestore().collection('users').doc(userRecord.uid).set(newUser);
    
    res.status(201).json({ 
      message: 'User created successfully', 
      uid: userRecord.uid,
      user: newUser 
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user: ' + (err.message || 'Unknown error') });
  }
});

// =========================
// New: MongoDB CRUD APIs for University/Campus/Restaurants/Menu/Mart
// =========================

function isSuperAdmin(profile) { return profile?.role === 'superAdmin'; }
function isCampusAdmin(profile) { return profile?.role === 'campusAdmin'; }
function isRestaurantManager(profile) { return profile?.role === 'restaurantManager'; }

// Get orders for a specific restaurant (for restaurant managers)
app.get('/api/orders/restaurant/:restaurantId', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    // Only restaurant managers can access their restaurant's orders
    if (!isRestaurantManager(req.userProfile)) {
      return res.status(403).json({ error: 'Restaurant manager only' });
    }
    
    // Verify the restaurant manager is accessing their own restaurant
    if (req.userProfile.restaurantId !== req.params.restaurantId) {
      return res.status(403).json({ error: 'You can only access orders for your assigned restaurant' });
    }
    
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const { restaurantId } = req.params;
    const { limit = 1000 } = req.query;
    
    // Build dual-ID filter for restaurant lookup
    const restaurantFilters = [];
    try {
      restaurantFilters.push({ _id: new ObjectId(restaurantId) });
    } catch (e) {
      // ignore invalid ObjectId cast
    }
    restaurantFilters.push({ _id: restaurantId });
    
    // Get restaurant name from the database
    const restaurant = await db.collection('restaurants').findOne({ $or: restaurantFilters });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const restaurantName = restaurant.name;
    
    // Find orders that include this restaurant by restaurantId in cart items OR by restaurantName
    const orders = await db.collection('orders')
      .find({
        $or: [
          { 'cartItemsArray.restaurantId': restaurantId },
          { restaurantNames: restaurantName }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();
    
    // Filter cart items to only show items from this restaurant
    const filteredOrders = orders.map(order => {
      // Handle orders with cartItemsArray (new format)
      if (Array.isArray(order.cartItemsArray) && order.cartItemsArray.length > 0) {
        const restaurantItems = order.cartItemsArray.filter(item => 
          item.restaurantId === restaurantId || item.restaurantName === restaurantName
        );
        
        return {
          ...order,
          cartItems: restaurantItems,
          // Recalculate itemsTotal for just this restaurant's items
          itemsTotal: restaurantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
      }
      
      // Handle legacy orders with only cartItems string
      return {
        ...order,
        cartItems: order.cartItems,
        itemsTotal: order.itemTotal || 0
      };
    });
    
    res.json(filteredOrders);
  } catch (err) {
    console.error('Error fetching restaurant orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Universities
app.get('/api/universities', async (req, res) => {
  try {
    const db = await getDb();
    const items = await db.collection('universities').find({}).toArray();
    const normalized = items.map(u => ({ id: String(u._id), name: u.name }));
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch universities' });
  }
});

app.post('/api/universities', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can create universities' });
  try {
    const db = await getDb();
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await db.collection('universities').insertOne({ name });
    res.status(201).json({ id: String(result.insertedId), name });
  } catch (e) {
    console.error('University creation failed:', e);
    res.status(500).json({ error: 'Failed to create university', detail: e?.message });
  }
});

app.patch('/api/universities/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can update universities' });
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const update = {};
    if (req.body?.name) update.name = String(req.body.name).trim();

    // Dual-ID filter to support legacy string _id documents
    const filters = [];
    try {
      filters.push({ _id: new ObjectId(req.params.id) });
    } catch (_) {
      // ignore invalid cast
    }
    filters.push({ _id: req.params.id });
    const filter = { $or: filters };

    const upd = await db.collection('universities').updateOne(filter, { $set: update });
    if (upd.matchedCount === 0) return res.status(404).json({ error: 'University not found' });

    const doc = await db.collection('universities').findOne(filter);
    if (!doc) return res.status(404).json({ error: 'University not found after update' });
    const normalized = { id: String(doc._id), name: doc.name };
    res.json(normalized);
  } catch (e) {
    console.error('University update failed:', e);
    res.status(500).json({ error: 'Failed to update university', detail: e?.message });
  }
});

app.delete('/api/universities/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can delete universities' });
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const filters = [];
    try { filters.push({ _id: new ObjectId(req.params.id) }); } catch (_) {}
    filters.push({ _id: req.params.id });
    const delRes = await db.collection('universities').deleteOne({ $or: filters });
    if (delRes.deletedCount === 0) return res.status(404).json({ error: 'University not found' });
    // Optionally cascade delete campuses/restaurants/menuItems if desired (not implemented here)
    res.status(204).end();
  } catch (e) {
    console.error('University delete failed:', e);
    res.status(500).json({ error: 'Failed to delete university', detail: e?.message });
  }
});

// Campuses
app.get('/api/campuses', async (req, res) => {
  try {
    const db = await getDb();
    const { universityId } = req.query;
    let filter = {};
    if (universityId) filter.universityId = universityId;
    const items = await db.collection('campuses').find(filter).toArray();
    const normalized = items.map(c => ({ id: String(c._id), universityId: c.universityId, name: c.name }));
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campuses' });
  }
});

app.post('/api/campuses', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can create campuses' });
  try {
    const db = await getDb();
    const { universityId, name } = req.body || {};
    if (!universityId || !name) return res.status(400).json({ error: 'universityId and name are required' });
    const result = await db.collection('campuses').insertOne({ universityId, name });
    res.status(201).json({ id: String(result.insertedId), universityId, name });
  } catch (e) {
    console.error('Campus creation failed:', e);
    res.status(500).json({ error: 'Failed to create campus', detail: e?.message });
  }
});

app.patch('/api/campuses/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can update campuses' });
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const update = {};
    if (req.body?.name) update.name = req.body.name;

    // Build filter supporting both ObjectId and string _id (for legacy rows)
    const filters = [];
    try {
      const oid = new ObjectId(req.params.id);
      filters.push({ _id: oid });
    } catch (e) {
    }
    filters.push({ _id: req.params.id });
    const filter = { $or: filters };

    // Use updateOne + findOne to avoid driver return shape issues
    const upd = await db.collection('campuses').updateOne(filter, { $set: update });
    if (upd.matchedCount === 0) {
      return res.status(404).json({ error: 'Campus not found' });
    }
    const doc = await db.collection('campuses').findOne(filter);
    if (!doc) {
      // Extremely unlikely if matched; fallback
      return res.status(404).json({ error: 'Campus not found after update' });
    }
    const normalized = { id: String(doc._id), universityId: doc.universityId, name: doc.name };
    res.json(normalized);
  } catch (e) {
    console.error('Campus update failed:', e);
    res.status(500).json({ error: 'Failed to update campus', detail: e?.message });
  }
});

app.delete('/api/campuses/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  if (!isSuperAdmin(req.userProfile)) return res.status(403).json({ error: 'Only superAdmin can delete campuses' });
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const filters = [];
    try {
      filters.push({ _id: new ObjectId(req.params.id) });
    } catch (e) { /* ignore */ }
    filters.push({ _id: req.params.id });
    const result = await db.collection('campuses').deleteOne({ $or: filters });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Campus not found' });
    res.status(204).end();
  } catch (e) {
    console.error('Campus delete failed:', e);
    res.status(500).json({ error: 'Failed to delete campus', detail: e?.message });
  }
});

// Restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const db = await getDb();
    const { campusId } = req.query;
    const filter = campusId ? { campusId } : {};
    const items = await db.collection('restaurants').find(filter).toArray();
    const normalized = items.map(r => ({
      id: String(r._id),
      campusId: r.campusId,
      universityId: r.universityId,
      name: r.name,
      location: r.location,
      cuisine: r.cuisine,
      openTime: r.openTime,
      closeTime: r.closeTime,
      is24x7: r.is24x7
    }));
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Get single restaurant by ID
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { ObjectId } = require('mongodb');
    
    let restaurant;
    try {
      restaurant = await db.collection('restaurants').findOne({ _id: new ObjectId(id) });
    } catch (_) {
      restaurant = await db.collection('restaurants').findOne({ _id: id });
    }
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    res.json({
      id: String(restaurant._id),
      ...restaurant
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

app.post('/api/restaurants', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { campusId, universityId, name, location, cuisine, openTime, closeTime, is24x7 } = req.body || {};
    if (!campusId || !universityId || !name) return res.status(400).json({ error: 'campusId, universityId, name are required' });
    if (isCampusAdmin(req.userProfile) && campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed for this campus' });
    const doc = { campusId, universityId, name, location: location || '', cuisine: cuisine || '', openTime: openTime || '10:00 AM', closeTime: closeTime || '10:00 PM', is24x7: is24x7 ?? true };
    const result = await db.collection('restaurants').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

app.patch('/api/restaurants/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    let _id;
    try {
      _id = new ObjectId(req.params.id);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }
    const existing = await db.collection('restaurants').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Restaurant not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    const update = {};
    ['name','location','cuisine','openTime','closeTime','is24x7'].forEach(k => { if (k in req.body) update[k] = req.body[k]; });
    const result = await db.collection('restaurants').findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
    res.json(result.value);
  } catch (e) {
    console.error('Restaurant update failed:', e);
    res.status(500).json({ error: 'Failed to update restaurant', detail: e?.message });
  }
});

app.delete('/api/restaurants/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    let _id;
    try {
      _id = new ObjectId(req.params.id);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }
    const existing = await db.collection('restaurants').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Restaurant not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    await db.collection('restaurants').deleteOne({ _id });
    // Optionally cascade delete menuItems of this restaurant (not implemented here)
    res.status(204).end();
  } catch (e) {
    console.error('Restaurant delete failed:', e);
    res.status(500).json({ error: 'Failed to delete restaurant', detail: e?.message });
  }
});

// Menu Items
app.get('/api/menu-items', async (req, res) => {
  try {
    const db = await getDb();
    const { restaurantId, campusId } = req.query;
    
    // Build query filter
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (campusId) filter.campusId = campusId;
    
    const items = await db.collection('menuItems').find(filter).toArray();
    const normalized = items.map(m => ({
      id: String(m._id),
      restaurantId: m.restaurantId,
      campusId: m.campusId,
      name: m.name,
      price: (m && m.price && typeof m.price.valueOf === 'function') ? Number(m.price.valueOf()) : Number(m.price),
      photoURL: m.photoURL,
      description: m.description,
      isAvailable: m.isAvailable,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    }));
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

app.post('/api/menu-items', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { restaurantId, campusId, name, price, photoURL, description, isAvailable } = req.body || {};

    // Basic validation with clear messages
    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'restaurantId is required' });
    }
    if (!campusId || typeof campusId !== 'string') {
      return res.status(400).json({ error: 'campusId is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (price === undefined || price === null) {
      return res.status(400).json({ error: 'price is required' });
    }
    const numericPrice = typeof price === 'number' ? price : parseFloat(price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
    if (isCampusAdmin(req.userProfile) && campusId !== req.userProfile.campusId) {
      return res.status(403).json({ error: 'Not allowed for this campus' });
    }

    // Verify the restaurant exists and belongs to the provided campus
    let restaurant;
    try {
      const { ObjectId } = require('mongodb');
      const _id = new ObjectId(restaurantId);
      restaurant = await db.collection('restaurants').findOne({ _id });
    } catch (convErr) {
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (restaurant.campusId !== campusId) {
      return res.status(400).json({ error: 'Restaurant does not belong to the selected campus' });
    }

    const { Double } = require('mongodb');
    const doc = {
      restaurantId,
      campusId,
      name: name.trim(),
      price: new Double(Number(numericPrice)), // Force BSON Double to satisfy validator
      isAvailable: isAvailable ?? true,
      createdAt: new Date()
    };
    // Only include optional fields when valid; avoid nulls to satisfy stricter validators
    if (restaurant.universityId && typeof restaurant.universityId === 'string') {
      doc.universityId = restaurant.universityId;
    }
    if (photoURL && typeof photoURL === 'string' && photoURL.trim()) {
      doc.photoURL = photoURL.trim();
    }
    if (description && typeof description === 'string' && description.trim()) {
      doc.description = description.trim();
    }
  const result = await db.collection('menuItems').insertOne(doc);
  // Normalize response to plain number for price
  res.status(201).json({ ...doc, price: Number(doc.price.valueOf()), _id: result.insertedId });
  } catch (e) {
    const code = e && (e.code || e.name);
    const errInfo = e && e.errInfo ? e.errInfo : undefined;
    if (code === 121 || (errInfo && errInfo.details)) {
      console.error('MenuItems POST validation error:', JSON.stringify(errInfo, null, 2));
    } else {
      console.error('MenuItems POST failed:', e && e.stack ? e.stack : e);
    }
    res.status(500).json({ error: 'Failed to create menu item', detail: e?.message || String(e), code, errInfo });
  }
});

app.patch('/api/menu-items/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const _id = new ObjectId(req.params.id);
    const existing = await db.collection('menuItems').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    const update = {};
    const { Double } = require('mongodb');
    ['name','price','photoURL','description','isAvailable'].forEach(k => {
      if (k in req.body) {
        if (k === 'price') {
          const val = parseFloat(req.body[k]);
          if (!Number.isNaN(val)) update[k] = new Double(Number(val));
        } else {
          update[k] = req.body[k];
        }
      }
    });
    update.updatedAt = new Date();
    const result = await db.collection('menuItems').findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
    res.json(result.value);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/menu-items/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const _id = new ObjectId(req.params.id);
    const existing = await db.collection('menuItems').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    await db.collection('menuItems').deleteOne({ _id });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// Menu Items Bulk
app.post('/api/menu-items/bulk', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { restaurantId, campusId, items } = req.body || {};
    if (!restaurantId || !campusId || !Array.isArray(items)) return res.status(400).json({ error: 'restaurantId, campusId and items array required' });
    if (isCampusAdmin(req.userProfile) && campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed for this campus' });

    // Verify restaurant exists and belongs to campus
    let restaurant;
    try {
      const { ObjectId } = require('mongodb');
      restaurant = await db.collection('restaurants').findOne({ _id: new ObjectId(restaurantId) });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (restaurant.campusId !== campusId) return res.status(400).json({ error: 'Restaurant does not belong to the selected campus' });

    const docs = items
      .filter(Boolean)
      .map(r => {
        const { Double } = require('mongodb');
        const doc = {
          restaurantId,
          campusId,
          name: String(r.name || '').trim(),
          price: new Double(Number(parseFloat(r.price))), // Force BSON Double
          isAvailable: r.isAvailable ?? true,
          createdAt: new Date()
        };
        if (r.photoURL && typeof r.photoURL === 'string' && r.photoURL.trim()) {
          doc.photoURL = r.photoURL.trim();
        }
        if (r.description && typeof r.description === 'string' && r.description.trim()) {
          doc.description = r.description.trim();
        }
        return doc;
      })
      .filter(d => d.name && !Number.isNaN(d.price) && d.price > 0);

    if (!docs.length) return res.status(400).json({ error: 'No valid items to import' });
    const result = await db.collection('menuItems').insertMany(docs);
    res.status(201).json({ insertedCount: result.insertedCount });
  } catch (e) {
    res.status(500).json({ error: 'Failed to bulk import menu items', detail: e?.message || String(e) });
  }
});

// Mart Items
app.get('/api/mart-items', async (req, res) => {
  try {
    const db = await getDb();
    const { campusId } = req.query;
    
    // Build query filter - if no campusId provided, fetch all
    const filter = campusId ? { campusId } : {};
    
    const items = await db.collection('martItems').find(filter).toArray();
    const normalized = items.map(x => ({
      id: String(x._id),
      campusId: x.campusId,
      name: x.name,
      price: x.price,
      photoURL: x.photoURL,
      description: x.description,
      category: x.category,
      stock: x.stock,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt
    }));
    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch mart items' });
  }
});

app.post('/api/mart-items', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { campusId, name, price, photoURL, description, category, stock } = req.body || {};
    if (!campusId || !name || price === undefined) return res.status(400).json({ error: 'campusId, name, price required' });
    if (isCampusAdmin(req.userProfile) && campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed for this campus' });
    const doc = { 
      campusId, 
      name, 
      price: Number(parseFloat(price)), // Ensure proper number type
      photoURL: photoURL || null, 
      description: description || null, 
      category: category || '', 
      stock: Number.isFinite(parseInt(stock)) ? parseInt(stock) : 0, 
      createdAt: new Date() 
    };
    const result = await db.collection('martItems').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create mart item', detail: e?.message || String(e) });
  }
});

app.patch('/api/mart-items/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const _id = new ObjectId(req.params.id);
    const existing = await db.collection('martItems').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    const update = {};
    ['name','price','photoURL','description','category','stock'].forEach(k => { if (k in req.body) update[k] = k === 'price' ? parseFloat(req.body[k]) : req.body[k]; });
    update.updatedAt = new Date();
    const result = await db.collection('martItems').findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
    res.json(result.value);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update mart item' });
  }
});

app.delete('/api/mart-items/:id', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = require('mongodb');
    const _id = new ObjectId(req.params.id);
    const existing = await db.collection('martItems').findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (isCampusAdmin(req.userProfile) && existing.campusId !== req.userProfile.campusId) return res.status(403).json({ error: 'Not allowed' });
    await db.collection('martItems').deleteOne({ _id });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete mart item' });
  }
});

// =========================
// Campus Settings API
// =========================

// Get campus settings (by campusId)
app.get('/api/campus-settings/:campusId', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    const db = await getDb();
    const { campusId } = req.params;
    
    // Super admin can view any campus settings, campus admin only their own
    if (isCampusAdmin(req.userProfile) && req.userProfile.campusId !== campusId) {
      return res.status(403).json({ error: 'You can only view settings for your assigned campus' });
    }

    const settings = await db.collection('campusSettings').findOne({ campusId });
    
    if (!settings) {
      // Return default settings if none exist
      return res.json({
        campusId,
        deliveryChargePerPerson: 150,
        accountTitle: "Maratib Ali",
        bankName: "SadaPay",
        accountNumber: "03330374616"
      });
    }
    
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campus settings' });
  }
});

// Get all campus settings (super admin only)
app.get('/api/campus-settings', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    if (!isSuperAdmin(req.userProfile)) {
      return res.status(403).json({ error: 'Only super admin can view all campus settings' });
    }
    
    const db = await getDb();
    const settings = await db.collection('campusSettings').find({}).toArray();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campus settings' });
  }
});

// Create or update campus settings (super admin only)
app.post('/api/campus-settings', verifyFirebaseToken, loadUserProfile, async (req, res) => {
  try {
    if (!isSuperAdmin(req.userProfile)) {
      return res.status(403).json({ error: 'Only super admin can manage campus settings' });
    }

    const db = await getDb();
    const { campusId, deliveryChargePerPerson, accountTitle, bankName, accountNumber } = req.body || {};
    
    // Validate required fields
    if (!campusId) return res.status(400).json({ error: 'campusId is required' });
    if (!deliveryChargePerPerson || deliveryChargePerPerson <= 0) {
      return res.status(400).json({ error: 'deliveryChargePerPerson must be greater than 0' });
    }
    if (!accountTitle || !bankName || !accountNumber) {
      return res.status(400).json({ error: 'All payment details are required' });
    }

    const settingsDoc = {
      campusId,
      deliveryChargePerPerson: parseInt(deliveryChargePerPerson),
      accountTitle: accountTitle.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      updatedAt: new Date(),
      updatedBy: req.userProfile.email || req.user.email
    };

    // Upsert (update if exists, insert if not)
    const result = await db.collection('campusSettings').findOneAndUpdate(
      { campusId },
      { $set: settingsDoc },
      { upsert: true, returnDocument: 'after' }
    );

    res.json(result.value || settingsDoc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to save campus settings' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
