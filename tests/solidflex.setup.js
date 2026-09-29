const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Pin a much smaller binary (~300MB less than default) — fits slow connections
process.env.MONGOMS_VERSION = '7.0.14';

let replSet;

/**
 * Start in-memory Mongo as a single-node replica set (required for
 * transactions) bound to 127.0.0.1, then connect Mongoose.
 * Never touches the real DB.
 */
async function startDb() {
  replSet = await MongoMemoryReplSet.create({
    instance: { ip: '127.0.0.1', storageEngine: 'wiredTiger' },
    replSet: { count: 1, name: 'rs0' },
  });
  const uri = replSet.getUri('nafas_test');
  await mongoose.connect(uri);
  await warmup();
  return uri;
}

/**
 * Pre-create collections + run one throwaway transaction. Avoids the
 * "Collection namespace is already in use" transient on the first real
 * transaction of a virgin database (implicit collection creation race).
 */
async function warmup() {
  const names = ['sfmasters', 'sfproducts', 'sfshipments', 'sfsales', 'sfexpenses', 'sfauditlogs', 'sfcounters'];
  for (const n of names) {
    try { await mongoose.connection.createCollection(n); }
    catch (e) { if (!/already exists/i.test(String(e.message))) throw e; }
  }
  const session = await mongoose.connection.startSession();
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        session.startTransaction();
        await mongoose.connection.db.collection('warmup').insertOne({ t: Date.now() }, { session });
        await session.commitTransaction();
        return;
      } catch (e) {
        if (session.inTransaction()) await session.abortTransaction();
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, 200 * attempt));
      }
    }
  } finally {
    session.endSession();
  }
}

async function stopDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

/** Fresh collections per test — drops only SOLID FLEX data (sf*), never NAFAS core */
async function cleanDb() {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    // Mongoose pluralizes SfSale → 'sfsales' (no underscore) — match the prefix
    if (/^sf/i.test(c.collectionName)) {
      await c.deleteMany({});
    }
  }
}

module.exports = { startDb, stopDb, cleanDb };
