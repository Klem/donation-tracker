import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// Handler for DonationReceived event
ponder.on("DonationTracker:DonationReceived", async ({ event, context }) => {
  const { donator, amount, timestamp, index } = event.args;
  const { db } = context;

  // Create donation record
  await db.insert(schema.donation).values({
    id: `${donator}-${index}`,
    donator,
    amount: amount.toString(),
    timestamp: Number(timestamp),
    index: Number(index),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });

  // Upsert donator stats
  await db
    .insert(schema.donatorStats)
    .values({
      id: donator,
      totalDonations: amount.toString(),
      donationCount: 1,
      lastDonationTimestamp: Number(timestamp),
    })
    .onConflictDoUpdate((row) => ({
      totalDonations: (BigInt(row.totalDonations) + amount).toString(),
      donationCount: row.donationCount + 1,
      lastDonationTimestamp: Number(timestamp),
    }));
});

// Handler for FundsAllocated event
ponder.on("DonationTracker:FundsAllocated", async ({ event, context }) => {
  const { donator, from, to, amount, timestamp } = event.args;
  const { db } = context;

  // Create allocation record
  await db.insert(schema.allocation).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    donator,
    from,
    to,
    amount: amount.toString(),
    timestamp: Number(timestamp),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });

  // Upsert recipient stats
  await db
    .insert(schema.recipientStats)
    .values({
      id: to,
      totalReceived: amount.toString(),
      totalSpent: "0",
      allocationCount: 1,
      spendingCount: 0,
    })
    .onConflictDoUpdate((row) => ({
      totalReceived: (BigInt(row.totalReceived) + amount).toString(),
      allocationCount: row.allocationCount + 1,
    }));
});

// Handler for FundsSpent event
ponder.on("DonationTracker:FundsSpent", async ({ event, context }) => {
  const { donator, from, to, amount, timestamp } = event.args;
  const { db } = context;

  // Create spending record
  await db.insert(schema.spending).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    donator,
    from,
    to,
    amount: amount.toString(),
    timestamp: Number(timestamp),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });

  // Upsert recipient stats (should exist from FundsAllocated, but handle anyway)
  await db
    .insert(schema.recipientStats)
    .values({
      id: from,
      totalReceived: "0",
      totalSpent: amount.toString(),
      allocationCount: 0,
      spendingCount: 1,
    })
    .onConflictDoUpdate((row) => ({
      totalSpent: (BigInt(row.totalSpent) + amount).toString(),
      spendingCount: row.spendingCount + 1,
    }));
});

// Handler for SpendingReason event
ponder.on("DonationTracker:SpendingReason", async ({ event, context }) => {
  const { donator, timestamp, message } = event.args;
  const { db } = context;

  await db.insert(schema.spendingReason).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    donator,
    timestamp: Number(timestamp),
    message,
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
});

// Handler for ReceiptRequested event
ponder.on("DonationTracker:ReceiptRequested", async ({ event, context }) => {
  const { donator, index, timestamp } = event.args;
  const { db } = context;

  await db.insert(schema.receiptRequest).values({
    id: `${donator}-${index}`,
    donator,
    index: Number(index),
    timestamp: Number(timestamp),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
});

// Handler for ReceiptMinted event
ponder.on("DonationTracker:ReceiptMinted", async ({ event, context }) => {
  const { minter, donator, index, tokenId, timestamp } = event.args;
  const { db } = context;

  await db.insert(schema.receiptMinted).values({
    id: `${donator}-${index}`,
    minter,
    donator,
    index: Number(index),
    tokenId: tokenId.toString(),
    timestamp: Number(timestamp),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
});

// Handler for LeftoverTransferred event
ponder.on("DonationTracker:LeftoverTransferred", async ({ event, context }) => {
  const { from, to, amount, timestamp } = event.args;
  const { db } = context;

  await db.insert(schema.leftoverTransfer).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    from,
    to,
    amount: amount.toString(),
    timestamp: Number(timestamp),
    transactionHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
});
