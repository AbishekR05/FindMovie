// load local .env for development (optional)
try { require('dotenv').config(); } catch (e) { /* ignore if dotenv not installed */ }
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const db = require("./db");
const nameIndex = require("./nameIndex");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

// lightweight health endpoint so clients can verify backend reachability
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Load the movie dataset (Final_with_difficulty.json) once at startup if present
let MOVIES = null;
try {
  const datasetPath = path.resolve(__dirname, "..", "Final_with_difficulty.json");
  if (fs.existsSync(datasetPath)) {
    const raw = fs.readFileSync(datasetPath, "utf8");
    MOVIES = JSON.parse(raw);
    console.log(`Loaded ${Array.isArray(MOVIES) ? MOVIES.length : 0} movies from Final_with_difficulty.json`);
    try {
      nameIndex.init(MOVIES);
      console.log('Built name index for fast first-name lookups');
    } catch (e) {
      console.warn('Failed to build name index', e && e.message ? e.message : e);
    }
  } else {
    console.warn("Final_with_difficulty.json not found at", datasetPath);
  }
} catch (err) {
  console.error("Failed to load movie dataset:", err && err.message ? err.message : err);
  MOVIES = null;
}

// helper to pick a random movie (optionally by difficulty)
function chooseRandomMovie(difficulty) {
  if (!Array.isArray(MOVIES) || MOVIES.length === 0) return null;
  let pool = MOVIES;
  if (difficulty) {
    pool = MOVIES.filter((m) => String(m.difficulty || "").toLowerCase() === String(difficulty).toLowerCase());
  }
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return { movie: pool[idx], index: idx };
}
// API to fetch movies from the dataset loaded above
app.get("/api/movies/random", (req, res) => {
  if (!Array.isArray(MOVIES) || MOVIES.length === 0) {
    return res.status(500).json({ error: "movies_not_available" });
  }
  // optional difficulty filter
  const { difficulty } = req.query;
  let pool = MOVIES;
  if (difficulty) pool = MOVIES.filter((m) => String(m.difficulty || "").toLowerCase() === String(difficulty).toLowerCase());
  if (!pool || pool.length === 0) return res.status(404).json({ error: "no_movies_for_filter" });
  const idx = Math.floor(Math.random() * pool.length);
  res.json({ movie: pool[idx], index: idx });
});

app.get("/api/movies/:index", (req, res) => {
  const idx = Number(req.params.index);
  if (!Array.isArray(MOVIES) || MOVIES.length === 0) return res.status(500).json({ error: "movies_not_available" });
  if (!Number.isFinite(idx) || idx < 0 || idx >= MOVIES.length) return res.status(400).json({ error: "invalid_index" });
  res.json({ movie: MOVIES[idx], index: idx });
});

