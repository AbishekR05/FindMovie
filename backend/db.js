const { MongoClient } = require('mongodb');

let client = null;
let roomsCol = null;

async function init(uri, dbName = 'findmovie') {
  if (!uri) return;
  client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);
  roomsCol = db.collection('rooms');
  await roomsCol.createIndex({ roomId: 1 }, { unique: true }).catch(() => {});
  console.log('✅ db.init: connected to MongoDB', dbName);
}

function enabled() {
  return !!roomsCol;
}

async function createOrGetRoom(roomId, username) {
  if (!roomsCol) return null;
  await roomsCol.updateOne(
    { roomId },
    {
      $setOnInsert: { roomId, createdAt: new Date().toISOString(), messages: [] },
      $addToSet: { users: username },
    },
    { upsert: true }
  );
  return roomsCol.findOne({ roomId });
}

async function getRoom(roomId) {
  if (!roomsCol) return null;
  return roomsCol.findOne({ roomId });
}

async function addUserToRoom(roomId, username) {
  if (!roomsCol) return null;
  await roomsCol.updateOne({ roomId }, { $addToSet: { users: username } });
  return roomsCol.findOne({ roomId });
}

async function addMessageToRoom(roomId, message) {
  if (!roomsCol) return null;
  await roomsCol.updateOne({ roomId }, { $push: { messages: message } });
  return message;
}

async function removeUserFromRoom(roomId, username) {
  if (!roomsCol) return null;
  await roomsCol.updateOne({ roomId }, { $pull: { users: username } });
  return roomsCol.findOne({ roomId });
}

async function setCurrentMovie(roomId, currentMovie) {
  if (!roomsCol) return null;
  await roomsCol.updateOne({ roomId }, { $set: { currentMovie } });
  return roomsCol.findOne({ roomId });
}

module.exports = {
  init,
  enabled,
  createOrGetRoom,
  getRoom,
  addUserToRoom,
  addMessageToRoom,
  removeUserFromRoom,
};
