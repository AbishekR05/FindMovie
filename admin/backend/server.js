// Simple admin backend scaffold
// Usage: set MONGODB_URI and ADMIN_TOKEN environment variables, then run `node server.js`

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DBNAME || 'findmovie';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN && String(process.env.ADMIN_TOKEN).trim();

if (!MONGODB_URI) {
  console.warn('Warning: MONGODB_URI is not set. This admin service requires MongoDB to operate.');
}
if (!ADMIN_TOKEN) {
  console.warn('Warning: ADMIN_TOKEN is not set. Admin endpoints will be unreachable until ADMIN_TOKEN is provided.');
}

let client;
let roomsCol;
let dbConnected = false;
let dbError = null;

async function initDb() {
  if (!MONGODB_URI) {
    console.warn('initDb: MONGODB_URI not provided, skipping DB init');
    dbConnected = false;
    dbError = 'missing_mongodb_uri';
    return;
  }
  client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    roomsCol = db.collection('rooms');
    dbConnected = true;
    dbError = null;
    console.log('Admin backend: connected to MongoDB', DB_NAME);
  } catch (err) {
    dbConnected = false;
    dbError = (err && err.message) ? err.message : String(err);
    console.error('admin db init failed', err);
  }
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'admin_not_configured' });
  // Accept token via header x-admin-token, query param adminToken, or Authorization: Bearer <token>
  let token = null;
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  } catch (e) {
    // ignore
  }
  if (!token) token = req.headers['x-admin-token'] || req.query.adminToken;

  // simple masked logging to help debug without leaking the token
  const mask = (s) => (typeof s === 'string' && s.length > 4 ? `${s.slice(0,2)}...${s.slice(-2)}` : s);
  if (!token) {
    console.warn('⚠️ Admin access attempted without token from', req.ip || req.headers['x-forwarded-for'] || 'unknown');
    return res.status(401).json({ error: 'unauthorized', reason: 'missing_token' });
  }
  if (token !== ADMIN_TOKEN) {
    console.warn(`⚠️ Admin token mismatch (provided=${mask(token)} expected=${mask(ADMIN_TOKEN)}) from ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);
    return res.status(401).json({ error: 'unauthorized', reason: 'invalid_token' });
  }
  return null;
}

app.get('/api/admin/rooms', async (req, res) => {
  const bad = requireAdmin(req, res);
  if (bad) return;
  if (!roomsCol) return res.status(500).json({ error: 'db_not_connected' });
  try {
    const docs = await roomsCol.find({}).project({ roomId: 1, users: 1, messages: 1, createdAt: 1, host: 1 }).toArray();
    const list = docs.map(r => ({ roomId: r.roomId, users: r.users || [], createdAt: r.createdAt || null, messagesCount: (r.messages && r.messages.length) || 0, host: r.host || null }));
    return res.json({ rooms: list });
  } catch (err) {
    console.error('admin/rooms error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Lightweight health endpoint (no auth) to help debugging admin service status
app.get('/api/admin/health', (req, res) => {
  res.json({
    adminConfigured: !!ADMIN_TOKEN,
    dbConnected: !!dbConnected,
    mongoUriPresent: !!MONGODB_URI,
    dbError: dbError,
    port: PORT,
  });
});

app.get('/api/admin/rooms/:roomId/messages', async (req, res) => {
  const bad = requireAdmin(req, res);
  if (bad) return;
  if (!roomsCol) return res.status(500).json({ error: 'db_not_connected' });
  try {
    const roomId = req.params.roomId;
    const room = await roomsCol.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'room_not_found' });
    return res.json({ messages: room.messages || [] });
  } catch (err) {
    console.error('admin/messages error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

const PORT = process.env.ADMIN_PORT || 5000;

initDb().catch((e) => console.error('admin db init failed', e));
// better crash handling and startup log
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection at:', reason));

app.listen(PORT, () => {
  console.log(`Admin backend listening on http://0.0.0.0:${PORT}`);
  if (!MONGODB_URI) console.warn('Admin backend: MONGODB_URI is not configured; DB endpoints will return db_not_connected');
  if (!ADMIN_TOKEN) console.warn('Admin backend: ADMIN_TOKEN is not configured; admin endpoints will return admin_not_configured');
});
