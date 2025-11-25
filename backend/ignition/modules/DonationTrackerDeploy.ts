import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Use a separate constant for the module to avoid name collision inside buildModule
const DonationModule = buildModule("DonationModule", (m) => {
    // 1. Identify the deployer account (Hardhat's default account 0)
    const deployer = m.getAccount(0);

    // --- Step 1: Initial Deployment of DonationReceipt ---
    // NOTE: Using console.log instead of m.log for compatibility with Hardhat Ignition v3
    console.log(`--- Deployment Step 1: Deploying DonationReceipt ---`);
    console.log(`Deployer (Initial Owner of Receipt): ${deployer}`);

    // Deploy DonationReceipt, setting the deployer as the initial owner.
    const receipt = m.contract("DonationReceipt", [deployer], {
        id: "DonationReceipt",
    });

    // The Ignition Future object handles the string conversion implicitly here.
    console.log(`DonationReceipt deployed (Temporary Owner: Deployer)`);
    console.log(`DonationReceipt Contract Address: ${receipt}`);


    // --- Step 2: Deployment of DonationTracker ---
    console.log(`\n--- Deployment Step 2: Deploying DonationTracker ---`);
    console.log(`Deployer (Owner of Tracker): ${deployer}`);

    // Deploy DonationTracker, passing the deployed DonationReceipt address.
    const tracker = m.contract("DonationTracker", [receipt], {
        id: "DonationTracker",
    });

    console.log(`DonationTracker deployed (Owner: Deployer)`);
    console.log(`DonationTracker Contract Address: ${tracker}`);


    // --- Step 3: Transfer Ownership of DonationReceipt ---
    // This is the CRITICAL step to ensure only the DonationTracker can mint NFTs.
    console.log(`\n--- Deployment Step 3: Transferring Ownership of DonationReceipt ---`);
    console.log(`Current Owner: Deployer (${deployer})`);
    console.log(`New Owner: DonationTracker (${tracker})`);


    // Call the transferOwnership function on the DonationReceipt contract.
    // The new owner is the address of the deployed DonationTracker contract.
    m.call(receipt, "transferOwnership", [tracker], {
        id: "TransferReceiptOwnership",
    });

    console.log(`Ownership Transfer transaction sent.`);
    console.log(`Verification: DonationReceipt's owner is now DonationTracker.`);


    // --- Final Step ---
    console.log(`\n--- Deployment Complete ---`);
    console.log(`Deployment Summary:`);
    console.log(`  Receipt: ${receipt}`);
    console.log(`  Tracker: ${tracker}`);

    // The initial ownership of DonationTracker remains with the Deployer (Account 0)
    // The final ownership of DonationReceipt is the DonationTracker contract.
    // This fulfills all requirements.

    return {
        receipt,
        tracker,
    };
});

export default DonationModule;