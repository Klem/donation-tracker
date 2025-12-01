'use client'
import React, {useState, useMemo, useEffect} from 'react'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "../ui/card";
import {Button} from "@/components/ui/button";
import {DollarSign} from "lucide-react";
import {
    useAccount,
    useReadContract,
    useReadContracts,
    useWriteContract,
    useWaitForTransactionReceipt,
    usePublicClient
} from "wagmi";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "@/utils/constants";
import {formatEther, parseEther} from "viem";
import {GenerateReceiptButton} from "./GenerateReceiptButton";

const Donator = () => {

    const {address, isConnected} = useAccount();
    const publicClient = usePublicClient();
    const [donationAmount, setDonationAmount] = useState('');
    const [pastDonations, setPastDonations] = useState<any[]>([]);

    // Récupération des statistiques du user
    const {data: totalDonations, refetch: refetchTotalDonations} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'userTotalDonations',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: donationCount, refetch: refetchDonationCount} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'userDonationCount',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: unspentDonations, refetch: refetchUnspentDonations} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'userUnspentDonations',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected,
        },
    });

    // Préparer les appels pour récupérer toutes les donations
    const donationContracts = useMemo(() => {
        if (!address || !donationCount) return [];
        const count = Number(donationCount);
        return Array.from({length: count}, (_, i) => ({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'userDonationAt',
            args: [address, i],
        }));
    }, [address, donationCount]);

    // Récupérer toutes les donations
    const {data: donations, refetch: refetchDonations} = useReadContracts({
        contracts: donationContracts,
        query: {
            enabled: donationContracts.length > 0,
        },
    });

    // Fonction de donation
    const {data: hash, writeContract, isPending} = useWriteContract();

    const {isLoading: isConfirming, isSuccess} = useWaitForTransactionReceipt({
        hash,
    });

    const handleDonate = async () => {
        if (!donationAmount || parseFloat(donationAmount) <= 0) return;

        try {
            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'donate',
                value: parseEther(donationAmount),
            });
        } catch (error) {
            console.error('Donation error:', error);
        }
    };

    // Reset form and refetch data after successful donation
    useEffect(() => {
        if (isSuccess) {
            setDonationAmount('');
            // Refetch all contract data
            refetchTotalDonations();
            refetchDonationCount();
            refetchUnspentDonations();
            refetchDonations();
        }
    }, [isSuccess, refetchTotalDonations, refetchDonationCount, refetchUnspentDonations, refetchDonations]);

    // Récupérer les donations passées depuis les logs
    useEffect(() => {
        if (!publicClient || !address) return;

        const fetchPastDonations = async () => {
            try {
                const logs = await publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    event: {
                        type: 'event',
                        name: 'DonationReceived',
                        inputs: [
                            {type: 'address', name: 'donator', indexed: true},
                            {type: 'uint256', name: 'amount', indexed: false},
                            {type: 'uint256', name: 'index', indexed: false},
                        ],
                    },
                    args: {
                        donator: address,
                    },
                    fromBlock: 0n,
                    toBlock: 'latest',
                });

                const formattedLogs = logs.map((log: any) => ({
                    amount: parseFloat(formatEther(log.args.amount as bigint)).toFixed(4),
                    index: Number(log.args.index),
                    blockNumber: Number(log.blockNumber),
                    transactionHash: log.transactionHash,
                }));

                setPastDonations(formattedLogs);
            } catch (error) {
                console.error('Error fetching past donations:', error);
            }
        };

        fetchPastDonations();
    }, [publicClient, address, isSuccess]); // Refresh when new donation succeeds

    // Formater les données
    const userStats = {
        totalDonations: totalDonations ? parseFloat(formatEther(totalDonations as bigint)).toFixed(4) : '0.0000',
        donationCount: donationCount ? donationCount.toString() : '0',
        unspentDonations: unspentDonations ? parseFloat(formatEther(unspentDonations as bigint)).toFixed(4) : '0.0000'
    };

    // Donations en cours (celles qui ont encore du remaining > 0)
    const activeDonations = useMemo(() => {
        if (!donations) return [];
        return donations
            .map((d, index) => {
                if (!d.result) return null;
                const donation = d.result as {
                    donator: string,
                    amount: bigint,
                    remaining: bigint,
                    timestamp: bigint,
                    allocated: boolean,
                    receiptRequested: boolean,
                    receiptMinted: boolean,
                    index: bigint
                };

                // Ne garder que les donations avec remaining > 0
                if (donation.remaining === 0n) return null;

                return {
                    donator: donation.donator,
                    amount: parseFloat(formatEther(donation.amount)).toFixed(4),
                    amountBigInt: donation.amount,
                    remaining: parseFloat(formatEther(donation.remaining)).toFixed(4),
                    timestamp: new Date(Number(donation.timestamp) * 1000).toLocaleString(),
                    timestampBigInt: donation.timestamp,
                    index: Number(donation.index),
                    allocated: donation.allocated,
                    receiptRequested: donation.receiptRequested,
                    receiptMinted: donation.receiptMinted,
                };
            })
            .filter(d => d !== null)
            .reverse(); // Afficher les plus récentes en premier
    }, [donations]);

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Dashboard</h2>
                    <p className="text-slate-600">Manage your donations and track fund flow</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-blue-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Total Donations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700">{userStats.totalDonations} ETH</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-gradient-to-br from-purple-50 to-purple-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Donation Count</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-700">{userStats.donationCount}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-gradient-to-br from-green-50 to-green-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Unspent</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">{userStats.unspentDonations} ETH</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <Card className="border-slate-200 mt-6">
                        <CardHeader>
                            <CardTitle>Make a Donation</CardTitle>
                            <CardDescription>Send ETH to support the project</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Amount (ETH)</label>
                                <input
                                    type="number"
                                    placeholder="0.0"
                                    value={donationAmount}
                                    onChange={(e) => setDonationAmount(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    disabled={isPending || isConfirming}
                                />
                            </div>
                            <Button
                                onClick={handleDonate}
                                disabled={isPending || isConfirming || !donationAmount || parseFloat(donationAmount) <= 0}
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50">
                                {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Donate Now'}
                            </Button>
                            {isSuccess && (
                                <div className="text-sm text-green-600 text-center">
                                    Donation successful! 🎉
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Donations en cours */}
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Donations en cours</CardTitle>
                        <CardDescription>Vos donations avec des fonds non alloués</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucune donation en cours. Toutes vos donations ont été entièrement allouées!
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeDonations.map((donation) => (
                                    <div
                                        key={donation.index}
                                        className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                                                <DollarSign className="w-5 h-5 text-white"/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-slate-900">{donation.amount} ETH</div>
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                        Active
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-500">{donation.timestamp}</div>
                                                <div className="text-xs text-blue-700 mt-1 font-semibold">
                                                    Remaining: {donation.remaining} ETH
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600 font-mono">#{donation.index}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Donations passées */}
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Donations passées</CardTitle>
                        <CardDescription>Historique complet de toutes vos donations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pastDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucune donation trouvée. Faites votre première donation ci-dessus!
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pastDonations.map((donation) => (
                                    <div
                                        key={`${donation.transactionHash}-${donation.index}`}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-500 to-gray-600">
                                                <DollarSign className="w-5 h-5 text-white"/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-slate-900">{donation.amount} ETH</div>
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                                                        Block #{donation.blockNumber}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono mt-1">
                                                    {donation.transactionHash.substring(0, 10)}...{donation.transactionHash.substring(donation.transactionHash.length - 8)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600 font-mono">#{donation.index}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
export default Donator
