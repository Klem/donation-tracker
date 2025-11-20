import {expect} from "chai";
import {network} from "hardhat";

const {ethers} = await network.connect();

async function setUpSmartContract() {
    const tracker = await ethers.deployContract("DonationTracker");
    const [owner, donator1, donator2, donator3] = await ethers.getSigners();

    return {tracker, owner, donator1, donator2, donator3};
}

export interface Donation {
    donator: string;     // address → string in TS
    amount: bigint;      // uint256 → bigint (recommended for large numbers)
    timestamp: bigint;   // uint256 → bigint
}

export interface Allocation {
    donator: string;
    from: string;
    to: string;
    amount: bigint;
    timestamp: bigint;
}


describe("DonationTracker", function () {
    // expected state post deploy
    describe("Post Construct", function () {
        let tracker: any;
        let owner: any;
        let donator1: any;

        before(async () => {
            ({tracker, owner, donator1} = await setUpSmartContract());
        })

        it("Should set the deployer as the owner", async function () {
            expect(await tracker.owner()).eq(owner.address);
        });

        it("Should have zero balance", async function () {
            expect(await tracker.contractBalance()).eq(0);
        });

        it("Should have no donations", async function () {
            expect(await tracker.totalDonated()).to.be.eq(0);
            expect(await tracker.totalAllocated()).to.be.eq(0);
            expect(await tracker.totalDonators()).to.be.eq(0);
            expect(await tracker.totalDonationLeftovers()).to.be.eq(0);
            expect(await tracker.userDonationCount(donator1)).to.be.equal(0);
            expect(await tracker.userTotalDonations(donator1)).to.be.equal(ethers.parseEther("0.0"));
            expect(tracker.userDonationAt(donator1.address, 0)).to.be.revertedWithCustomError(tracker, "InvalidIndex").withArgs(0);
        });

        it("Allocation recipients percentages must sum to exactly 100%", async function () {
            const BASIS_POINTS = 10_000n; // 100.00% in basis points

            let totalPercentage = 0n;
            let recipients = await tracker.recipients();

            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                totalPercentage += recipient.percentage;
            }

            // Final assertion
            expect(totalPercentage).to.equal(BASIS_POINTS);
        });
    });

    describe("Receive() and fallback()", function () {
        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;

        before(async () => {
            ({tracker, owner, donator1} = await setUpSmartContract());
        })

        it("Receive() should accept ETH when sent with empty calldata", async function () {
            const amount = ethers.parseEther("1.0");

            const tx = await
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    value: amount,
                });

            await expect(tx).to.changeEtherBalances(ethers,
                [donator1, tracker],
                [-amount, amount]
            );
            expect(tx).to.emit(tracker, "DonationReceived");
        });

        it("Fallback() should accept ETH when sent with dummy calldata", async function () {
            const amount = ethers.parseEther("1.0");

            const tx = await
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    value: amount,
                    data: "0x00000000"
                });

            await expect(tx).to.changeEtherBalances(ethers,
                [donator1, tracker],
                [-amount, amount]
            );

            expect(tx).to.emit(tracker, "DonationReceived");

        });

        it("fallback() should revert on call to non-existent function (no ETH)", async function () {
            const iface = new ethers.Interface(["function thisDoesNotExist()"]);

            const tx = await
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    data: iface.encodeFunctionData("thisDoesNotExist"),
                    value: 0,
                })

           await expect(tx).to.not.be.revertedWithCustomError(tracker, "NullDonation");

            // expect(tx).to.emit(tracker, "DonationReceived");
        });

        it("fallback() should accept ETH when calling non-existent function", async function () {
            const amount = ethers.parseEther("1.0");
            const iface = new ethers.Interface(["function thisDoesNotExist()"]);

            const tx = await
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    data: iface.encodeFunctionData("thisDoesNotExist"),
                    value: amount,
                })
            await expect(tx).to.changeEtherBalances(ethers,
                [donator1, tracker],
                [-amount, amount]
            );

            expect(tx).to.emit(tracker, "DonationReceived");
        });
    });

    describe("Donations", function () {
        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;

        beforeEach(async () => {
            ({tracker, owner, donator1, donator2} = await setUpSmartContract());
        })

        it("Should emit the donation event", async function () {
            const amount = ethers.parseEther("1.0");
            const tx = await donate(donator1, amount);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt!.blockHash);
            const timestamp = block!.timestamp;

            // Now assert the event
            await expect(tx)
                .to.emit(tracker, "DonationReceived")
                .withArgs(donator1.address, amount, timestamp, 0);

        });

        it("Donation must appear in Donations[]", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            const donation: Donation = await tracker.userDonationAt(donator1, 0);

            expect(donation.amount).to.be.equal(amount);

        });

        it("userDonationCount must be incremented", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            expect(await tracker.userDonationCount(donator1)).to.be.equal(1);

            await donate(donator1, amount);

            expect(await tracker.userDonationCount(donator1)).to.be.equal(2);
        });

        it("Donation must be added to the totalDonated", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            expect(await tracker.totalDonated()).to.be.equal(ethers.parseEther("1.0"));

            await donate(donator2, amount);

            expect(await tracker.totalDonated()).to.be.equal(ethers.parseEther("2.0"));
        });

        it("Donation must be added to the totalUserDonations", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);
            expect(await tracker.userTotalDonations(donator1)).to.be.equal(ethers.parseEther("1.0"));

            await donate(donator1, amount);

            expect(await tracker.userTotalDonations(donator1)).to.be.equal(ethers.parseEther("2.0"));
        });

        it("Donation must be added to the totalUnspentUserDonations", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            expect(await tracker.userUnspentDonations(donator1)).to.be.equal(ethers.parseEther("1.0"));

            await donate(donator1, amount);

            expect(await tracker.userUnspentDonations(donator1)).to.be.equal(ethers.parseEther("2.0"));
        });


        it("contractBalance should be incremented by the donation amount", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            expect(await tracker.contractBalance()).to.be.equal(ethers.parseEther("1.0"));

            await donate(donator1, amount);

            expect(await tracker.contractBalance()).to.be.equal(ethers.parseEther("2.0"));
        });

        it("totalDonators should depend on the amount of donators, not donations", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            expect(await tracker.totalDonators()).eq(1);
            // same donator again
            await donate(donator1, amount);
            expect(await tracker.totalDonators()).eq(1);

            // other donator
            await donate(donator2, amount);

            expect(await tracker.totalDonators()).eq(2);
        });

        async function donate(donator: any, amount: BigInt) {
            return await
                donator.sendTransaction({
                    to: await tracker.getAddress(),
                    value: amount,
                    data: "0x00000000"
                });
        }
    });

    describe("Edge Cases", function () {

        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;

        beforeEach(async () => {
            ({tracker, owner, donator1, donator2} = await setUpSmartContract());
        })

        it("Should handle zero-value donations (revert)", async function () {
            await expect(
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    value: 0,
                })
            ).to.be.revert(ethers); // Ethers.js/Hardhat may not revert explicitly, but the transaction will fail
        });

        it("Should handle rounding errors and add the leftover to totalDonationLeftovers", async function () {
            // Donate 1 wei to test rounding
            const donationAmount = 1n;

            await donator1.sendTransaction({
                to: await tracker.getAddress(),
                value: donationAmount,
                data: "0x",
            });

            // Owner should receive the leftover 1 wei (since 60% and 40% of 1 wei = 0)
            expect(await tracker.totalDonationLeftovers()).to.be.eq(donationAmount);
        });
    });
});
