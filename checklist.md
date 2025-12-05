# DEPLOY CHECKLIST

## Blockchain
Compile and test
```bash
npx hardhat test --coverage
```

Deploy
```bash
npx hardhat ignition deploy ignition/modules/DonationTrackerDeploy.ts --network sepolia
```

Verify NFT Contract
```bash
npx hardhat verify ${donationReceiptAddress} "${donationTrackerAddress}" --network sepolia 
```

Verify Tracker contract
```bash
npx hardhat verify ${donationTrackerAddress} "${ownerAddress}" --network sepolia 
```

## Ponder (indexing)

in /abis/TonationTracker.ts

```tsx
export const TRACKER_ABI = ${donationTrackerAbi}
```

```json
 contracts: {
    DonationTracker: {
        chain:"sepolia",
            abi: TRACKER_ABI,
            address: "${donationTrackerAddress}",
            startBlock: ${deployBlock},
    },
},
```

## Frontend
in src/utils/Contants.ts, update

```tsx
export const CONTRACT_ADDRESS: `0x${string}` = "${donationTrackerAddress}";
export const NFT_ADDRESS: `0x${string}` = "${donationReceiptAddress}";
export const CONTRACT_ABI = ${donationTrackerAbi}
```

in .env
Verify Tracker contract
```bash
CONTRACT_ADDRESS=${donationTrackerAddress}
PONDER_URL=${ponderUrl}
```

in src/providers/RainbowKitWagminProvider, make sur ```config``` is propery set to ```sepolia```

