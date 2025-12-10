import {expect} from "chai";
import {network} from "hardhat";
import {parseEther} from "ethers";

const {ethers} = await network.connect();

async function setUpSmartContract() {
    const signers = await ethers.getSigners();

    const owner = signers[0];
    const recipient1 = signers[1];
    const recipient2 = signers[2];
    const recipient3 = signers[3];
    const recipient4 = signers[4];
    // 1 to 4 are recipients;
    const donator1 = signers[5];
    const donator2 = signers[6];
    const donator3 = signers[1];
    // const [owner, donator1, donator2, donator3] = await ethers.getSigners();
    const deployer = owner; // Owner will be the deployer in tests

    const ReceiptFactory = await ethers.getContractFactory("DonationReceipt");
    const receipt = await ReceiptFactory.deploy(deployer.address);
    await receipt.waitForDeployment();

    const TrackerFactory = await ethers.getContractFactory("DonationTracker");
    const tracker = await TrackerFactory.deploy(await receipt.getAddress());
    await tracker.waitForDeployment();

    const trackerAddress = await tracker.getAddress();
    const receiptTx = await receipt.connect(deployer).transferOwnership(trackerAddress);
    await receiptTx.wait();

    // The rest of your test file already expects:
    return {tracker, receipt, owner, recipient1, recipient2, recipient3, recipient4, donator1, donator2, donator3};
}

export interface Donation {
    donator: string;
    amount: bigint;
    remaining: bigint;
    timestamp: bigint;
    allocated: boolean;
    receiptRequested: boolean;
    receiptMinted: boolean;
    index: number;
}

export interface Allocation {
    donator: string;
    from: string;
    to: string;
    amount: bigint;
    timestamp: bigint;
}


