'use client'
import React, {useState, useEffect, useMemo} from 'react'
import {useReadContract, useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt} from "wagmi";
import {formatEther, parseAbiItem} from "viem";
import {DollarSign, TrendingUp, Users, Wallet, TrendingDown} from "lucide-react";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "../../utils/constants";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Donation} from "@/utils/interfaces";


const Admin = () => {

    const {address, isConnected} = useAccount();
    const [donatorToView, setDonatorToView] = useState<string | null>(null);
    const [pendingDonations, setPendingDonations] = useState<any[]>([]);
    const [allocatedDonations, setAllocatedDonations] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const publicClient = usePublicClient();

    // Récupération des statistiques globales
    const {data: totalDonated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonated',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalDonators} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonators',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalAllocated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalAllocated',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalSpent} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalSpent',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: contractBalance} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'contractBalance',
        query: {
            enabled: !!address && isConnected,
        },
    });

    // Récupération du nombre de donations pour l'adresse recherchée
    const {data: donationCount} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'userDonationCount',
        args: donatorToView ? [donatorToView as `0x${string}`] : undefined,
        query: {
            enabled: !!donatorToView,
        },
    });

    // Récupérer tous les événements DonationReceived
    useEffect(() => {
        const fetchDonations = async () => {
            if (!publicClient) return;

            try {
                const logs = await publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    event: parseAbiItem('event DonationReceived(address indexed donator, uint amount, uint indexed timestamp, uint index)'),
                    fromBlock: 0n,
                    toBlock: 'latest'
                });

                const donations = logs.map((log: any) => ({
                    donator: log.args.donator,
                    amount: log.args.amount,
                    timestamp: log.args.timestamp,
                    index: log.args.index,
                    blockNumber: log.blockNumber
                }));

                // Récupérer les détails de chaque donation pour les séparer
                const donationsWithDetails = await Promise.all(
                    donations.map(async (d) => {
                        try {
                            const details = await publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: CONTRACT_ABI,
                                functionName: 'userDonationAt',
                                args: [d.donator as `0x${string}`, d.index],
                            });
                            return { ...d, details };
                        } catch (error) {
                            console.error('Error fetching donation details:', error);
                            return null;
                        }
                    })
                );

                const validDonations = donationsWithDetails.filter((d): d is NonNullable<typeof d> => d !== null);

                // Séparer en deux listes : non allouées et allouées
                const pending = validDonations
                    .filter((d: any) => {
                        const details = d.details as Donation;
                        return !details.allocated;
                    })
                    .reverse();

                const allocated = validDonations
                    .filter((d: any) => {
                        const details = d.details as Donation;
                        return details.allocated;
                    })
                    .reverse();

                setPendingDonations(pending);
                setAllocatedDonations(allocated);
            } catch (error) {
                console.error('Error fetching donations:', error);
            }
        };

        fetchDonations();
    }, [publicClient, refreshTrigger]);

    // Formatage des stats
    const stats = {
        totalDonated: totalDonated ? parseFloat(formatEther(totalDonated as bigint)).toFixed(2) : '0.00',
        totalDonators: totalDonators ? totalDonators.toString() : '0',
        totalAllocated: totalAllocated ? parseFloat(formatEther(totalAllocated as bigint)).toFixed(2) : '0.00',
        totalSpent: totalSpent ? parseFloat(formatEther(totalSpent as bigint)).toFixed(2) : '0.00',
        contractBalance: contractBalance ? parseFloat(formatEther(contractBalance as bigint)).toFixed(2) : '0.00'
    };

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h2>
                    <p className="text-slate-600">Manage donations and allocations</p>
                </div>

                {/* Global Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-500"/>
                                Total Donated
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalDonated} ETH</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-500"/>
                                Total Donators
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalDonators}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500"/>
                                Total Allocated
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalAllocated} ETH</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-500"/>
                                Total Spent
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalSpent} ETH</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-orange-500"/>
                                Contract Balance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.contractBalance} ETH</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Donations à allouer */}
                <Card className="border-slate-200 mb-8">
                    <CardHeader>
                        <CardTitle>Donations à allouer</CardTitle>
                        <CardDescription>
                            {pendingDonations.length} donation{pendingDonations.length !== 1 ? 's' : ''} en attente d'allocation
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pendingDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucune donation à allouer
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingDonations.map((donation, idx) => (
                                    <DonationItem
                                        key={`pending-${donation.donator}-${donation.index}-${idx}`}
                                        donator={donation.donator}
                                        amount={donation.amount}
                                        timestamp={donation.timestamp}
                                        index={donation.index}
                                        isPending={true}
                                        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Historique des donations allouées */}
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Historique des allocations</CardTitle>
                        <CardDescription>
                            {allocatedDonations.length} donation{allocatedDonations.length !== 1 ? 's' : ''} déjà allouée{allocatedDonations.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {allocatedDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucune donation allouée pour le moment
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {allocatedDonations.map((donation, idx) => (
                                    <DonationItem
                                        key={`allocated-${donation.donator}-${donation.index}-${idx}`}
                                        donator={donation.donator}
                                        amount={donation.amount}
                                        timestamp={donation.timestamp}
                                        index={donation.index}
                                        isPending={false}
                                        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// Individual donation item
const DonationItem = ({donator, amount, timestamp, index, isPending = false, onSuccess}: {
    donator: string,
    amount: bigint,
    timestamp: bigint,
    index: bigint,
    isPending?: boolean,
    onSuccess?: () => void
}) => {
    // Récupérer les détails complets de la donation
    const {data: donation, refetch} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'userDonationAt',
        args: [donator as `0x${string}`, index],
    });

    // Fonction d'allocation
    const {data: hash, writeContract, isPending: isWritePending} = useWriteContract();

    const {isLoading: isConfirming, isSuccess} = useWaitForTransactionReceipt({
        hash,
    });

    // Refetch après succès et rafraîchir la liste parente
    useEffect(() => {
        if (isSuccess) {
            refetch();
            if (onSuccess) {
                onSuccess();
            }
        }
    }, [isSuccess, refetch, onSuccess]);

    if (!donation) return null;

    const donationData = donation as Donation;

    const handleAllocate = () => {
        console.log('🔵 Allocate clicked', {
            donator: donationData.donator,
            amount: donationData.amount.toString(),
            index: donationData.index.toString()
        });

        try {
            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'allocate',
                args: [{
                    donator: donationData.donator as `0x${string}`, // ✅ Pas de 0x devant!
                    amount: donationData.amount,
                    remaining: donationData.remaining,
                    timestamp: donationData.timestamp,
                    allocated: donationData.allocated,
                    receiptRequested: donationData.receiptRequested,
                    receiptMinted: donationData.receiptMinted,
                    index: donationData.index
                }],
            });
            console.log('✅ writeContract called');
        } catch (error) {
            console.error('❌ Allocation error:', error);
        }
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-lg border ${
            isPending
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
        }`}>
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500">
                        {donator.slice(0, 6)}...{donator.slice(-4)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">Index #{index.toString()}</span>
                    <span className="text-xs text-slate-500">
                        {new Date(Number(timestamp) * 1000).toLocaleString()}
                    </span>
                    {isPending ? (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            À allouer
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            Allouée
                        </span>
                    )}
                </div>
                <div className="font-bold text-lg text-slate-900">
                    {parseFloat(formatEther(amount)).toFixed(4)} ETH
                </div>
                <div className={`text-xs ${isPending ? 'text-yellow-700 font-semibold' : 'text-green-700'}`}>
                    Remaining: {parseFloat(formatEther(donationData.remaining)).toFixed(4)} ETH
                </div>
            </div>
            {isPending && (
                <Button
                    onClick={handleAllocate}
                    disabled={isWritePending || isConfirming}
                    className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 disabled:opacity-50"
                >
                    {isWritePending ? 'Confirming...' : isConfirming ? 'Allocating...' : 'Allocate'}
                </Button>
            )}
        </div>
    );
};

export default Admin
