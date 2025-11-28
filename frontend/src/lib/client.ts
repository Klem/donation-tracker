

import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import {localHardhat} from "@/utils/myLocalHardhat";

// Création du client connecté à la blockchain Hardhat locale
export const publicClient = createPublicClient({
  chain: localHardhat,      // Réseau Hardhat (localhost:8545)
  transport: http()    // Communication via HTTP (RPC)
})