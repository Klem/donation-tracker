import {expect} from "chai";
import {network} from "hardhat";

const {ethers} = await network.connect();

async function setUpSmartContract() {
    const signers = await ethers.getSigners();

    const owner = signers[0];
    const recipient1 = signers[1];
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
    return {tracker, receipt, owner, recipient1, donator1, donator2, donator3};
}

export interface Donation {
    donator: string;     // address → string in TS
    amount: bigint;      // uint256 → bigint (recommended for large numbers)
    timestamp: bigint;   // uint256 → bigint
    receiptRequested: boolean;
    receiptMinted: boolean;
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

    describe("Allocate", async function() {
        let tracker: any;
        let owner: any;
        let donator1: any;
        let donator2: any;
        let donation: Donation;
        let donationReceipt: any;

        beforeEach(async () => {
            ({tracker, owner, donator1, donator2} = await setUpSmartContract());
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
                timestamp: donationEvent.args?.timestamp,
                receiptRequested: false,
                receiptMinted: false
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
                timestamp: donationEvent2.args?.timestamp,
                receiptRequested: false,
                receiptMinted: false
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
                timestamp: smallDonationEvent.args?.timestamp,
                receiptRequested: false,
                receiptMinted: false
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

    describe("Receipt Request", function () {

        let tracker: any;
        let receipt: any;
        let owner: any;
        let donator1: any;
        let donator2: any;
        let donation: Donation;

        beforeEach(async () => {
            ({tracker, receipt, owner, donator1, donator2} = await setUpSmartContract());
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
                timestamp: donationEvent.args?.timestamp,
                receiptRequested: false,
                receiptMinted: false
            };
        })

        async function donate(donator: any, amount: BigInt) {
            const tx = await tracker.connect(donator).donate({
                value: amount
            })

            return await tx.wait();
        }

        describe("Request", function () {
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

        describe("Mint", function(){
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
                    .withArgs(owner.address, donator1.address, 0, timestamp);

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
            await tracker.connect(donator1).donate({ value: 1n });
            const donationToAllocate = await tracker.userDonationAt(donator1.address, 0);

            const donation = {
                donator: donationToAllocate[0],
                amount: donationToAllocate[1],
                timestamp: 0,
                receiptRequested: false,
                receiptMinted: false,
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
                .withArgs(tracker, owner , 1n, timestamp);
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

    });
});
