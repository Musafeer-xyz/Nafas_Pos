const SfMaster = require('../../models/solidflex/SfMaster');
const SfProduct = require('../../models/solidflex/SfProduct');

const PART_KEYS = ['type', 'color', 'design', 'size'];

/**
 * Normalize a PID string: uppercase, collapse whitespace, single hyphens.
 * Returns canonical string or null if it doesn't have 4 segments.
 */
function normalizePid(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const parts = cleaned.split('-');
  if (parts.length !== 4 || parts.some(p => !p)) return null;
  return parts.join('-');
}

/** Split a normalized PID into { type, color, design, size } */
function parsePid(raw) {
  const pid = normalizePid(raw);
  if (!pid) return null;
  const [type, color, design, size] = pid.split('-');
  return { type, color, design, size, pid };
}

/**
 * Validate four attribute values against active master lists.
 * Missing master entries are reported (master lists are the source of truth).
 */
async function validatePartsAgainstMaster(parts, session = null) {
  const errors = [];
  const query = session ? SfMaster.find({}).session(session) : SfMaster.find({});
  const masters = await query.lean();
  const byKind = { type: new Set(), color: new Set(), design: new Set(), size: new Set() };
  for (const m of masters) {
    if (m.isActive && byKind[m.kind]) byKind[m.kind].add(m.value);
  }
  for (const key of PART_KEYS) {
    const val = String(parts[key] || '').trim().toUpperCase();
    if (!val) { errors.push(`${key} is required`); continue; }
    if (byKind[key].size > 0 && !byKind[key].has(val)) {
      errors.push(`${key} "${val}" is not in the ${key} master list`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Build canonical PID from four parts (no master validation) */
function buildPid(parts) {
  return PART_KEYS.map(k => String(parts[k] || '').trim().toUpperCase()).join('-');
}

/**
 * Resolve a PID (case-insensitive, whitespace-tolerant) to the product doc.
 * Returns { product } or { product: null, suggestion } where suggestion is the
 * canonical form of what was typed (for client autofill).
 */
async function resolvePid(raw, session = null) {
  const pid = normalizePid(raw);
  if (!pid) return { product: null, suggestion: null, parseError: true };
  const query = session ? SfProduct.findOne({ pid }).session(session) : SfProduct.findOne({ pid });
  const product = await query.lean();
  return { product, suggestion: pid };
}

module.exports = { normalizePid, parsePid, buildPid, validatePartsAgainstMaster, resolvePid, PART_KEYS };
