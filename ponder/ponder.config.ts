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
      address: "0x9d553f103ff60a4e2f7704ae4ed10eef791653e2",
      startBlock: 9761342,
    },
  },
});
