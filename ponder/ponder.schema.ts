import { onchainTable } from "ponder";

// Individual donations
export const donation = onchainTable("donation", (t) => ({
  id: t.text().primaryKey(),
  donator: t.text().notNull(),
  amount: t.text().notNull(),
  timestamp: t.integer().notNull(),
  index: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Donator statistics
export const donatorStats = onchainTable("donator_stats", (t) => ({
  id: t.text().primaryKey(), // donator address
  totalDonations: t.text().notNull(),
  donationCount: t.integer().notNull(),
  lastDonationTimestamp: t.integer().notNull(),
}));

// Fund allocations
export const allocation = onchainTable("allocation", (t) => ({
  id: t.text().primaryKey(),
  donator: t.text().notNull(),
  from: t.text().notNull(),
  to: t.text().notNull(),
  amount: t.text().notNull(),
  timestamp: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Recipient statistics
export const recipientStats = onchainTable("recipient_stats", (t) => ({
  id: t.text().primaryKey(), // recipient address
  totalReceived: t.text().notNull(),
  totalSpent: t.text().notNull(),
  allocationCount: t.integer().notNull(),
  spendingCount: t.integer().notNull(),
}));

// Fund spending
export const spending = onchainTable("spending", (t) => ({
  id: t.text().primaryKey(),
  donator: t.text().notNull(),
  from: t.text().notNull(),
  to: t.text().notNull(),
  amount: t.text().notNull(),
  timestamp: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Spending reasons
export const spendingReason = onchainTable("spending_reason", (t) => ({
  id: t.text().primaryKey(),
  donator: t.text().notNull(),
  timestamp: t.integer().notNull(),
  message: t.text().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Receipt requests
export const receiptRequest = onchainTable("receipt_request", (t) => ({
  id: t.text().primaryKey(),
  donator: t.text().notNull(),
  index: t.integer().notNull(),
  timestamp: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Minted receipts
export const receiptMinted = onchainTable("receipt_minted", (t) => ({
  id: t.text().primaryKey(),
  minter: t.text().notNull(),
  donator: t.text().notNull(),
  index: t.integer().notNull(),
  tokenId: t.text().notNull(),
  timestamp: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

// Leftover transfers
export const leftoverTransfer = onchainTable("leftover_transfer", (t) => ({
  id: t.text().primaryKey(),
  from: t.text().notNull(),
  to: t.text().notNull(),
  amount: t.text().notNull(),
  timestamp: t.integer().notNull(),
  transactionHash: t.text().notNull(),
  blockNumber: t.integer().notNull(),
}));

export const emergencyWithdraw = onchainTable("emergency_withdraw", (t) => ({
    id: t.text().primaryKey(),
    from: t.text().notNull(),
    to: t.text().notNull(),
    amount: t.text().notNull(),
    timestamp: t.integer().notNull(),
    transactionHash: t.text().notNull(),
    blockNumber: t.integer().notNull(),
}));