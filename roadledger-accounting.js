/* Reconcile explicitly identified costs without rewriting financial records. */
(function (root) {
  'use strict';
  const cents = value => Math.round((Number(value) || 0) * 100);
  function reconcile(loads, expenses) {
    const remaining = new Map(loads.map(load => [String(load.id), Math.max(0, cents(load.expenses))]));
    let total = loads.reduce((sum, load) => sum + Math.max(0, cents(load.expenses)), 0);
    let business = total, personal = 0, overlap = 0;
    const details = expenses.map(expense => {
      const amount = Math.max(0, cents(expense.amount));
      const loadId = expense.loadExpenseId == null ? '' : String(expense.loadExpenseId);
      const eligible = expense.payer === 'business' && loadId !== '' && remaining.has(loadId);
      const included = eligible ? Math.min(amount, remaining.get(loadId)) : 0;
      if (eligible) remaining.set(loadId, remaining.get(loadId) - included);
      total += amount - included;
      if (expense.payer === 'business') business += amount - included;
      if (expense.payer === 'driver') personal += amount;
      overlap += included;
      return {included: included / 100, additional: (amount - included) / 100, linked: eligible};
    });
    return {total: total / 100, business: business / 100, personal: personal / 100, overlap: overlap / 100, details};
  }
  const api = {reconcile};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoadLedgerAccounting = api;
})(typeof window === 'undefined' ? globalThis : window);
