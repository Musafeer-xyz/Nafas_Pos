const SfCounter = require('../../models/solidflex/SfCounter');

/**
 * Atomic serial generation: SF-<year>-<seq>, zero-padded to 4.
 * Must be called inside the sale's transaction session so concurrent sales
 * each get a unique serial and rollback never burns a number permanently.
 */
async function nextSaleSerial(session) {
  const year = new Date().getFullYear();
  const key = `sf_sale_serial_${year}`;
  const counter = await SfCounter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `SF-${year}-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { nextSaleSerial };
