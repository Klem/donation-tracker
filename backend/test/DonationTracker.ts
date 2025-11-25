import {expect} from "chai";
import {network} from "hardhat";

const {ethers} = await network.connect();

async function setUpSmartContract() {

    const [owner, donator1, donator2, donator3] = await ethers.getSigners();
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
    return {tracker, receipt, owner, donator1, donator2, donator3};
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
        let owner: any;
        let donator1: any;

        before(async () => {
            ({tracker, owner, donator1} = await setUpSmartContract());
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

        beforeEach(async () => {
            ({tracker, owner, donator1, donator2} = await setUpSmartContract());
            let donationReceipt = await donate(donator1, ethers.parseEther("10.0"))
            const events = donationReceipt?.logs.map((log: any) => {
                try {
                    return tracker.interface.parseLog(log);
                } catch {
                    return null; // ignore logs from other contracts
                }
            })

            console.table(events[0].args);

        });

        it.skip("Should handle rounding errors and add the leftover to totalDonationLeftovers", async function () {
            // Donate 1 wei to test rounding
            const donationAmount = 1n;

            await tracker.connect(donator1).donate({
                value: donationAmount
            })

            expect(await tracker.totalDonationLeftovers()).to.be.eq(donationAmount);
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

    });
});
