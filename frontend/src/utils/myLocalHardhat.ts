// utils/myLocalHardhat.ts
import { defineChain } from "viem";
import { localhost } from "wagmi/chains";

export const localHardhat = defineChain({
    ...localhost,
    id: 31337, // Hardhat local chainId (par défaut)
    name: "Hardhat Local",
    network: "hardhat",
    nativeCurrency: {
        name: "Hardhat ETH",
        symbol: "ETH",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ["http://172.29.79.150:8545"], // <-- TON RPC Hardhat
        },
        public: {
            http: ["http://172.29.79.150:8545"],
        },
    },
    blockExplorers: {
        default: {
            name: "Hardhat Explorer",
            url: "http://172.29.79.150:8545/", // pas un vrai explorer, mais compatible
        },
    },
});
