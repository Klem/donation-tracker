import { GraphQLClient } from 'graphql-request';

// Ponder GraphQL endpoint (adjust port if needed)
const PONDER_URL = process.env.PONDER_URL || 'http://localhost:42069/graphql';

export const ponderClient = new GraphQLClient(PONDER_URL);

// GraphQL queries for your Ponder schema

export const GET_DONATOR_STATS = `
  query GetDonatorStats($address: String!) {
    donatorStats(id: $address) {
      id
      totalDonations
      donationCount
      lastDonationTimestamp
    }
  }
`;

export const GET_DONATIONS_BY_DONATOR = `
  query GetDonationsByDonator($donator: String!) {
    donations(where: { donator: $donator }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        amount
        timestamp
        index
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_RECENT_DONATIONS = `
  query GetRecentDonations($limit: Int = 10) {
    donations(orderBy: "timestamp", orderDirection: "desc", limit: $limit) {
      items {
        id
        donator
        amount
        timestamp
        index
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_ALLOCATIONS_BY_DONATOR = `
  query GetAllocationsByDonator($donator: String!) {
    allocations(where: { donator: $donator }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        from
        to
        amount
        timestamp
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_RECIPIENT_STATS = `
  query GetRecipientStats($address: String!) {
    recipientStats(id: $address) {
      id
      totalReceived
      totalSpent
      allocationCount
      spendingCount
    }
  }
`;

export const GET_ALL_RECIPIENT_STATS = `
  query GetAllRecipientStats {
    recipientStatss(orderBy: "totalReceived", orderDirection: "desc") {
      items {
        id
        totalReceived
        totalSpent
        allocationCount
        spendingCount
      }
    }
  }
`;

export const GET_SPENDING_BY_RECIPIENT = `
  query GetSpendingByRecipient($from: String!) {
    spendings(where: { from: $from }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        from
        to
        amount
        timestamp
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_SPENDING_REASONS = `
  query GetSpendingReasons($donator: String!) {
    spendingReasons(where: { donator: $donator }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        message
        timestamp
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_ALL_SPENDING_REASONS = `
  query GetAllSpendingReasons {
    spendingReasons(orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        message
        timestamp
        transactionHash
        blockNumber
      }
    }
  }
`;

export const GET_ALL_DONATIONS = `
  query GetAllDonations {
    donations(orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        donator
        amount
        timestamp
        index
        transactionHash
        blockNumber
      }
    }
  }
`;

// Helper types
export interface DonatorStats {
  id: string;
  totalDonations: string;
  donationCount: number;
  lastDonationTimestamp: number;
}

export interface Donation {
  id: string;
  donator: string;
  amount: string;
  timestamp: number;
  index: number;
  transactionHash: string;
  blockNumber: number;
}

export interface Allocation {
  id: string;
  donator: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface RecipientStats {
  id: string;
  totalReceived: string;
  totalSpent: string;
  allocationCount: number;
  spendingCount: number;
}

export interface Spending {
  id: string;
  donator: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}

export interface SpendingReason {
  id: string;
  donator: string;
  message: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}