// Return how many movies have a given first-name for a specified field (maleLead/femaleLead)
app.get('/api/first-name-count', (req, res) => {
  if (!Array.isArray(MOVIES) || MOVIES.length === 0) return res.status(500).json({ error: 'movies_not_available' });
  const field = req.query.field;
  const name = req.query.name;
  if (!field || !name) return res.status(400).json({ error: 'missing_field_or_name' });
  if (!['maleLead','femaleLead'].includes(field)) return res.status(400).json({ error: 'invalid_field' });
  try {
    const count = nameIndex.getFirstNameCount(field, name);
    return res.json({ count });
  } catch (err) {
    console.error('first-name-count error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
console.log("Using HTTP server for Socket.IO (local dev)");

const rooms = {};
const socketToRoom = {};
const socketToUsername = {};

// Initialize DB module if URI provided
if (process.env.MONGODB_URI) {
  db.init(process.env.MONGODB_URI, process.env.MONGODB_DBNAME).catch((err) => {
    console.error('db.init failed', err && err.message ? err.message : err);
  });
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

io.on("connection", (socket) => {
  // Log socket connection with origin if present to help debugging cross-device issues
  const origin = socket.handshake && socket.handshake.headers && socket.handshake.headers.origin;
  console.log("🟢 New user connected:", socket.id, "origin:", origin || "(no origin)");

  socket.on("createRoom", async ({ roomId, username }) => {
    try {
      if (db.enabled()) {
        const roomDoc = await db.createOrGetRoom(roomId, username);
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        socketToUsername[socket.id] = username;
        // ensure a puzzle exists for the room; if db didn't include one, pick and broadcast without persisting
        // ensure a host field is present in the broadcasted room (non-persisted if DB doesn't have it)
        const broadcastRoom = Object.assign({}, roomDoc);
        if (!broadcastRoom.host) broadcastRoom.host = username;
        if (!broadcastRoom.currentMovie) {
          const chosen = chooseRandomMovie();
          broadcastRoom.currentMovie = chosen;
        }
        io.to(roomId).emit("roomUpdate", broadcastRoom);
        console.log(`${username} created/joined room ${roomId} (persisted)`);
        return;
      }
      // fallback: in-memory
      if (!rooms[roomId]) {
        rooms[roomId] = { users: [], messages: [], createdAt: new Date().toISOString() };
        // choose an initial puzzle for the room
        const chosen = chooseRandomMovie();
        if (chosen) rooms[roomId].currentMovie = chosen;
        // set creator as host for in-memory rooms
        rooms[roomId].host = username;
        console.log(`Room ${roomId} created by ${username}`);
      }
      if (!rooms[roomId].users.includes(username)) rooms[roomId].users.push(username);
      socket.join(roomId);
      socketToRoom[socket.id] = roomId;
      socketToUsername[socket.id] = username;
      io.to(roomId).emit("roomUpdate", rooms[roomId]);
      console.log(`${username} joined room ${roomId}`);
    } catch (err) {
      console.error('createRoom error', err);
      socket.emit('error', 'create_room_failed');
    }
  });

  socket.on("joinRoom", async ({ roomId, username }) => {
    try {
      if (db.enabled()) {
        const roomDoc = await db.getRoom(roomId);
        if (!roomDoc) {
          socket.emit("error", "Room not found");
          return;
        }
        const updated = await db.addUserToRoom(roomId, username);
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        socketToUsername[socket.id] = username;
        // include host if persisted room doesn't have one (broadcast-only)
        const broadcastRoom = Object.assign({}, updated);
        if (!broadcastRoom.host) broadcastRoom.host = username;
        if (!broadcastRoom.currentMovie) {
          const chosen = chooseRandomMovie();
          broadcastRoom.currentMovie = chosen;
        }
        io.to(roomId).emit("roomUpdate", broadcastRoom);
        console.log(`${username} joined room ${roomId} (persisted)`);
        return;
      }

      if (rooms[roomId]) {
        if (!rooms[roomId].users.includes(username)) rooms[roomId].users.push(username);
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        socketToUsername[socket.id] = username;
        io.to(roomId).emit("roomUpdate", rooms[roomId]);
        console.log(`${username} joined room ${roomId}`);
      } else {
        socket.emit("error", "Room not found");
      }
    } catch (err) {
      console.error('joinRoom error', err);
      socket.emit('error', 'join_room_failed');
    }
  });

  // Request server to pick a new puzzle for the room and broadcast it (host-only)
  socket.on("nextPuzzle", async ({ roomId, difficulty } = {}, ack) => {
    try {
      // determine host for the room
      let host = null;
      if (rooms[roomId] && rooms[roomId].host) host = rooms[roomId].host;
      if (!host && db.enabled()) {
        try {
          const roomDoc = await db.getRoom(roomId);
          if (roomDoc && roomDoc.host) host = roomDoc.host;
        } catch (e) {
          // ignore db errors here
        }
      }

      const requester = socketToUsername[socket.id];
      if (host && requester !== host) {
        if (typeof ack === 'function') ack({ error: 'not_host' });
        return;
      }

      const chosen = chooseRandomMovie(difficulty);
      if (!chosen) {
        if (typeof ack === 'function') ack({ error: 'no_movies_available' });
        return;
      }
      // update in-memory room if present
      if (rooms[roomId]) {
        rooms[roomId].currentMovie = chosen;
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
        if (typeof ack === 'function') ack({ ok: true, movie: chosen });
        return;
      }
      // otherwise just broadcast to the room sockets
      io.to(roomId).emit('puzzleUpdate', chosen);
      if (typeof ack === 'function') ack({ ok: true, movie: chosen });
    } catch (err) {
      console.error('nextPuzzle error', err);
      if (typeof ack === 'function') ack({ error: 'server_error' });
    }
  });

  // Accept optional acknowledgement callback as third param
  socket.on("chatMessage", async ({ roomId, username, message }, ack) => {
    try {
      const saved = {
        id: makeId(),
        username,
        message,
        timestamp: new Date().toISOString(),
      };

      if (db.enabled()) {
        await db.addMessageToRoom(roomId, saved);
        io.to(roomId).emit("newMessage", saved);
        if (typeof ack === "function") ack(saved);
        return;
      }

      if (rooms[roomId]) {
        rooms[roomId].messages.push(saved);
        io.to(roomId).emit("newMessage", saved);
        if (typeof ack === "function") ack(saved);
      } else if (typeof ack === "function") {
        ack({ error: "room_not_found" });
      }
    } catch (err) {
      console.error('chatMessage error', err);
      if (typeof ack === 'function') ack({ error: 'server_error' });
    }
  });

  socket.on("disconnect", async () => {
    console.log("🔴 User disconnected:", socket.id);
    const roomId = socketToRoom[socket.id];
    const username = socketToUsername[socket.id];
    if (roomId) {
      try {
        if (db.enabled()) {
          const roomDoc = await db.removeUserFromRoom(roomId, username);
          socket.leave(roomId);
          io.to(roomId).emit("roomUpdate", roomDoc);
        } else if (rooms[roomId]) {
          rooms[roomId].users = rooms[roomId].users.filter((u) => u !== username);
          socket.leave(roomId);
          io.to(roomId).emit("roomUpdate", rooms[roomId]);
          if (rooms[roomId].users.length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      } catch (err) {
        console.error('disconnect cleanup error', err);
      }
    }
    delete socketToRoom[socket.id];
    delete socketToUsername[socket.id];
  });

  // WebRTC signaling helpers
  // join-room: join a socket.io room and notify other peers
  socket.on("join-room", (roomId, userName) => {
    socket.join(roomId);
    console.log(`${userName} joined ${roomId}`);
    // notify other peers in the room that a new user joined
    socket.to(roomId).emit("user-joined", socket.id);
  });

  // Forward SDP offers to other peers in the room
  socket.on("offer", (data) => {
    // data should include { roomId, from, offer }
    if (data && data.roomId) {
      socket.to(data.roomId).emit("offer", data);
    }
  });

  // Forward SDP answers to other peers in the room
  socket.on("answer", (data) => {
    // data should include { roomId, from, answer }
    if (data && data.roomId) {
      socket.to(data.roomId).emit("answer", data);
    }
  });

  // Forward ICE candidates to other peers in the room
  socket.on("ice-candidate", (data) => {
    // data should include { roomId, from, candidate }
    if (data && data.roomId) {
      socket.to(data.roomId).emit("ice-candidate", data.candidate || data);
    }
  });
});

// bind to 0.0.0.0 so the server is reachable from other devices on the LAN
// bind to 0.0.0.0 so the server is reachable from other devices on the LAN
// handle startup errors (EADDRINUSE etc.) with a helpful message
server.on("error", (err) => {
  console.error("Server error during startup:", err && err.code ? `${err.code} - ${err.message}` : err);
  process.exit(1);
});

server.listen(4000, "0.0.0.0", () => {
  const protocol = "http"; // local dev uses HTTP
  console.log(`🚀 Server running on ${protocol}://0.0.0.0:4000 (listening on all interfaces)`);
});
