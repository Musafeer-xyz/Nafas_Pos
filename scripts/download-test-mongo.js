// One-shot helper: downloads/pins the pinned MongoDB binary for tests,
// writes a marker file when done. Safe to run multiple times.
const fs = require('fs');
process.env.MONGOMS_VERSION = '7.0.14';
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create({ replicaSet: 'rs0' });
  fs.writeFileSync('.mongo-test-ready', String(new Date()));
  console.log('READY', mongod.getUri());
  await mongod.stop();
  process.exit(0);
})().catch(e => {
  fs.writeFileSync('.mongo-test-error', String(e.message || e));
  process.exit(1);
});
