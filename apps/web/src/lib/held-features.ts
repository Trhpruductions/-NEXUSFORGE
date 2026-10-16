// Features on hold pending legal review. They are hidden from users while these switches are false.
// Nothing is deleted: user balances, rigs, and tickets stay in the database. The server-side routes are unchanged.
// Turn a switch back on only after the owner approves re-enabling that feature.
export const MINING_ENABLED = false;
export const JACKPOT_ENABLED = false;
