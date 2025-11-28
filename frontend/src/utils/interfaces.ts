export interface Donation  {
    donator: string,
    amount: bigint,
    remaining: bigint,
    timestamp: bigint,
    allocated: boolean,
    receiptRequested: boolean,
    receiptMinted: boolean,
    index: bigint
};