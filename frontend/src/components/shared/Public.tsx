'use client'
import React, {useState, useEffect} from 'react'
import {DollarSign, TrendingUp, Users, Wallet} from "lucide-react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useReadContract, usePublicClient} from "wagmi";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "@/utils/constants";
import {formatEther} from "viem";

const Public = () => {

    const [latestDonations, setLatestDonations] = useState<any[]>([]);
    const publicClient = usePublicClient();

    // Récupération des données on-chain
    const {data: totalDonated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonated',
    });

    const {data: totalDonators} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalDonators',
    });

    const {data: totalAllocated} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalAllocated',
    });

    const {data: contractBalance} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'contractBalance',
    });

    const {data: recipients} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'recipients',
    });

    // Formatage des stats
    const stats = {
        totalDonated: totalDonated ? parseFloat(formatEther(totalDonated as bigint)).toFixed(2) : '0.00',
        totalDonators: totalDonators ? totalDonators.toString() : '0',
        totalAllocated: totalAllocated ? parseFloat(formatEther(totalAllocated as bigint)).toFixed(2) : '0.00',
        contractBalance: contractBalance ? parseFloat(formatEther(contractBalance as bigint)).toFixed(2) : '0.00'
    };

    // Formatage des recipients
    const recipientsData = recipients ? (recipients as Array<{name: string, wallet: string, percentage: bigint}>).map((r, index) => ({
        name: r.name,
        percentage: Number(r.percentage) / 100, // Conversion de basis points (10000 = 100%) en pourcentage
        address: `${r.wallet.slice(0, 6)}...${r.wallet.slice(-4)}`,
        color: ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500'][index] || 'bg-gray-500'
    })) : [];

    // Récupérer les dernières donations depuis la blockchain
    useEffect(() => {
        const fetchLatestDonations = async () => {
            if (!publicClient) return;

            try {
                const logs = await publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    event: {
                        type: 'event',
                        name: 'DonationReceived',
                        inputs: [
                            { type: 'address', name: 'donator', indexed: true },
                            { type: 'uint256', name: 'amount', indexed: false },
                            { type: 'uint256', name: 'timestamp', indexed: true },
                            { type: 'uint256', name: 'index', indexed: false }
                        ]
                    },
                    fromBlock: 0n,
                    toBlock: 'latest'
                });

                const donations = logs.map((log: any) => ({
                    donator: log.args.donator,
                    amount: log.args.amount,
                    timestamp: log.args.timestamp,
                    index: log.args.index,
                }));

                // Garder seulement les 10 dernières
                setLatestDonations(donations.reverse().slice(0, 10));
            } catch (error) {
                console.error('Error fetching donations:', error);
            }
        };

        fetchLatestDonations();
    }, [publicClient]);


    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto text-center mb-12">
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                    Transparent Donation Tracking
                </h2>
                <p className="text-lg text-slate-600 mb-8">
                    Track every donation from source to destination with complete transparency and traceability on the
                    blockchain.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <Card className="border-slate-200 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-500"/>
                            Total Donated
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalDonated} ETH</div>
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
                        <div className="text-3xl font-bold text-slate-900">{stats.totalDonators}</div>
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
                        <div className="text-3xl font-bold text-slate-900">{stats.totalAllocated} ETH</div>
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
                        <div className="text-3xl font-bold text-slate-900">{stats.contractBalance} ETH</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-purple-50 mb-8">
                <CardHeader>
                    <CardTitle className="text-2xl">Allocation Recipients</CardTitle>
                    <CardDescription>Current fund distribution breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recipientsData.map((recipient) => (
                            <div key={recipient.name} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-900">{recipient.name}</span>
                                            <span
                                                className="text-xs text-slate-500 font-mono">{recipient.address}</span>
                                        </div>
                                        <span
                                            className="text-sm font-medium text-slate-700">{recipient.percentage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                            className={`${recipient.color} h-2 rounded-full transition-all`}
                                            style={{width: `${recipient.percentage}%`}}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Latest Donations */}
            <Card className="border-slate-200 mt-6">
                <CardHeader>
                    <CardTitle className="text-2xl">Latest Donations</CardTitle>
                    <CardDescription>
                        {latestDonations.length} recent donation{latestDonations.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {latestDonations.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            No donations yet
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {latestDonations.map((donation, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 text-white"/>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-slate-900">
                                                    {parseFloat(formatEther(donation.amount)).toFixed(4)} ETH
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="font-mono">
                                                    {donation.donator.slice(0, 6)}...{donation.donator.slice(-4)}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {new Date(Number(donation.timestamp) * 1000).toLocaleString()}
                                                </span>
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
    );
}
export default Public
