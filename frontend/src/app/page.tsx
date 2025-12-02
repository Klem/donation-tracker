'use client';
import {useAccount, useReadContract} from "wagmi";
import Public from "@/components/shared/Public";
import NotConnected from "@/components/shared/NotConnected";
import Donator from "@/components/shared/Donator";
import {CONTRACT_ABI, CONTRACT_ADDRESS} from "@/utils/constants";
import Recipient from "@/components/shared/Recipient";
import Admin from "@/components/shared/Admin";

export default function Home() {

    const {address, isConnected} = useAccount();

    // Récupère l'owner du contrat
    const {data: owner} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'owner',
        query: {
            enabled: isConnected,
        },
    });

    // Vérifie si l'utilisateur est un recipient
    const {data: isRecipient} = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        account: address,
        functionName: 'isAllowedRecipient',
        args: [],
        query: {
            enabled: !!address && isConnected,
        },
    });

    // Vérifie si l'utilisateur est l'owner
    const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();

    return (
        <>
            {!isConnected ? (
                <Public />
            ) : isOwner ? (
                <Admin />
            ) : isRecipient ? (
                <Recipient />
            ) : (
                <Donator />
            )}
        </>
    );
}