const FINAL_BILL_STATUSES = new Set(['tabled', 'passed', 'rejected'])

export function normalizeBillStatus(status) {
  if (FINAL_BILL_STATUSES.has(status)) return status
  return 'discussion'
}

export function isDiscussionBill(bill) {
  return normalizeBillStatus(bill?.status) === 'discussion'
}
