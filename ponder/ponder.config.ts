import { createConfig } from "ponder";

import { TRACKER_ABI } from "./abis/DonationTracker";

export default createConfig({
    chains: {
    sepolia: {
      id: 11155111,
      rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    },
  },
  contracts: {
    DonationTracker: {
      chain:"sepolia",
      abi: TRACKER_ABI,
      address: "0xfE4a5E2582A8ea90b7C015131ceeeBAc4Ea0A62d",
      startBlock: 9773631,
    },
  },
});
