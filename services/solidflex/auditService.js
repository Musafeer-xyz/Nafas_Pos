const SfAuditLog = require('../../models/solidflex/SfAuditLog');

/**
 * Write an audit entry. Pass a Mongoose session to write atomically with the
 * mutation it describes (if the mutation rolls back, so does the log entry).
 * Never throws — audit failure must not break business flow, but it logs loudly.
 */
async function writeAudit(opts, session = null) {
  const { user, userId = '', role = '', action, entity, entityId = '', before = null, after = null, ip = '' } = opts;
  try {
    const doc = new SfAuditLog({ user, userId, role, action, entity, entityId, before, after, ip });
    if (session) return await doc.save({ session });
    return await doc.save();
  } catch (err) {
    // Non-fatal by design; surface in server logs.
    console.error('[solidflex] audit write failed:', err.message);
    return null;
  }
}

/** Strip volatile fields before storing before/after snapshots */
function snapshot(obj) {
  if (!obj) return obj;
  const { _id, __v, createdAt, updatedAt, ...rest } = obj;
  return rest;
}

module.exports = { writeAudit, snapshot };
