import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DonationTrackerModule", (m) => {
    const Tracker = m.contract("DonationTracker");

    return {Tracker };
});