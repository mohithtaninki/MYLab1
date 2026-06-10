import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';

import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Storage (MongoDB) ----
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'sravani_anu_diagnostics';

if (!process.env.MONGODB_URI) {
  console.warn('[Config] MONGODB_URI not set. Using default:', MONGODB_URI);
}
if (!process.env.MONGODB_DB) {
  console.warn('[Config] MONGODB_DB not set. Using default:', DB_NAME);
}


const client = new MongoClient(MONGODB_URI);
let db;

async function connectDb() {
  await client.connect();
  db = client.db(DB_NAME);
  // Collections
  await db.createCollection('users').catch(() => {});
  await db.createCollection('appointments').catch(() => {});
  await db.createCollection('test_results').catch(() => {});
  console.log(`Connected to MongoDB: ${MONGODB_URI} / ${DB_NAME}`);
}

function cryptoRandomId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}


// Seed admin (demo)
const ADMIN_EMAIL = 'admin@sravani-anu.com';
const ADMIN_PASS = 'admin123';

async function seedAdmin() {
  const existing = await db.collection('users').findOne({ email: ADMIN_EMAIL });
  if (existing) return;

  const hash = bcrypt.hashSync(ADMIN_PASS, 10);
  await db.collection('users').insertOne({
    id: cryptoRandomId(),
    email: ADMIN_EMAIL,
    passwordHash: hash,
    role: 'admin'
  });
  console.log('Seeded demo admin user');
}


// Minimal in-memory auth token
const sessions = new Map(); // token -> user

function auth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  req.user = sessions.get(token);
  next();
}

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const user = await db.collection('users').findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = cryptoRandomId();
  sessions.set(token, user);
  res.json({ token });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public: Search test results
app.get('/api/results', async (req, res) => {
  const { refId, name } = req.query;

  const filter = {};
  if (refId) filter.refId = String(refId);
  if (name) filter.patientName = { $regex: String(name), $options: 'i' };

  const results = await db.collection('test_results')
    .find(filter)
    .toArray();

  res.json({ results });
});

// Public: Appointment booking
app.post('/api/appointments', async (req, res) => {
  const { patientName, phone, email, preferredDate, preferredTime, service } = req.body || {};
  if (!patientName || !phone) return res.status(400).json({ error: 'patientName and phone are required' });

  const appointment = {
    id: cryptoRandomId(),
    patientName,
    phone,
    email: email || '',
    preferredDate: preferredDate || '',
    preferredTime: preferredTime || '',
    service: service || 'Blood Test',
    status: 'Requested',
    createdAt: new Date().toISOString()
  };

  await db.collection('appointments').insertOne(appointment);
  res.json({ ok: true, appointmentId: appointment.id });
});

// Admin: Add test result records (demo)
app.post('/api/admin/results', auth, async (req, res) => {
  const { refId, patientName, reports } = req.body || {};
  if (!refId || !patientName || !Array.isArray(reports)) {
    return res.status(400).json({ error: 'refId, patientName, reports[] are required' });
  }

  // Avoid duplicates (case-insensitive)
  const existing = await db.collection('test_results').findOne({
    refId: String(refId)
  });

  if (existing) return res.status(409).json({ error: 'Result with same refId already exists' });

  await db.collection('test_results').insertOne({
    id: cryptoRandomId(),
    refId,
    patientName,
    reports,
    createdAt: new Date().toISOString()
  });

  res.json({ ok: true });
});

app.get('/api/admin/appointments', auth, async (req, res) => {
  const appointments = await db.collection('appointments').find({}).toArray();
  res.json({ appointments });
});

// Initialize database when server starts
connectDb()
  .then(() => seedAdmin())
  .catch(err => console.error('Database initialization failed:', err));

export default app;




