const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "dynamics_node";

let client;
let db;

async function connectMongoDB() {
  if (db) {
    return db;
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB_NAME);

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("categories").createIndex({ name: 1 }, { unique: true }),
    db.collection("products").createIndex({ category_id: 1 }),
    db.collection("orders").createIndex({ user_id: 1 })
  ]);

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("MongoDB is not connected");
  }
  return db;
}

function toObjectId(id) {
  if (!id || !ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectMongoDB,
  getDb,
  toObjectId,
  closeMongoDB
};
