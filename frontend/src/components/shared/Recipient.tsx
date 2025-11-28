'use client'
import React, {useState, useEffect} from 'react'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient} from "wagmi";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "@/utils/constants";
import {formatEther, parseEther, parseAbiItem} from "viem";
import {useMemo} from "react";

const Recipient = () => {

    const {address} = useAccount();
    const publicClient = usePublicClient();
    const [payoutAmount, setPayoutAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [paymentReason, setPaymentReason] = useState('');
    const [pastSpending, setPastSpending] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fonction de payout
    const {data: hash, writeContract, isPending} = useWriteContract();

    const {isLoading: isConfirming, isSuccess} = useWaitForTransactionReceipt({
        hash,
    });

    // Reset form after successful payout and refresh data
    useEffect(() => {
        if (isSuccess) {
            setPayoutAmount('');
            setDestinationAddress('');
            setPaymentReason('');
            setRefreshTrigger(prev => prev + 1);
        }
    }, [isSuccess]);

    // Fetch past spending events
    useEffect(() => {
        const fetchPastSpending = async () => {
            if (!publicClient || !address) return;

            try {
                // Fetch FundsSpent events where recipient (from) is current address
                const fundsSpentLogs = await publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    event: parseAbiItem('event FundsSpent(address indexed donator, address indexed from, address indexed to, uint amount, uint timestamp)'),
                    args: {
                        from: address, // Filter by recipient address
                    },
                    fromBlock: 0n,
                    toBlock: 'latest'
                });

                // Fetch all SpendingReason events
                const spendingReasonLogs = await publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    event: parseAbiItem('event SpendingReason(address indexed donator, uint timestamp, string message)'),
                    fromBlock: 0n,
                    toBlock: 'latest'
                });

                // Combine events by matching donator and timestamp
                const spendingHistory = fundsSpentLogs.map((fundsLog: any) => {
                    const matchingReason = spendingReasonLogs.find((reasonLog: any) =>
                        reasonLog.args.donator === fundsLog.args.donator &&
                        reasonLog.args.timestamp === fundsLog.args.timestamp
                    );

                    return {
                        donator: fundsLog.args.donator,
                        from: fundsLog.args.from,
                        to: fundsLog.args.to,
                        amount: fundsLog.args.amount,
                        timestamp: fundsLog.args.timestamp,
                        reason: matchingReason ? matchingReason.args.message : 'No reason provided',
                        blockNumber: fundsLog.blockNumber,
                        transactionHash: fundsLog.transactionHash,
                    };
                });

                setPastSpending(spendingHistory.reverse());
            } catch (error) {
                console.error('Error fetching past spending:', error);
            }
        };

        fetchPastSpending();
    }, [publicClient, address, isSuccess]); // Refresh when payout succeeds

    // Refetch donator data when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger > 0) {
            refetchBalance();
            refetchDonators();
            refetchBalances();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger]);

    const handlePayout = async () => {
        if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
            console.error('Invalid amount');
            return;
        }

        if (!destinationAddress || !destinationAddress.startsWith('0x')) {
            console.error('Invalid destination address');
            return;
        }

        // Validate and sanitize payment reason
        if (!paymentReason || paymentReason.trim().length === 0) {
            console.error('Payment reason is required');
            return;
        }

        // Clean and limit to 256 chars
        const cleanReason = paymentReason
            .trim()
            .slice(0, 256)
            .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, ''); // Remove non-printable characters

        if (cleanReason.length === 0) {
            console.error('Payment reason contains only invalid characters');
            return;
        }

        console.log('🔵 Payout requested', {
            amount: payoutAmount,
            destination: destinationAddress,
            reason: cleanReason,
        });

        try {
            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'payout',
                args: [destinationAddress as `0x${string}`, cleanReason],
                value: parseEther(payoutAmount), // ✅ Montant passé via msg.value!
            });
            console.log('✅ writeContract called');
        } catch (error) {
            console.error('❌ Payout error:', error);
        }
    };

    // Récupération du solde total du recipient
    const {data: recipientBalance, refetch: refetchBalance} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getRecipientTotalBalance',
        args: address ? [address] : undefined,
        account: address,
        query: {
            enabled: !!address,
        },
    });

    // Récupération de la liste des donateurs pour ce recipient
    const {data: donators, refetch: refetchDonators} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getRecipientDonators',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    // Préparer les appels pour récupérer le solde de chaque donateur
    const donatorBalanceContracts = useMemo(() => {
        if (!donators || !address) return [];
        return (donators as Array<string>).map((donator) => ({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getRecipientBalanceForDonator',
            args: [address, donator],
        }));
    }, [donators, address]);

    // Récupérer les balances de tous les donateurs
    const {data: donatorBalances, refetch: refetchBalances} = useReadContracts({
        contracts :donatorBalanceContracts,
        query: {
            enabled: donatorBalanceContracts.length > 0,
        },
    });

    // Formater les données des donateurs avec leurs balances
    const donatorsWithBalances = useMemo(() => {
        if (!donators || !donatorBalances) return [];
        return (donators as Array<string>).map((donator, index) => ({
            address: donator,
            balance: donatorBalances[index]?.result
                ? parseFloat(formatEther(donatorBalances[index].result as bigint)).toFixed(4)
                : '0.0000',
            balanceRaw: donatorBalances[index]?.result as bigint || 0n
        })).filter(d => d.balanceRaw > 0n); // Filtrer les donateurs avec balance > 0
    }, [donators, donatorBalances]);

    // Formatage des données
    const userStats = {
        recipientBalance: recipientBalance ? parseFloat(formatEther(recipientBalance as bigint)).toFixed(4) : '0.0000',
        donatorsCount: donators ? (donators as Array<string>).length : 0
    };


    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Dashboard</h2>
                    <p className="text-slate-600">Manage your donations and track fund flow</p>
                </div>
                <Card className="border-slate-200 bg-gradient-to-br from-orange-50 to-orange-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-700">Your Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{userStats.recipientBalance} ETH
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Payout Funds</CardTitle>
                        <CardDescription>Withdraw funds to any address</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Amount (ETH)</label>
                            <input
                                type="number"
                                placeholder="0.0"
                                value={payoutAmount}
                                onChange={(e) => setPayoutAmount(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                disabled={isPending || isConfirming}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Destination Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={destinationAddress}
                                onChange={(e) => setDestinationAddress(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                disabled={isPending || isConfirming}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Payment Reason <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g., Salary, Equipment purchase, etc."
                                value={paymentReason}
                                onChange={(e) => setPaymentReason(e.target.value)}
                                maxLength={256}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                disabled={isPending || isConfirming}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                {paymentReason.length}/256 characters
                            </p>
                        </div>
                        <Button
                            onClick={handlePayout}
                            disabled={isPending || isConfirming || !payoutAmount || !destinationAddress || !paymentReason}
                            className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 disabled:opacity-50">
                            {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Payout'}
                        </Button>
                        {isSuccess && (
                            <div className="text-sm text-green-600 text-center">
                                Payout successful! 🎉
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Your Donators</CardTitle>
                        <CardDescription>
                            {donatorsWithBalances.length} active donator{donatorsWithBalances.length !== 1 ? 's' : ''} with remaining balance
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {donatorsWithBalances.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No active donators yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {donatorsWithBalances.map((donator) => (
                                    <div
                                        key={donator.address}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                                    >
                                        <div className="flex-1">
                                            <div className="font-mono text-sm text-slate-700">
                                                {donator.address.slice(0, 6)}...{donator.address.slice(-4)}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Donator Address
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-lg text-orange-600">
                                                {donator.balance} ETH
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Available Balance
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 mt-6">
                    <CardHeader>
                        <CardTitle>Spending History</CardTitle>
                        <CardDescription>
                            {pastSpending.length} payout{pastSpending.length !== 1 ? 's' : ''} made
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pastSpending.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No spending history yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pastSpending.map((spending, idx) => (
                                    <div
                                        key={`${spending.transactionHash}-${idx}`}
                                        className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                                                        PAID
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(Number(spending.timestamp) * 1000).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-2xl text-green-700 mb-2">
                                                    {parseFloat(formatEther(spending.amount)).toFixed(4)} ETH
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 font-medium min-w-[80px]">Donator:</span>
                                                <span className="font-mono text-slate-700">
                                                    {spending.donator.slice(0, 6)}...{spending.donator.slice(-4)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 font-medium min-w-[80px]">To:</span>
                                                <span className="font-mono text-slate-700">
                                                    {spending.to.slice(0, 6)}...{spending.to.slice(-4)}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="text-slate-500 font-medium min-w-[80px]">Reason:</span>
                                                <span className="text-slate-700 italic flex-1">
                                                    "{spending.reason}"
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {spending.transactionHash.substring(0, 10)}...{spending.transactionHash.substring(spending.transactionHash.length - 8)}
                                                </span>
                                            </div>
                                        </div>
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
export default Recipient
