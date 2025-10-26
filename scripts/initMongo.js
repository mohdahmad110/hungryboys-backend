/*
 Initializes MongoDB database, collections, validators, and indexes
 Usage:
   1) Copy backend/.env.example to backend/.env and fill MONGODB_URI, MONGODB_DB
   2) Run: npm run provision:db  (from backend folder or with --prefix backend)
*/

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'hungry_boys';

if (!uri) {
  console.error('Missing MONGODB_URI. Set it in backend/.env');
  process.exit(1);
}

// Validators (JSON Schema)
const usersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id', 'email', 'role', 'createdAt'],
    properties: {
      _id: { bsonType: 'string' },
      email: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
      firstName: { bsonType: ['string', 'null'] },
      lastName: { bsonType: ['string', 'null'] },
      phone: { bsonType: ['string', 'null'] },
      role: { enum: ['user', 'campusAdmin', 'superAdmin'] },
      universityId: { bsonType: ['string', 'null'] },
      campusId: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] },
      lastLogin: { bsonType: ['date', 'null'] }
    }
  }
};

const menuItemsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'price', 'restaurantId', 'createdAt'],
    properties: {
      name: { bsonType: 'string' },
      price: { bsonType: ['double', 'int', 'long', 'decimal'] },
      restaurantId: { bsonType: 'string' },
      campusId: { bsonType: ['string', 'null'] },
      universityId: { bsonType: ['string', 'null'] },
      photoURL: { bsonType: ['string', 'null'] },
      description: { bsonType: ['string', 'null'] },
      isAvailable: { bsonType: ['bool', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: false
  }
};

const ordersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['universityName', 'campusName', 'firstName', 'phone', 'gender', 'grandTotal', 'createdAt'],
    properties: {
      universityName: { bsonType: 'string' },
      campusName: { bsonType: 'string' },
      firstName: { bsonType: 'string' },
      lastName: { bsonType: ['string', 'null'] },
      phone: { bsonType: 'string' },
      email: { bsonType: ['string', 'null'] },
      gender: { enum: ['male', 'female'] },
      persons: { bsonType: ['int', 'long'] },
      deliveryCharge: { bsonType: ['double', 'int', 'long', 'decimal'] },
      itemTotal: { bsonType: ['double', 'int', 'long', 'decimal'] },
      grandTotal: { bsonType: ['double', 'int', 'long', 'decimal'] },
      cartItems: { bsonType: ['string', 'null'] },
      timestamp: { bsonType: ['string', 'null'] },
      accountTitle: { bsonType: ['string', 'null'] },
      bankName: { bsonType: ['string', 'null'] },
      screenshotURL: { bsonType: ['string', 'null'] },
      specialInstruction: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      universityId: { bsonType: ['string', 'null'] },
      campusId: { bsonType: ['string', 'null'] },
      status: { enum: ['pending', 'accepted', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled', null] }
    }
  }
};

const universitiesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    properties: {
      name: { bsonType: 'string' }
    },
    additionalProperties: false
  }
};

const campusesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'universityId'],
    properties: {
      name: { bsonType: 'string' },
      universityId: { bsonType: 'string' }
    },
    additionalProperties: false
  }
};

const restaurantsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'campusId', 'universityId'],
    properties: {
      name: { bsonType: 'string' },
      campusId: { bsonType: 'string' },
      universityId: { bsonType: 'string' },
      location: { bsonType: ['string', 'null'] },
      cuisine: { bsonType: ['string', 'null'] },
      openTime: { bsonType: ['string', 'null'] },
      closeTime: { bsonType: ['string', 'null'] },
      is24x7: { bsonType: ['bool', 'null'] }
    },
    additionalProperties: false
  }
};

const martItemsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'price', 'campusId', 'createdAt'],
    properties: {
      name: { bsonType: 'string' },
      price: { bsonType: ['double', 'int', 'long', 'decimal'] },
      campusId: { bsonType: 'string' },
      photoURL: { bsonType: ['string', 'null'] },
      description: { bsonType: ['string', 'null'] },
      category: { bsonType: ['string', 'null'] },
      stock: { bsonType: ['int', 'long', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: false
  }
};

async function ensureCollection(db, name, validator) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    console.log(`Creating collection: ${name}`);
    await db.createCollection(name, validator ? { validator } : undefined);
  } else if (validator) {
    console.log(`Updating validator for: ${name}`);
    // Update validator using collMod
    await db.command({ collMod: name, validator });
  }
}

async function createIndexes(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });
  await db.collection('users').createIndex({ role: 1 }, { name: 'users_role' });
  await db.collection('users').createIndex({ campusId: 1 }, { name: 'users_campusId' });

  await db.collection('campuses').createIndex({ universityId: 1 }, { name: 'campuses_universityId' });
  await db.collection('campuses').createIndex({ name: 1, universityId: 1 }, { unique: true, name: 'campuses_name_universityId_unique' });

  await db.collection('restaurants').createIndex({ campusId: 1 }, { name: 'restaurants_campusId' });
  await db.collection('restaurants').createIndex({ universityId: 1 }, { name: 'restaurants_universityId' });

  await db.collection('menuItems').createIndex({ restaurantId: 1 }, { name: 'menuItems_restaurantId' });
  await db.collection('menuItems').createIndex({ campusId: 1 }, { name: 'menuItems_campusId' });
  await db.collection('menuItems').createIndex({ name: 1, restaurantId: 1 }, { name: 'menuItems_name_restaurantId' });

  await db.collection('orders').createIndex({ campusId: 1, createdAt: -1 }, { name: 'orders_campusId_createdAt' });
  await db.collection('orders').createIndex({ campusName: 1, createdAt: -1 }, { name: 'orders_campusName_createdAt' });
  await db.collection('orders').createIndex({ phone: 1, createdAt: -1 }, { name: 'orders_phone_createdAt' });

  await db.collection('logs').createIndex({ timestamp: -1 }, { name: 'logs_timestamp' });
  await db.collection('logs').createIndex({ performedBy: 1, timestamp: -1 }, { name: 'logs_performedBy_timestamp' });
  await db.collection('logs').createIndex({ action: 1, timestamp: -1 }, { name: 'logs_action_timestamp' });
  await db.collection('logs').createIndex({ targetType: 1, targetId: 1 }, { name: 'logs_targetType_targetId' });
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected. Using database: ${dbName}`);

  // Ensure collections and validators
  await ensureCollection(db, 'users', usersValidator);
  await ensureCollection(db, 'universities', universitiesValidator);
  await ensureCollection(db, 'campuses', campusesValidator);
  await ensureCollection(db, 'restaurants', restaurantsValidator);
  await ensureCollection(db, 'menuItems', menuItemsValidator);
  await ensureCollection(db, 'martItems', martItemsValidator);
  await ensureCollection(db, 'orders', ordersValidator);
  await ensureCollection(db, 'logs');

  // Indexes
  await createIndexes(db);

  console.log('Database initialization complete.');
  await client.close();
}

main().catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
