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
    useWaitForTransactionReceipt
} from "wagmi";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "@/utils/constants";
import {formatEther, parseEther} from "viem";
import {GenerateReceiptButton} from "./GenerateReceiptButton";
import { useDonationsByDonator } from "@/hooks/usePonder";

const Donator = () => {

    const {address, isConnected} = useAccount();
    const [donationAmount, setDonationAmount] = useState('');

    // Fetch donations from Ponder (replaces getLogs)
    const { data: pastDonations = [], isLoading: isPastDonationsLoading } = useDonationsByDonator(address);

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

    // Filtrer les dons passés pour exclure ceux qui sont encore actifs (en cours)
    const completedDonations = useMemo(() => {
        if (!pastDonations || !activeDonations) return [];

        // Créer un Set des index des donations actives pour une recherche rapide
        const activeIndices = new Set(activeDonations.map(d => d.index));

        // Retourner uniquement les donations dont l'index n'est pas dans les donations actives
        return pastDonations.filter(donation => !activeIndices.has(donation.index));
    }, [pastDonations, activeDonations]);

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Tableau de bord</h2>
                    <p className="text-slate-600">Gérer et suivez l'utilisation de vos dons</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-blue-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Total Dons</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-700">{userStats.totalDonations} ETH</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-gradient-to-br from-purple-50 to-purple-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Dons en cours</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-700">{userStats.donationCount}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-gradient-to-br from-green-50 to-green-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-700">Non dépensé</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">{userStats.unspentDonations} ETH</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <Card className="border-slate-200 mt-6">
                        <CardHeader>
                            <CardTitle>Faîtes un don</CardTitle>
                            <CardDescription>Envoyer de l' ETH pour soutenir les projets</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Montant (ETH)</label>
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
                                {isPending ? 'Confirmation...' : isConfirming ? 'En cours...' : 'Donner'}
                            </Button>
                            {isSuccess && (
                                <div className="text-sm text-green-600 text-center">
                                    Don effectué! 🎉
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Donations en cours */}
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Dons en cours</CardTitle>
                        <CardDescription>Vos dons avec des fonds non alloués</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucun don en cours
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeDonations.map((donation) => (
                                    <div
                                        key={donation.index}
                                        className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                                                <DollarSign className="w-5 h-5 text-white"/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="font-semibold text-slate-900">{donation.amount} ETH
                                                    </div>
                                                    <span
                                                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                        Active
                                                    </span>
                                                    {donation.allocated && (
                                                        <span
                                                            className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                            Allouée
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-slate-500">{donation.timestamp}</div>
                                                <div className="text-xs text-blue-700 mt-1 font-semibold">
                                                    Restant: {donation.remaining} ETH
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm text-slate-600 font-mono">#{donation.index}</div>
                                            {!donation.allocated && (
                                                <GenerateReceiptButton
                                                    donation={{
                                                        donator: donation.donator,
                                                        amount: donation.amountBigInt,
                                                        timestamp: donation.timestampBigInt,
                                                        receiptRequested: donation.receiptRequested,
                                                        receiptMinted: donation.receiptMinted,
                                                        index: BigInt(donation.index)
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Donations passées */}
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Dons passés</CardTitle>
                        <CardDescription>Historique des dons complètement dépensés</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isPastDonationsLoading ? (
                            <div className="text-center py-8 text-slate-500">
                                Chargement...
                            </div>
                        ) : completedDonations.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Aucun don passé trouvé
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {completedDonations.map((donation) => (
                                    <div
                                        key={donation.id}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-500 to-gray-600">
                                                <DollarSign className="w-5 h-5 text-white"/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-slate-900">
                                                        {parseFloat(formatEther(BigInt(donation.amount))).toFixed(4)} ETH
                                                    </div>
                                                    <span
                                                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
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