describe("DonationTracker", function () {

    describe("Post Construct", function () {
        let tracker: any;
        let receipt: any;
        let owner: any;
        let donator1: any;

        before(async () => {
            ({tracker, receipt, owner, donator1} = await setUpSmartContract());
        })

        it("Should set the deployer as the owner", async function () {
            expect(await tracker.owner()).eq(owner.address);
        });

        it("Should set the address of DonationReceipt in the DonationTracker", async function () {
            const storedReceiptAddress = await tracker.donationReceipt();
            const deployedReceiptAddress = await receipt.getAddress();

            expect(storedReceiptAddress).to.equal(deployedReceiptAddress);
            expect(storedReceiptAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("Should set DonationReceipt as the owner of DonationTracker", async function () {
            const receiptOwner = await receipt.owner();
            const trackerAddress = await tracker.getAddress();

            expect(receiptOwner).to.equal(trackerAddress);
        });

        it("Should have zero balance", async function () {
            expect(await tracker.contractBalance()).eq(0);
        });

        it("State should be empty", async function () {
            expect(await tracker.totalDonated()).to.be.eq(0);
            expect(await tracker.totalAllocated()).to.be.eq(0);
            expect(await tracker.totalSpent()).to.be.eq(0);
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

        it("Receive() should revert when sent with empty calldata", async function () {
            const amount = ethers.parseEther("1.0");

            const tx = donator1.sendTransaction({
                to: await tracker.getAddress(),
                value: amount,
            });

            await expect(tx).be.revertedWith("UseDonateFunction");
        });

        it("Fallback() should revert when sent with dummy calldata", async function () {
            const amount = ethers.parseEther("1.0");

            const tx = donator1.sendTransaction({
                to: await tracker.getAddress(),
                value: amount,
                data: "0x00000000"
            });

            await expect(tx).be.revertedWith("UseDonateFunction");

        });

        it("fallback() should revert on call to non-existent function (no ETH)", async function () {
            const iface = new ethers.Interface(["function thisDoesNotExist()"]);

            const tx = donator1.sendTransaction({
                to: await tracker.getAddress(),
                data: iface.encodeFunctionData("thisDoesNotExist"),
                value: 0,
            })

            await expect(tx).be.revertedWith("UseDonateFunction");
        });

        it("fallback() should revert when calling non-existent function", async function () {
            const amount = ethers.parseEther("1.0");
            const iface = new ethers.Interface(["function thisDoesNotExist()"]);

            const tx = donator1.sendTransaction({
                to: await tracker.getAddress(),
                data: iface.encodeFunctionData("thisDoesNotExist"),
                value: amount,
            })

            await expect(tx).be.revertedWith("UseDonateFunction");

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
            expect(donation.remaining).to.be.equal(amount);

        });

        it("Donations for same donator must have its index incremented", async function () {
            const amount = ethers.parseEther("1.0");
            await donate(donator1, amount);

            const donation1: Donation = await tracker.userDonationAt(donator1, 0);

            expect(donation1.index).to.be.equal(0);

            await donate(donator1, amount);

            const donation2: Donation = await tracker.userDonationAt(donator1, 1);

            expect(donation2.index).to.be.equal(1);

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

            return await tracker.connect(donator).donate({
                value: amount
            })
        }
    });

    describe("Allocate", async function () {
        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;
        let recipient1: any;
        let donation: Donation;
        let donationReceipt: any;

        beforeEach(async () => {
            ({tracker, owner, recipient1, donator1, donator2} = await setUpSmartContract());
            let donationReceipt = await donate(donator1, ethers.parseEther("10.0"))
            const events = donationReceipt?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null; // ignore logs from other contracts
                }
            }).filter((event: any) => event !== null);

            const donationEvent = events[0];
            donation = {
                donator: donationEvent.args?.donator,
                amount: donationEvent.args?.amount,
                remaining: donationEvent.args?.amount,
                timestamp: donationEvent.args?.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: donationEvent.args?.index
            };

        })

        it("Should only be callable by the owner", async function () {
            await expect(tracker.connect(donator1).allocate(donation)
            ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount");
        });

        it("Should allocate funds according to the percentage distribution (10%, 20%, 35%, 35%)", async function () {
            const recipients = await tracker.recipients();
            const initialBalances = await Promise.all(
                recipients.map((r: any) => ethers.provider.getBalance(r.wallet))
            );

            await tracker.connect(owner).allocate(donation);

            const expectedAmounts = [
                donation.amount * 1000n / 10000n, // 10%
                donation.amount * 2000n / 10000n, // 20%
                donation.amount * 3500n / 10000n, // 35%
                donation.amount * 3500n / 10000n  // 35%
            ];

            for (let i = 0; i < recipients.length; i++) {
                const newBalance = await ethers.provider.getBalance(recipients[i].wallet);
                const received = newBalance - initialBalances[i];
                expect(received).to.be.equal(expectedAmounts[i]);
            }
        });

        it("Should update totalAllocated with the sum of all allocated amounts", async function () {
            const initialTotalAllocated = await tracker.totalAllocated();

            await tracker.connect(owner).allocate(donation);

            const finalTotalAllocated = await tracker.totalAllocated();
            const expectedIncrease = donation.amount - (donation.amount % 1n); // minus potential rounding

            expect(finalTotalAllocated).to.be.gte(initialTotalAllocated + expectedIncrease - 10n);
        });

        it("Should flag the donation as allocated", async function () {
            await tracker.connect(owner).allocate(donation);

            donation = await tracker.userDonationAt(donator1.address, 0);
            expect(donation.allocated).to.be.true;
        });

        it("Should decrease totalUnspentUserDonations by the total allocated amount", async function () {
            const initialUnspent = await tracker.userUnspentDonations(donation.donator);

            await tracker.connect(owner).allocate(donation);

            const finalUnspent = await tracker.userUnspentDonations(donation.donator);
            const allocated = initialUnspent - finalUnspent;

            expect(allocated).to.be.closeTo(donation.amount, 10n);
        });

        it("Should update recipientBalancesByDonator for each recipient", async function () {
            const recipients = await tracker.recipients();

            await tracker.connect(owner).allocate(donation);

            for (let i = 0; i < recipients.length; i++) {
                const balance = await tracker.getRecipientBalanceForDonator(
                    recipients[i].wallet,
                    donation.donator
                );
                const expectedAmount = donation.amount * recipients[i].percentage / 10000n;
                expect(balance).to.equal(expectedAmount);
            }
        });

        it("Should update recipientTotalBalance for each recipient", async function () {
            const recipients = await tracker.recipients();

            await tracker.connect(owner).allocate(donation);

            for (let i = 0; i < recipients.length; i++) {
                const balance = await tracker.connect(recipient1).getRecipientTotalBalance(
                    recipients[i].wallet
                );
                const expectedAmount = donation.amount * recipients[i].percentage / 10000n;
                expect(balance).to.equal(expectedAmount);
            }
        });

        it("Should add donator to recipientDonators array on first allocation to a recipient", async function () {
            const recipients = await tracker.recipients();

            await tracker.connect(owner).allocate(donation);

            for (let i = 0; i < recipients.length; i++) {
                const donators = await tracker.getRecipientDonators(recipients[i].wallet);
                expect(donators).to.include(donation.donator);
            }
        });

        it("Should not duplicate donator in recipientDonators array on subsequent allocations", async function () {
            const recipients = await tracker.recipients();

            await tracker.connect(owner).allocate(donation);

            // Make another donation and allocate
            const donationReceipt2 = await donate(donator1, ethers.parseEther("5.0"));
            const events2 = donationReceipt2?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null;
                }
            }).filter((event: any) => event !== null);

            const donationEvent2 = events2[0];
            const donation2 = {
                donator: donationEvent2.args?.donator,
                amount: donationEvent2.args?.amount,
                remaining: donationEvent2.args?.amount,
                timestamp: donationEvent2.args?.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: donationEvent2.args?.index,
            };

            await tracker.connect(owner).allocate(donation2);

            for (let i = 0; i < recipients.length; i++) {
                const donators = await tracker.getRecipientDonators(recipients[i].wallet);
                const donatorCount = donators.filter((d: string) => d === donation.donator).length;
                expect(donatorCount).to.equal(1);
            }
        });

        it("Should emit FundsAllocated event for each recipient", async function () {
            const recipients = await tracker.recipients();
            const txResponse = await tracker.connect(owner).allocate(donation);
            const receipt = await txResponse.wait();

            const fundsAllocatedEvents = receipt.logs
                .map((log: any) => {
                    try {
                        return tracker.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .filter((event: any) => event !== null && event.name === "FundsAllocated");

            expect(fundsAllocatedEvents.length).to.equal(recipients.length);

            for (let i = 0; i < recipients.length; i++) {
                const expectedAmount = donation.amount * recipients[i].percentage / 10000n;
                const matchingEvent = fundsAllocatedEvents.find(async (e: any) =>
                    e.args.to === recipients[i].wallet &&
                    e.args.amount === expectedAmount &&
                    e.args.donator === donation.donator &&
                    e.args.from === await tracker.getAddress()
                );

                expect(matchingEvent).to.not.be.undefined;
            }
        });

        it("Should handle rounding errors and add leftover to totalDonationLeftovers", async function () {
            // Donate an amount that will create rounding errors (e.g., 1 wei)
            const smallDonationReceipt = await donate(donator2, 1n);
            const events = smallDonationReceipt?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null;
                }
            }).filter((event: any) => event !== null);

            const smallDonationEvent = events[0];
            const smallDonation = {
                donator: smallDonationEvent.args?.donator,
                amount: smallDonationEvent.args?.amount,
                remaining: smallDonationEvent.args?.amount,
                timestamp: smallDonationEvent.args?.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: smallDonationEvent.args?.index,
            };

            const initialLeftovers = await tracker.totalDonationLeftovers();

            await tracker.connect(owner).allocate(smallDonation);

            const finalLeftovers = await tracker.totalDonationLeftovers();
            expect(finalLeftovers).to.be.gt(initialLeftovers);
        });

        it("Should successfully transfer ETH to all recipient wallets", async function () {
            const recipients = await tracker.recipients();
            const initialBalances = [];

            for (let i = 0; i < recipients.length; i++) {
                const balance = await ethers.provider.getBalance(recipients[i].wallet);
                initialBalances.push(balance);
            }

            await tracker.connect(owner).allocate(donation);

            for (let i = 0; i < recipients.length; i++) {
                const newBalance = await ethers.provider.getBalance(recipients[i].wallet);
                expect(newBalance).to.be.gt(initialBalances[i]);
            }
        });

        it.skip("Should revert if transfer to any recipient fails", async function () {
            // no implementation
        });

        it.skip("Should be protected by reentrancy guard", async function () {
            // no implementation
        });

        it.skip("Should handle multiple allocations from the same donator", async function () {
            await tracker.connect(owner).allocate(donation);

            const donationReceipt2 = await donate(donator1, ethers.parseEther("3.0"));
            const events2 = donationReceipt2?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null;
                }
            }).filter((event: any) => event !== null);

            const donationEvent2 = events2[0];
            const donation2 = {
                donator: donationEvent2.args?.donator,
                amount: donationEvent2.args?.amount,
                timestamp: donationEvent2.args?.timestamp,
                receiptRequested: false,
                receiptMinted: false
            };

            await tracker.connect(owner).allocate(donation2);

            const recipients = await tracker.recipients();
            const totalExpected = donation.amount + donation2.amount;

            for (let i = 0; i < recipients.length; i++) {
                const balance = await tracker.getRecipientBalanceForDonator(
                    recipients[i].wallet,
                    donation.donator
                );
                const expectedAmount = totalExpected * recipients[i].percentage / 10000;
                const diff = balance > expectedAmount ? balance - expectedAmount : expectedAmount - balance;
                expect(diff).to.be.lte(1n);
            }
        });

        async function donate(donator: any, amount: BigInt) {
            const tx = await tracker.connect(donator).donate({
                value: amount
            })

            return await tx.wait();
        }
    });

    describe("Payout", async function () {
        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;
        let recipient1: any;
        let recipient2: any;
        let recipient3: any;
        let recipient4: any;
        let donation: Donation;

        beforeEach(async () => {
            ({tracker, owner, recipient1, recipient2, recipient3, recipient4, donator1, donator2} = await setUpSmartContract());

            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
            const toAllocate: Donation = await tracker.userDonationAt(donator1.address, 0);

            donation = {
                donator: toAllocate.donator,
                amount: toAllocate.amount,
                remaining: toAllocate.remaining,
                timestamp: toAllocate.timestamp,
                allocated: toAllocate.allocated,
                receiptRequested: toAllocate.receiptRequested,
                receiptMinted: toAllocate.receiptMinted,
                index: toAllocate.index,
            };

            await tracker.connect(owner).allocate(donation);

            const allocated: Donation = await tracker.userDonationAt(donator1.address, 0);
            donation = {
                donator: allocated.donator,
                amount: allocated.amount,
                remaining: allocated.remaining,
                timestamp: allocated.timestamp,
                allocated: allocated.allocated,
                receiptRequested: allocated.receiptRequested,
                receiptMinted: allocated.receiptMinted,
                index: allocated.index,
            };
        })

        it("Should only be callable by a recipient", async function () {
            await expect(tracker.connect(donator1).payout(owner, "test", {value: ethers.parseEther("10.0")})
            ).to.be.revertedWithCustomError(tracker, "NotARecipient").withArgs(donator1.address);

            await expect(tracker.connect(owner).payout(owner, "test", {value: ethers.parseEther("10.0")})
            ).to.be.revertedWithCustomError(tracker, "NotARecipient").withArgs(owner.address);

            await expect(tracker.connect(recipient1).payout(owner, "test", {value: ethers.parseEther("10.0")})
            ).to.not.be.revertedWith("NotARecipient");
        });

        it("Should transfer funds from recipient wallet to the _to and emit events", async function () {
            const balanceBefore = await ethers.provider.getBalance(owner.address);
            const amount = ethers.parseEther("0.6");

            const tx = await tracker.connect(recipient1).payout(owner.address, "TotalPayout", {
                value: amount
            });

            const receiptTx = await tx.wait();
            const block = await ethers.provider.getBlock(receiptTx!.blockHash);
            const timestamp = block!.timestamp;

            await expect(tx).to.emit(tracker, "FundsSpent")
                .withArgs(donator1.address, recipient1.address, owner.address, amount, timestamp);

            await expect(tx).to.emit(tracker, "SpendingReason")
                .withArgs(donator1, timestamp, "TotalPayout");

            const balanceAfter = await ethers.provider.getBalance(owner.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });

        it("Should revert if recipient does not have the proper totalBalance", async function () {
            const recipientBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            const overflow = recipientBalance + 1n;

            await expect(tracker.connect(recipient1).payout(owner, "test", {value: overflow})
            ).to.be.revertedWithCustomError(tracker, "NotEnoughFunds").withArgs(recipientBalance, overflow);
        });

        it("Should handle full spend", async function () {
            //recipient1 (colin) has 10% of shares so
            const fullShare = ethers.parseEther("1");
            await tracker.connect(recipient1).payout(owner, "TotalPayout", {value: fullShare});

            // donation is not empty, only recipient share has been processed
            const remainingDonations = await tracker.userDonationCount(donator1.address);
            expect(remainingDonations).to.equal(1);

            const d = await tracker.userDonationAt(donator1.address, 0);
            expect(d.remaining).to.equal(ethers.parseEther("9")); // 10 - 1
        });

        it("Should handle partial spend", async function () {
            //recipient1 (colin) has 10% of shares so
            const partial = ethers.parseEther("0.5");
            await tracker.connect(recipient1).payout(owner, "PartialPayout", {value: partial});

            const d = await tracker.userDonationAt(donator1.address, 0);
            expect(d.remaining).to.equal(ethers.parseEther("10") - partial);
        });

        it("Should handle a fully spent donation", async function () {
            // recipient1 has 10%
            const share1 = ethers.parseEther("1");
            await tracker.connect(recipient1).payout(owner, "TotalPayout", {value: share1});

            // recipient2 has 20%
            const share2 = ethers.parseEther("2");
            await tracker.connect(recipient2).payout(owner, "TotalPayout", {value: share2});

            // recipient3 has 35%
            const share3 = ethers.parseEther("3.5");
            await tracker.connect(recipient3).payout(owner, "TotalPayout", {value: share3});

            // recipient4 has 35%
            const share4 = ethers.parseEther("3.5");
            await tracker.connect(recipient4).payout(owner, "TotalPayout", {value: share4});

            await expect(
                tracker.userDonationAt(donator1.address, 0)
            ).to.be.revertedWithCustomError(tracker, "InvalidIndex").withArgs(0);
        });

        it("Should update recipientTotalBalance correctly after payout", async function () {
            const initialBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            const payoutAmount = ethers.parseEther("0.5");

            await tracker.connect(recipient1).payout(owner, "Test", {value: payoutAmount});

            const finalBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            expect(finalBalance).to.equal(initialBalance - payoutAmount);
        });

        it("Should update totalSpent correctly after payout", async function () {
            const initialTotalSpent = await tracker.totalSpent();
            const payoutAmount = ethers.parseEther("0.5");

            await tracker.connect(recipient1).payout(owner, "Test", {value: payoutAmount});

            const finalTotalSpent = await tracker.totalSpent();
            expect(finalTotalSpent).to.equal(initialTotalSpent + payoutAmount);
        });

        it("Should correctly maintain donation.index after cleanup (single donation removed)", async function () {
            // Add a second donation from donator1
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
            const toAllocate2: Donation = await tracker.userDonationAt(donator1.address, 1);

            const donation2 = {
                donator: toAllocate2.donator,
                amount: toAllocate2.amount,
                remaining: toAllocate2.remaining,
                timestamp: toAllocate2.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate2.index,
            };

            await tracker.connect(owner).allocate(donation2);

            // Fully spend the first donation (index 0)
            await tracker.connect(recipient1).payout(owner, "Spend1", {value: ethers.parseEther("1")});
            await tracker.connect(recipient2).payout(owner, "Spend2", {value: ethers.parseEther("2")});
            await tracker.connect(recipient3).payout(owner, "Spend3", {value: ethers.parseEther("3.5")});
            await tracker.connect(recipient4).payout(owner, "Spend4", {value: ethers.parseEther("3.5")});

            // First donation should be removed, second donation should now be at index 0
            const remainingDonation = await tracker.userDonationAt(donator1.address, 0);
            expect(remainingDonation.index).to.equal(0);
            expect(remainingDonation.amount).to.equal(ethers.parseEther("10.0"));

            // Should only have 1 donation left
            expect(await tracker.userDonationCount(donator1.address)).to.equal(1);
        });

        it("Should correctly maintain donation.index after cleanup (middle donation removed)", async function () {
            // Create 3 donations
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});

            const toAllocate2: Donation = await tracker.userDonationAt(donator1.address, 1);
            const toAllocate3: Donation = await tracker.userDonationAt(donator1.address, 2);

            await tracker.connect(owner).allocate({
                donator: toAllocate2.donator,
                amount: toAllocate2.amount,
                remaining: toAllocate2.remaining,
                timestamp: toAllocate2.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate2.index,
            });

            await tracker.connect(owner).allocate({
                donator: toAllocate3.donator,
                amount: toAllocate3.amount,
                remaining: toAllocate3.remaining,
                timestamp: toAllocate3.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate3.index,
            });

            // Now we have 3 donations, each with 10 ETH remaining
            // To remove donation[0], we need all recipients to spend 10 ETH total
            await tracker.connect(recipient1).payout(owner, "Spend1", {value: ethers.parseEther("1")});
            await tracker.connect(recipient2).payout(owner, "Spend2", {value: ethers.parseEther("2")});
            await tracker.connect(recipient3).payout(owner, "Spend3", {value: ethers.parseEther("3.5")});
            await tracker.connect(recipient4).payout(owner, "Spend4", {value: ethers.parseEther("3.5")});
            // Total: 10 ETH spent, donation[0] should be removed

            // Should have 2 donations left (donation[1] and donation[2])
            expect(await tracker.userDonationCount(donator1.address)).to.equal(2);

            // Check that indices are correct and sequential
            // What was donation[2] should now be at index 1 (swapped with removed donation[0])
            for (let i = 0; i < 2; i++) {
                const d = await tracker.userDonationAt(donator1.address, i);
                expect(d.index).to.equal(i);
            }
        });


        it("Should remove donator from recipientDonators when all their donations are spent", async function () {
            // Fully spend donator1's allocation for recipient1
            await tracker.connect(recipient1).payout(owner, "FullSpend", {value: ethers.parseEther("1")});

            const donators = await tracker.getRecipientDonators(recipient1.address);
            expect(donators.length).to.equal(0);
        });

        it("Should keep donator in recipientDonators when they have remaining donations", async function () {
            // Partially spend donator1's allocation for recipient1
            await tracker.connect(recipient1).payout(owner, "PartialSpend", {value: ethers.parseEther("0.5")});

            const donators = await tracker.getRecipientDonators(recipient1.address);
            expect(donators).to.include(donator1.address);
            expect(donators.length).to.equal(1);
        });

        it("Should handle multiple donators with mixed spend patterns", async function () {
            // Add donation from donator2
            await tracker.connect(donator2).donate({value: ethers.parseEther("20.0")});
            const toAllocate2: Donation = await tracker.userDonationAt(donator2.address, 0);

            await tracker.connect(owner).allocate({
                donator: toAllocate2.donator,
                amount: toAllocate2.amount,
                remaining: toAllocate2.remaining,
                timestamp: toAllocate2.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate2.index,
            });

            // recipient1 has 10% from donator1 (1 ETH) + 10% from donator2 (2 ETH) = 3 ETH total
            const initialDonators = await tracker.getRecipientDonators(recipient1.address);
            expect(initialDonators.length).to.equal(2);

            // Spend exactly donator1's full share (1 ETH)
            await tracker.connect(recipient1).payout(owner, "SpendDonator1Share", {value: ethers.parseEther("1")});

            // donator1 should be removed, donator2 should remain
            const remainingDonators = await tracker.getRecipientDonators(recipient1.address);
            expect(remainingDonators.length).to.equal(1);
            expect(remainingDonators).to.include(donator2.address);
            expect(remainingDonators).to.not.include(donator1.address);
        });

        it("Should handle payout across multiple donations from same donator", async function () {
            // Add second donation from donator1
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
            const toAllocate2: Donation = await tracker.userDonationAt(donator1.address, 1);

            await tracker.connect(owner).allocate({
                donator: toAllocate2.donator,
                amount: toAllocate2.amount,
                remaining: toAllocate2.remaining,
                timestamp: toAllocate2.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate2.index,
            });

            // recipient1 now has 2 ETH total (1 from each donation)
            const totalBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            expect(totalBalance).to.equal(ethers.parseEther("2"));

            // Spend 1.5 ETH (should come from first donation's remaining, which is 10 ETH)
            await tracker.connect(recipient1).payout(owner, "CrossDonationSpend", {value: ethers.parseEther("1.5")});

            // First donation now has 8.5 ETH remaining (10 - 1.5)
            // Second donation still has 10 ETH remaining
            const donation0 = await tracker.userDonationAt(donator1.address, 0);
            expect(donation0.remaining).to.equal(ethers.parseEther("8.5"));

            // Should have 2 donations still
            expect(await tracker.userDonationCount(donator1.address)).to.equal(2);
        });

        it("Should emit correct events when spending across multiple donations", async function () {
            // Add second donation
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
            const toAllocate2: Donation = await tracker.userDonationAt(donator1.address, 1);
            await tracker.connect(owner).allocate({
                donator: toAllocate2.donator,
                amount: toAllocate2.amount,
                remaining: toAllocate2.remaining,
                timestamp: toAllocate2.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: toAllocate2.index,
            });

            // Spend across both donations
            const tx = await tracker.connect(recipient1).payout(owner, "MultiDonationSpend", {value: ethers.parseEther("1.5")});
            const receipt = await tx.wait();

            // Should emit FundsSpent events - but since donation.remaining is global,
            // the 1.5 ETH will come from first donation's remaining (which is 10 ETH after allocation)
            const fundsSpentEvents = receipt.logs
                .map((log: any) => {
                    try {
                        return tracker.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .filter((event: any) => event !== null && event.name === "FundsSpent");

            // Actually, it should emit 1 event since 1.5 ETH < first donation's 10 ETH remaining
            expect(fundsSpentEvents.length).to.equal(1);
            expect(fundsSpentEvents[0].args.amount).to.equal(ethers.parseEther("1.5"));
        });

        it("Should skip unallocated donations during payout", async function () {
            // Add a second donation but don't allocate it
            await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});

            // Payout should only use allocated funds (first donation)
            const initialBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            expect(initialBalance).to.equal(ethers.parseEther("1")); // Only first donation's 10%

            await tracker.connect(recipient1).payout(owner, "Test", {value: ethers.parseEther("1")});

            // Both donations should still exist (first one has 9 ETH remaining, second unallocated)
            expect(await tracker.userDonationCount(donator1.address)).to.equal(2);

            const firstDonation = await tracker.userDonationAt(donator1.address, 0);
            expect(firstDonation.remaining).to.equal(ethers.parseEther("9"));

            const secondDonation = await tracker.userDonationAt(donator1.address, 1);
            expect(secondDonation.allocated).to.be.false;
        });

        it("Should handle edge case: payout of 0 ETH", async function () {
            // This should technically work but do nothing
            const initialBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);

            await tracker.connect(recipient1).payout(owner, "ZeroPayout", {value: 0});

            const finalBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            expect(finalBalance).to.equal(initialBalance);
        });

        it("Should maintain array integrity after multiple cleanup operations", async function () {
            // Create 5 donations
            for (let i = 0; i < 4; i++) {
                await tracker.connect(donator1).donate({value: ethers.parseEther("10.0")});
                const toAllocate: Donation = await tracker.userDonationAt(donator1.address, i + 1);
                await tracker.connect(owner).allocate({
                    donator: toAllocate.donator,
                    amount: toAllocate.amount,
                    remaining: toAllocate.remaining,
                    timestamp: toAllocate.timestamp,
                    allocated: false,
                    receiptRequested: false,
                    receiptMinted: false,
                    index: toAllocate.index,
                });
            }

            // Now we have 5 donations, each with 10 ETH remaining
            expect(await tracker.userDonationCount(donator1.address)).to.equal(5);

            // Spend 2.5 ETH (should come from first donation, leaving it with 7.5 ETH)
            await tracker.connect(recipient1).payout(owner, "MultiCleanup", {value: ethers.parseEther("2.5")});

            // Should still have 5 donations (none removed yet)
            expect(await tracker.userDonationCount(donator1.address)).to.equal(5);

            // Verify first donation has correct remaining
            const firstDonation = await tracker.userDonationAt(donator1.address, 0);
            expect(firstDonation.remaining).to.equal(ethers.parseEther("7.5"));

            // Verify all indices are correct and sequential
            for (let i = 0; i < 5; i++) {
                const d = await tracker.userDonationAt(donator1.address, i);
                expect(d.index).to.equal(i);
            }
        });
    });

    describe("Receipt Request", function () {

        let tracker: any;
        let receipt: any;
        let owner: any;
        let donator1: any;
        let donator2: any;
        let recipient1: any;
        let donation: Donation;

        beforeEach(async () => {
            ({tracker, receipt, owner, recipient1, donator1, donator2} = await setUpSmartContract());
            let donationReceipt = await donate(donator1, ethers.parseEther("10.0"))
            const events = donationReceipt?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null; // ignore logs from other contracts
                }
            }).filter((event: any) => event !== null);

            const donationEvent = events[0];
            donation = {
                donator: donationEvent.args?.donator,
                amount: donationEvent.args?.amount,
                remaining: donationEvent.args?.amount,
                timestamp: donationEvent.args?.timestamp,
                allocated: false,
                receiptRequested: false,
                receiptMinted: false,
                index: donationEvent.args?.index
            };
        })

        async function donate(donator: any, amount: BigInt) {
            const tx = await tracker.connect(donator).donate({
                value: amount
            })

            return await tx.wait();
        }

        describe("Request", function () {

            it("Should revert user is not a donator", async function () {
                await expect(
                    tracker.connect(recipient1).requestReceipt(1)
                ).to.be.revertedWithCustomError(tracker, "NotADonator").withArgs(recipient1.address);
            });

            it("Should allow the donator to request a receipt for an unrequested donation and emit event", async function () {

                let donation = await tracker.userDonationAt(donator1.address, 0);
                expect(donation.receiptRequested).to.be.false;

                const tx = await tracker.connect(donator1).requestReceipt(0);
                const receiptTx = await tx.wait();

                donation = await tracker.userDonationAt(donator1.address, 0);
                expect(donation.receiptRequested).to.be.true;

                const block = await ethers.provider.getBlock(receiptTx!.blockHash);
                const timestamp = block!.timestamp;

                await expect(tx)
                    .to.emit(tracker, "ReceiptRequested")
                    .withArgs(donator1.address, 0, timestamp);

            });

            it("Should revert if an invalid index is provided", async function () {
                // receipt 0 is in the setUp()
                await expect(
                    tracker.connect(donator1).requestReceipt(1)
                ).to.be.revertedWithCustomError(tracker, "InvalidIndex").withArgs(1);

            });

            it("Should revert if the receipt has already been requested", async function () {
                await donate(donator1, ethers.parseEther("1.0"));
                await tracker.connect(donator1).requestReceipt(0);

                await expect(
                    tracker.connect(donator1).requestReceipt(0)
                ).to.be.revertedWithCustomError(tracker, "ReceiptAlreadyRequested");
            });
        });

        describe("Mint", function () {
            const TOKEN_URI = "test/metadata.json";
            it("Should successfully mint a receipt NFT and emit an event", async function () {

                await tracker.connect(donator1).requestReceipt(0);

                const tx = await tracker.connect(owner).mintReceipt(donator1.address, 0, TOKEN_URI);
                const receiptTx = await tx.wait();

                const donation = await tracker.userDonationAt(donator1.address, 0);
                expect(donation.receiptMinted).to.be.true;

                const block = await ethers.provider.getBlock(receiptTx!.blockHash);
                const timestamp = block!.timestamp;
                await expect(tx)
                    .to.emit(tracker, "ReceiptMinted")
                    .withArgs(owner.address, donator1.address, 0, 1, timestamp);

                // ASSERT 3: Check the NFT was actually minted and tokenURI set
                const receiptAddress = await receipt.getAddress();
                const tokenId = 1n; // First mint will be token ID 1
                expect(await receipt.ownerOf(tokenId)).to.equal(donator1.address);
                expect(await receipt.tokenURI(tokenId)).to.equal(TOKEN_URI);
            });

            it("Should revert if called by a non-owner", async function () {
                await expect(
                    tracker.connect(donator1).mintReceipt(donator1.address, 0, TOKEN_URI)
                ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount");
            });

            it("Should revert if an invalid index is provided", async function () {
                const invalidIndex = 1;
                await expect(
                    tracker.connect(owner).mintReceipt(donator1.address, invalidIndex, TOKEN_URI)
                ).to.be.revertedWithCustomError(tracker, "InvalidIndex").withArgs(invalidIndex);
            });

            it("Should revert if the receipt has NOT been requested", async function () {
                await donate(donator1, ethers.parseEther("1.0"));
                const unrequestedIndex = 1;

                const donation = await tracker.userDonationAt(donator1.address, unrequestedIndex);
                expect(donation.receiptRequested).to.be.false;

                await expect(
                    tracker.connect(owner).mintReceipt(donator1.address, unrequestedIndex, TOKEN_URI)
                ).to.be.revertedWithCustomError(tracker, "ReceiptNotRequested").withArgs(donator1.address, unrequestedIndex);
            });

            it("Should revert if the receipt has already been minted", async function () {

                await tracker.connect(donator1).requestReceipt(0);

                await tracker.connect(owner).mintReceipt(donator1.address, 0, TOKEN_URI);

                await expect(
                    tracker.connect(owner).mintReceipt(donator1.address, 0, TOKEN_URI)
                ).to.be.revertedWithCustomError(tracker, "ReceiptAlreadyMinted").withArgs(donator1.address, 0);
            });
        })
    });

    describe("Withdraw Leftovers", function () {

        let tracker: any;
        let owner: any;
        let donator1: any;
        let recipient1: any;


        beforeEach(async () => {
            ({tracker, owner, donator1, recipient1} = await setUpSmartContract());
        })

        it("Should revert if a non-owner attempts to call transferLeftoversToWallet", async function () {
            await expect(
                tracker.connect(donator1).transferLeftoversToWallet()
            ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount");

            await expect(
                tracker.connect(recipient1).transferLeftoversToWallet()
            ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount");
        });

        it("Should revert if totalDonationLeftovers is 0", async function () {
            const currentLeftovers = await tracker.totalDonationLeftovers();
            expect(currentLeftovers).to.be.equal(0n);

            await expect(
                tracker.connect(owner).transferLeftoversToWallet()
            ).to.be.revertedWithCustomError(tracker, "NotEnoughFunds")
                .withArgs(currentLeftovers, currentLeftovers);
        });

        it("Should successfully transfer leftovers to the owner and reset the totalDonationLeftovers state", async function () {
            await tracker.connect(donator1).donate({value: 1n});
            const donationToAllocate: Donation = await tracker.userDonationAt(donator1.address, 0);

            const donation = {
                donator: donationToAllocate.donator,
                amount: donationToAllocate.amount,
                remaining: donationToAllocate.remaining,
                timestamp: donationToAllocate.timestamp,
                allocated: donationToAllocate.allocated,
                receiptRequested: donationToAllocate.receiptRequested,
                receiptMinted: donationToAllocate.receiptMinted,
                index: donationToAllocate.index,
            };

            await tracker.connect(owner).allocate(donation);

            const expectedLeftovers = await tracker.totalDonationLeftovers();
            expect(expectedLeftovers).to.be.equal(1n);

            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

            const tx = await tracker.connect(owner).transferLeftoversToWallet();
            const receipt = await tx.wait();

            const gasUsed = BigInt(receipt!.gasUsed);
            const gasPrice = BigInt(tx.gasPrice);
            const gasCost = gasUsed * gasPrice;
            const block = await ethers.provider.getBlock(receipt!.blockHash);
            const timestamp = block!.timestamp;

            const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

            const expectedFinalOwnerBalance = initialOwnerBalance + expectedLeftovers - gasCost;

            expect(finalOwnerBalance).to.be.equal(expectedFinalOwnerBalance);

            expect(await tracker.totalDonationLeftovers()).to.be.equal(0n);

            const contractBalance = await ethers.provider.getBalance(await tracker.getAddress());
            expect(contractBalance).to.be.equal(0n);

            await expect(tx)
                .to.emit(tracker, "LeftoverTransferred")
                .withArgs(tracker, owner, 1n, timestamp);
        });

    });

    describe("Various", function () {

        let tracker: any;
        let owner: any;
        let donator1: any;
        let recipient1: any;

        beforeEach(async () => {
            ({tracker, owner, donator1, recipient1} = await setUpSmartContract());
        })

        it("Should handle zero-value donations (revert)", async function () {
            await expect(
                donator1.sendTransaction({
                    to: await tracker.getAddress(),
                    value: 0,
                })
            ).to.be.revert(ethers); // Ethers.js/Hardhat may not revert explicitly, but the transaction will fail
        });

        it("isAllowedRecipient() return false if address is not a recipient", async function () {
            expect(await tracker.connect(owner).isAllowedRecipient()).to.be.false;
            expect(await tracker.connect(donator1).isAllowedRecipient()).to.be.false;
            expect(await tracker.connect(recipient1).isAllowedRecipient()).to.be.true;
        });

        it("getRecipientTotalBalance() should revert if not called by a recipient", async function () {
            await expect(tracker.connect(owner).getRecipientTotalBalance(recipient1.address)).to.be.revertedWithCustomError(tracker, "NotARecipient").withArgs(owner.address);
            await expect(tracker.connect(donator1).getRecipientTotalBalance(recipient1.address)).to.be.revertedWithCustomError(tracker, "NotARecipient").withArgs(donator1.address);
            await expect(tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address)).to.not.be.revertedWith("NotARecipient");
        });

    });

    describe("Safety Limits", function () {
        let tracker: any, owner: any, donator1: any, recipient1: any;

        beforeEach(async () => {
            ({tracker, owner, donator1, recipient1} = await setUpSmartContract());
        });

        it("Should enforce MAX_DONATIONS_PER_DONATOR limit", async function () {
            const MAX_DONATIONS = await tracker.MAX_DONATIONS_PER_DONATOR();

            // Make MAX_DONATIONS donations successfully
            for (let i = 0; i < Number(MAX_DONATIONS); i++) {
                await tracker.connect(donator1).donate({value: ethers.parseEther("1")});
            }

            // Verify we have MAX_DONATIONS donations
            const count = await tracker.userDonationCount(donator1.address);
            expect(count).to.equal(MAX_DONATIONS);

            // The next donation should fail
            await expect(
                tracker.connect(donator1).donate({value: ethers.parseEther("1")})
            ).to.be.revertedWithCustomError(tracker, "TooManyDonations")
                .withArgs(donator1.address, MAX_DONATIONS, MAX_DONATIONS);
        });

        it("Should enforce MAX_ACTIVE_DONATORS_PER_RECIPIENT limit", async function () {
            const MAX_DONATORS = await tracker.MAX_ACTIVE_DONATORS_PER_RECIPIENT();
            const signers = await ethers.getSigners();

            // Use signers starting from index 5 (after owner and 4 recipients)
            // Hardhat provides 20 signers by default, so we have 15 available (5-19)
            const startIndex = 5;
            const donators = signers.slice(startIndex, startIndex + Number(MAX_DONATORS));

            for (let i = 0; i < donators.length; i++) {
                const tx = await tracker.connect(donators[i]).donate({value: ethers.parseEther("1")});
                await tx.wait();
            }

            // Allocate all donations (this should work)
            for (let i = 0; i < donators.length; i++) {
                const donatorAddress = await donators[i].getAddress();
                const donation = await tracker.userDonationAt(donatorAddress, 0);
                const donationCopy = {
                    donator: donation.donator,
                    amount: donation.amount,
                    remaining: donation.remaining,
                    timestamp: donation.timestamp,
                    allocated: donation.allocated,
                    receiptRequested: donation.receiptRequested,
                    receiptMinted: donation.receiptMinted,
                    index: donation.index
                };
                await tracker.connect(owner).allocate(donationCopy);
            }

            // Verify recipient1 has MAX_DONATORS active donators
            const activeDonators = await tracker.getRecipientDonators(recipient1.address);
            expect(activeDonators.length).to.equal(MAX_DONATORS);

            // Try to add one more donator - should fail
            const extraDonator = signers[startIndex + Number(MAX_DONATORS)];
            await tracker.connect(extraDonator).donate({value: ethers.parseEther("1")});
            const extraDonatorAddress = await extraDonator.getAddress();
            const extraDonation = await tracker.userDonationAt(extraDonatorAddress, 0);
            const extraDonationCopy = {
                donator: extraDonation.donator,
                amount: extraDonation.amount,
                remaining: extraDonation.remaining,
                timestamp: extraDonation.timestamp,
                allocated: extraDonation.allocated,
                receiptRequested: extraDonation.receiptRequested,
                receiptMinted: extraDonation.receiptMinted,
                index: extraDonation.index
            };

            await expect(
                tracker.connect(owner).allocate(extraDonationCopy)
            ).to.be.revertedWithCustomError(tracker, "TooManyActiveDonators")
                .withArgs(recipient1.address, MAX_DONATORS, MAX_DONATORS);
        });

        it("Should allow new donations after previous ones are fully spent", async function () {
            const MAX_DONATIONS = await tracker.MAX_DONATIONS_PER_DONATOR();

            // Fill up to the limit
            for (let i = 0; i < Number(MAX_DONATIONS); i++) {
                await tracker.connect(donator1).donate({value: ethers.parseEther("1")});
            }

            // Allocate all donations
            for (let i = 0; i < Number(MAX_DONATIONS); i++) {
                const donation = await tracker.userDonationAt(donator1.address, i);
                const donationCopy = {
                    donator: donation.donator,
                    amount: donation.amount,
                    remaining: donation.remaining,
                    timestamp: donation.timestamp,
                    allocated: donation.allocated,
                    receiptRequested: donation.receiptRequested,
                    receiptMinted: donation.receiptMinted,
                    index: donation.index
                };
                await tracker.connect(owner).allocate(donationCopy);
            }

            // Get recipient1's balance and spend it all
            const balance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            await tracker.connect(recipient1).payout(donator1.address, "Full spend", {value: balance});

            // After spending, the cleanup should have removed the spent donations
            // Now we should be able to donate again
            await expect(
                tracker.connect(donator1).donate({value: ethers.parseEther("1")})
            ).to.not.be.revert(ethers);
        });
    });

    describe("Emergency Withdraw", function () {
        it("Should allow owner to withdraw all contract funds", async function () {
            const {tracker, owner, donator1} = await setUpSmartContract();

            // Make some donations to have funds in the contract
            await tracker.connect(donator1).donate({value: parseEther("10")});

            // Get initial balances
            const contractBalanceBefore = await tracker.contractBalance();
            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            expect(contractBalanceBefore).to.equal(parseEther("10"));

            // Execute emergency withdraw
            const tx = await tracker.connect(owner).emergencyWithdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            // Verify contract balance is now zero
            const contractBalanceAfter = await tracker.contractBalance();
            expect(contractBalanceAfter).to.equal(0);

            // Verify owner received the funds (minus gas)
            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerBalanceAfter).to.equal(
                ownerBalanceBefore + contractBalanceBefore - gasUsed
            );
        });

        it("Should revert when non-owner tries to withdraw", async function () {
            const {tracker, donator1, donator2} = await setUpSmartContract();

            // Make a donation to have funds in contract
            await tracker.connect(donator1).donate({value: parseEther("5")});

            // Try to withdraw as non-owner
            await expect(
                tracker.connect(donator2).emergencyWithdraw()
            ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount");
        });

        it("Should revert when contract balance is zero", async function () {
            const {tracker, owner} = await setUpSmartContract();

            // Verify contract balance is zero
            const balance = await tracker.contractBalance();
            expect(balance).to.equal(0);

            // Try to withdraw with zero balance
            await expect(
                tracker.connect(owner).emergencyWithdraw()
            ).to.be.revertedWithCustomError(tracker, "NotEnoughFunds")
                .withArgs(0, 0);
        });

        it("Should work after donations, allocations, and payouts", async function () {
            const {tracker, owner, recipient1, donator1, donator2} = await setUpSmartContract();

            // Make donations
            await tracker.connect(donator1).donate({value: parseEther("10")});
            await tracker.connect(donator2).donate({value: parseEther("20")});

            // Allocate first donation
            const donation1 = await tracker.userDonationAt(donator1.address, 0);
            const donationCopy1 = {
                donator: donation1.donator,
                amount: donation1.amount,
                remaining: donation1.remaining,
                timestamp: donation1.timestamp,
                allocated: donation1.allocated,
                receiptRequested: donation1.receiptRequested,
                receiptMinted: donation1.receiptMinted,
                index: donation1.index
            };
            await tracker.connect(owner).allocate(donationCopy1);

            // Recipient spends some funds
            const recipientBalance = await tracker.connect(recipient1).getRecipientTotalBalance(recipient1.address);
            const payoutAmount = recipientBalance / 2n; // Spend 50%
            await tracker.connect(recipient1).payout(donator1.address, "Test payout", {
                value: payoutAmount
            });

            // Now emergency withdraw remaining funds
            const contractBalanceBefore = await tracker.contractBalance();
            expect(contractBalanceBefore).to.be.greaterThan(0);

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            const tx = await tracker.connect(owner).emergencyWithdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            // Verify contract is empty
            const contractBalanceAfter = await tracker.contractBalance();
            expect(contractBalanceAfter).to.equal(0);

            // Verify owner received funds
            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerBalanceAfter).to.equal(
                ownerBalanceBefore + contractBalanceBefore - gasUsed
            );
        });

        it("Should withdraw the exact contract balance including dust", async function () {
            const {tracker, owner, donator1, donator2, donator3} = await setUpSmartContract();

            // Make donations with odd amounts that might create rounding dust
            await tracker.connect(donator1).donate({value: parseEther("3.333333333333333333")});
            await tracker.connect(donator2).donate({value: parseEther("7.777777777777777777")});
            await tracker.connect(donator3).donate({value: parseEther("1.111111111111111111")});

            const contractBalance = await tracker.contractBalance();
            const expectedBalance = parseEther("3.333333333333333333") +
                                   parseEther("7.777777777777777777") +
                                   parseEther("1.111111111111111111");

            expect(contractBalance).to.equal(expectedBalance);

            // Withdraw everything
            await tracker.connect(owner).emergencyWithdraw();

            // Verify absolutely zero balance
            const finalBalance = await tracker.contractBalance();
            expect(finalBalance).to.equal(0);
        });

        it("Should emit the emergencyWithdraw event", async function () {
            const {tracker, owner, donator1, donator2, donator3} = await setUpSmartContract();

            // Make donations with odd amounts that might create rounding dust
            await tracker.connect(donator1).donate({value: parseEther("1")});

            const tx = await tracker.connect(owner).emergencyWithdraw()
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt!.blockHash);
            const timestamp = block!.timestamp;


            expect (tx ).to.emit(tracker, "EmergencyWithdraw")
                .withArgs(await tracker.getAddress(), owner.address, parseEther("1"), timestamp);

        });

    });
});
