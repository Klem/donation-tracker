import { useQuery } from '@tanstack/react-query';
import {
  ponderClient,
  GET_DONATOR_STATS,
  GET_DONATIONS_BY_DONATOR,
  GET_RECENT_DONATIONS,
  GET_ALLOCATIONS_BY_DONATOR,
  GET_RECIPIENT_STATS,
  GET_ALL_RECIPIENT_STATS,
  GET_SPENDING_BY_RECIPIENT,
  GET_SPENDING_REASONS,
  GET_ALL_SPENDING_REASONS,
  GET_ALL_DONATIONS,
  DonatorStats,
  Donation,
  Allocation,
  RecipientStats,
  Spending,
  SpendingReason,
} from '@/lib/ponder';

// Hook to get donator statistics
export function useDonatorStats(address?: string) {
  return useQuery<DonatorStats | null>({
    queryKey: ['donatorStats', address],
    queryFn: async () => {
      if (!address) return null;
      const data = await ponderClient.request(GET_DONATOR_STATS, { address: address.toLowerCase() });
      return (data as any).donatorStats;
    },
    enabled: !!address,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

// Hook to get all donations by a donator
export function useDonationsByDonator(donator?: string) {
  return useQuery<Donation[]>({
    queryKey: ['donations', donator],
    queryFn: async () => {
      if (!donator) return [];
      const data = await ponderClient.request(GET_DONATIONS_BY_DONATOR, { donator: donator.toLowerCase() });
      return (data as any).donations.items;
    },
    enabled: !!donator,
    refetchInterval: 10000,
  });
}

// Hook to get recent donations (public view)
export function useRecentDonations(limit: number = 10) {
  return useQuery<Donation[]>({
    queryKey: ['recentDonations', limit],
    queryFn: async () => {
      const data = await ponderClient.request(GET_RECENT_DONATIONS, { limit });
      return (data as any).donations.items;
    },
    refetchInterval: 10000,
  });
}

// Hook to get allocations by donator
export function useAllocationsByDonator(donator?: string) {
  return useQuery<Allocation[]>({
    queryKey: ['allocations', donator],
    queryFn: async () => {
      if (!donator) return [];
      const data = await ponderClient.request(GET_ALLOCATIONS_BY_DONATOR, { donator: donator.toLowerCase() });
      return (data as any).allocations.items;
    },
    enabled: !!donator,
    refetchInterval: 10000,
  });
}

// Hook to get recipient statistics
export function useRecipientStats(address?: string) {
  return useQuery<RecipientStats | null>({
    queryKey: ['recipientStats', address],
    queryFn: async () => {
      if (!address) return null;
      const data = await ponderClient.request(GET_RECIPIENT_STATS, { address: address.toLowerCase() });
      return (data as any).recipientStats;
    },
    enabled: !!address,
    refetchInterval: 10000,
  });
}

// Hook to get all recipient statistics
export function useAllRecipientStats() {
  return useQuery<RecipientStats[]>({
    queryKey: ['allRecipientStats'],
    queryFn: async () => {
      const data = await ponderClient.request(GET_ALL_RECIPIENT_STATS);
      return (data as any).recipientStatss.items;
    },
    refetchInterval: 10000,
  });
}

// Hook to get spending by recipient
export function useSpendingByRecipient(from?: string) {
  return useQuery<Spending[]>({
    queryKey: ['spending', from],
    queryFn: async () => {
      if (!from) return [];
      const data = await ponderClient.request(GET_SPENDING_BY_RECIPIENT, { from: from.toLowerCase() });
      return (data as any).spendings.items;
    },
    enabled: !!from,
    refetchInterval: 10000,
  });
}

// Hook to get spending reasons by donator
export function useSpendingReasons(donator?: string) {
  return useQuery<SpendingReason[]>({
    queryKey: ['spendingReasons', donator],
    queryFn: async () => {
      if (!donator) return [];
      const data = await ponderClient.request(GET_SPENDING_REASONS, { donator: donator.toLowerCase() });
      return (data as any).spendingReasons.items;
    },
    enabled: !!donator,
    refetchInterval: 10000,
  });
}

// Hook to get all spending reasons (no filter)
export function useAllSpendingReasons() {
  return useQuery<SpendingReason[]>({
    queryKey: ['allSpendingReasons'],
    queryFn: async () => {
      const data = await ponderClient.request(GET_ALL_SPENDING_REASONS);
      return (data as any).spendingReasons.items;
    },
    refetchInterval: 10000,
  });
}

// Hook to get spending with reasons combined (for Recipient view)
export function useSpendingWithReasons(recipientAddress?: string) {
  const { data: spendings = [] } = useSpendingByRecipient(recipientAddress);
  const { data: allReasons = [] } = useAllSpendingReasons();

  return useQuery({
    queryKey: ['spendingWithReasons', recipientAddress, spendings, allReasons],
    queryFn: () => {
      return spendings.map(spending => {
        // Find matching reason by transaction hash AND donator (most reliable)
        // FundsSpent and SpendingReason are emitted in the same transaction
        const matchingReason = allReasons.find(reason =>
          reason.transactionHash.toLowerCase() === spending.transactionHash.toLowerCase() &&
          reason.donator.toLowerCase() === spending.donator.toLowerCase()
        );

        return {
          ...spending,
          reason: matchingReason?.message || 'No reason provided'
        };
      });
    },
    enabled: spendings.length > 0,
  });
}

// Hook to get all donations (for Admin view)
export function useAllDonations() {
  return useQuery<Donation[]>({
    queryKey: ['allDonations'],
    queryFn: async () => {
      const data = await ponderClient.request(GET_ALL_DONATIONS);
      return (data as any).donations.items;
    },
    refetchInterval: 10000,
  });
}
