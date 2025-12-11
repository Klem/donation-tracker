'use client'
import React, {useState, useEffect, useMemo, useRef} from 'react'
import {useReadContract, useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt} from "wagmi";
import {formatEther} from "viem";
import { useAllDonations } from "@/hooks/usePonder";
import {DollarSign, TrendingUp, Users, Wallet, TrendingDown, AlertTriangle, X} from "lucide-react";
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

    // Fetch all donations from Ponder (replaces getLogs)
    const { data: allDonations = [], isLoading: isDonationsLoading } = useAllDonations();

    // Récupération des statistiques globales
    const {data: totalDonated, refetch: refetchTotalDonated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonated',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalDonators, refetch: refetchTotalDonators} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonators',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalAllocated, refetch: refetchTotalAllocated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalAllocated',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: totalSpent, refetch: refetchTotalSpent} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalSpent',
        query: {
            enabled: !!address && isConnected,
        },
    });

    const {data: contractBalance, refetch: refetchContractBalance} = useReadContract({
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

    // Process donations from Ponder and check allocation status
    useEffect(() => {
        const processDonations = async () => {
            if (!publicClient || allDonations.length === 0) return;

            try {
                // Récupérer les détails de chaque donation pour vérifier le statut allocated
                const donationsWithDetails = await Promise.all(
                    allDonations.map(async (d) => {
                        try {
                            const details = await publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: CONTRACT_ABI,
                                functionName: 'userDonationAt',
                                args: [d.donator as `0x${string}`, BigInt(d.index)],
                            });
                            return {
                                donator: d.donator,
                                amount: BigInt(d.amount),
                                timestamp: BigInt(d.timestamp),
                                index: BigInt(d.index),
                                blockNumber: d.blockNumber,
                                details
                            };
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
                console.error('Error processing donations:', error);
            }
        };

        processDonations();
    }, [publicClient, allDonations, refreshTrigger]);

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
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Tableau de bord Admin</h2>
                    <p className="text-slate-600">Gérer les donations et allocations</p>
                </div>

                {/* Global Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                    <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-500"/>
                                Total des dons
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
                                Total des donateurs
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
                                Total alloué
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
                                Total dépensé
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
                                Solde du contrat
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{stats.contractBalance} ETH</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Emergency Actions */}
                <Card className="border-red-200 bg-red-50 mb-8">
                    <CardHeader>
                        <CardTitle className="text-red-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5"/>
                            Actions d'urgence
                        </CardTitle>
                        <CardDescription className="text-red-700">
                            Ces actions sont irréversibles et peuvent affecter le fonctionnement du système
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EmergencyWithdrawButton
                            contractBalance={stats.contractBalance}
                            onSuccess={() => {
                                // Refresh all stats
                                refetchContractBalance();
                                refetchTotalDonated();
                                refetchTotalDonators();
                                refetchTotalAllocated();
                                refetchTotalSpent();
                                setRefreshTrigger(prev => prev + 1);
                            }}
                        />
                    </CardContent>
                </Card>

                {/* Donations à allouer */}
                <Card className="border-slate-200 mb-8">
                    <CardHeader>
                        <CardTitle>Donations à allouer</CardTitle>
                        <CardDescription>
                            {pendingDonations.length} donation{pendingDonations.length !== 1 ? 's' : ''} en attente d'allocation (depuis Ponder)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isDonationsLoading ? (
                            <div className="text-center py-8 text-slate-500">
                                Chargement...
                            </div>
                        ) : pendingDonations.length === 0 ? (
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
                                        onSuccess={() => {
                                            // Refresh stats after allocation
                                            refetchContractBalance();
                                            refetchTotalAllocated();
                                            refetchTotalSpent();
                                            setRefreshTrigger(prev => prev + 1);
                                        }}
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
                            {allocatedDonations.length} donation{allocatedDonations.length !== 1 ? 's' : ''} déjà allouée{allocatedDonations.length !== 1 ? 's' : ''} (depuis Ponder)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isDonationsLoading ? (
                            <div className="text-center py-8 text-slate-500">
                                Chargement...
                            </div>
                        ) : allocatedDonations.length === 0 ? (
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
    const hasCalledSuccessRef = useRef(false);

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

    // Reset ref when starting new allocation
    useEffect(() => {
        if (isWritePending) {
            hasCalledSuccessRef.current = false;
        }
    }, [isWritePending]);

    // Refetch après succès et rafraîchir la liste parente
    useEffect(() => {
        if (isSuccess && !hasCalledSuccessRef.current) {
            hasCalledSuccessRef.current = true;
            refetch();
            if (onSuccess) {
                onSuccess();
            }
        }
    }, [isSuccess, refetch, onSuccess]);

    if (!donation) return null;

    const donationData = donation as Donation;
    const isReceiptReady = donationData.receiptRequested && donationData.receiptMinted;

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
                    Restant: {parseFloat(formatEther(donationData.remaining)).toFixed(4)} ETH
                </div>
            </div>
            {isPending && (
                <div className="flex flex-col items-end gap-2">
                    {!isReceiptReady && (
                        <div className="text-xs text-amber-600">
                            ⏳ En attente de la génération du reçu fiscal
                        </div>
                    )}
                    <Button
                        onClick={handleAllocate}
                        disabled={!isReceiptReady || isWritePending || isConfirming}
                        className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 disabled:opacity-50"
                    >
                        {!isReceiptReady
                            ? 'Reçu fiscal en attente'
                            : isWritePending
                                ? 'Confirmation...'
                                : isConfirming
                                    ? 'Allocation...'
                                    : 'Allouer'}
                    </Button>
                </div>
            )}
        </div>
    );
};

// Emergency Withdraw Button Component
const EmergencyWithdrawButton = ({contractBalance, onSuccess}: { contractBalance: string, onSuccess?: () => void }) => {
    const [showModal, setShowModal] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const hasCalledSuccessRef = useRef(false);
    const {data: hash, writeContract, isPending: isWritePending, error: writeError} = useWriteContract();
    const {isLoading: isConfirming, isSuccess, isError, error: txError} = useWaitForTransactionReceipt({
        hash,
    });

    const handleEmergencyWithdraw = () => {
        try {
            setFeedback(null);
            hasCalledSuccessRef.current = false; // Reset on new transaction
            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'emergencyWithdraw',
            });
        } catch (error) {
            console.error('❌ Emergency withdraw error:', error);
            setFeedback({
                type: 'error',
                message: 'Erreur lors de l\'initialisation de la transaction'
            });
        }
    };

    useEffect(() => {
        if (isSuccess && !hasCalledSuccessRef.current) {
            hasCalledSuccessRef.current = true;

            setFeedback({
                type: 'success',
                message: `✅ Retrait d'urgence réussi ! ${contractBalance} ETH ont été transférés vers votre wallet.`
            });
            setShowModal(false);

            // Trigger refresh once
            if (onSuccess) {
                onSuccess();
            }

            // Auto-hide feedback after 5 seconds
            setTimeout(() => setFeedback(null), 5000);
        }
    }, [isSuccess, contractBalance, onSuccess]);

    useEffect(() => {
        if (isError || writeError) {
            const errorMessage = (txError as Error)?.message || (writeError as Error)?.message || 'Transaction échouée';
            setFeedback({
                type: 'error',
                message: `❌ Échec du retrait d'urgence : ${errorMessage}`
            });

            // Auto-hide feedback after 8 seconds
            setTimeout(() => setFeedback(null), 8000);
        }
    }, [isError, writeError, txError]);

    return (
        <>
            {/* Feedback Message */}
            {feedback && (
                <div className={`mb-4 p-4 rounded-lg border ${
                    feedback.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                    <p className="text-sm font-medium">{feedback.message}</p>
                </div>
            )}

            <Button
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={parseFloat(contractBalance) === 0 || isWritePending || isConfirming}
                onClick={() => setShowModal(true)}
            >
                <AlertTriangle className="w-4 h-4 mr-2"/>
                {isWritePending || isConfirming
                    ? 'Transaction en cours...'
                    : `Retrait d'urgence (${contractBalance} ETH)`}
            </Button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                    <Card className="w-full max-w-lg mx-4 border-red-200">
                        <CardHeader className="relative">
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="w-6 h-6"/>
                                Confirmer le retrait d'urgence
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 text-left">
                                <p className="font-semibold text-slate-900">
                                    ⚠️ ATTENTION : Cette action est irréversible !
                                </p>
                                <p>
                                    Vous êtes sur le point de retirer <span className="font-bold text-red-600">{contractBalance} ETH</span> du contrat.
                                </p>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                                    <p className="font-semibold text-red-900">Conséquences :</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                                        <li>Tous les fonds seront transférés vers votre wallet</li>
                                        <li>Le suivi (tracking) des donations sera perdu</li>
                                        <li>Les recipients ne pourront plus effectuer de payout</li>
                                        <li>Les allocations en cours seront annulées</li>
                                    </ul>
                                </div>
                                <p className="text-sm text-slate-600">
                                    Cette action ne doit être utilisée qu'en cas d'urgence absolue.
                                </p>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowModal(false)}
                                    disabled={isWritePending || isConfirming}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleEmergencyWithdraw}
                                    disabled={isWritePending || isConfirming}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {isWritePending
                                        ? 'Confirmation...'
                                        : isConfirming
                                            ? 'Retrait en cours...'
                                            : 'Confirmer le retrait'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
};

export default Admin
