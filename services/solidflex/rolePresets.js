/**
 * SOLID FLEX permission keys. Stored on the existing User model's
 * `permissions` object (additive — no schema change needed since it's a
 * free-form embedded object; unlisted keys default to false/undefined).
 *
 * Gate strategy:
 *  - sfManageMasters/sfManageProducts/sfManageExpenses  → Owner+Manager (profit-visible via sfViewProfit)
 *  - sfSell / sfManageShipments                          → Seller and up
 *  - sfViewProfit is stripped server-side for roles without it
 */
const SF_PERMS = {
  sfSell: 'Sell SOLID FLEX',
  sfManageShipments: 'Manage SOLID FLEX shipments',
  sfManageMasters: 'Manage SOLID FLEX master lists & products',
  sfManageExpenses: 'Manage SOLID FLEX expenses',
  sfViewProfit: 'View SOLID FLEX cost & profit',
  sfVoid: 'Void / return SOLID FLEX sales & shipments',
};

const SF_ROLE_PRESETS = {
  owner: Object.fromEntries(Object.keys(SF_PERMS).map(k => [k, true])),
  manager: {
    sfSell: true,
    sfManageShipments: true,
    sfManageMasters: true,
    sfManageExpenses: false, // expenses/cost data is Owner-only per spec §5
    sfViewProfit: false, // cost/profit hidden for managers per spec
    sfVoid: true,
  },
  seller: {
    sfSell: true,
    sfManageShipments: false,
    sfViewProfit: false,
    sfVoid: false,
  },
};

module.exports = { SF_PERMS, SF_ROLE_PRESETS };
