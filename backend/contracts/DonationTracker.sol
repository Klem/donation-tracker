// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DonationReceipt} from "./DonationReceipt.sol";

contract DonationTracker is Ownable, ReentrancyGuard {
    mapping(address => Donation[]) private donations;
    mapping(address => uint) private totalUserDonations;
    mapping(address => uint) private totalUnspentUserDonations;
    mapping(address => mapping(address => uint)) private recipientBalancesByDonator;
    mapping(address => address[]) private recipientDonators;
    mapping(address => uint) private recipientTotalBalance;

    /**
     * These will only increase onvertime
     */
    uint public totalDonated;
    uint public totalAllocated;
    uint public totalSpent;
    uint public totalDonators;

    uint private constant PERCENTAGE_BASE = 10000; // 100% is 10000 units
    uint public totalDonationLeftovers; // from possible rounding issues

    DonationReceipt public donationReceipt;

    struct Donation {
        address donator;
        uint amount;
        uint remaining;
        uint timestamp;
        bool allocated;
        bool receiptRequested;
        bool receiptMinted;
        uint index;
    }

    struct Allocation {
        address donator;
        uint amount;
        address to;
        address from;
        uint timestamp;
    }

    struct Recipient {
        string name;
        address payable wallet;
        uint percentage; // In units of PERCENTAGE_BASE
    }

    Recipient[] private ALLOCATION_RECIPIENTS;

    event DonationReceived(address indexed donator, uint amount, uint indexed timestamp, uint index);
    event FundsAllocated (address indexed donator, address indexed from, address indexed to, uint amount, uint timestamp);
    event FundsSpent (address indexed donator, address indexed from, address indexed to, uint amount, uint timestamp);
    event SpendingReason (address indexed donator, uint timestamp, string message);
    event ReceiptRequested (address indexed donator, uint index, uint timestamp);
    event ReceiptMinted (address indexed minter, address indexed donator, uint index, uint tokenId, uint timestamp);
    event LeftoverTransferred (address indexed from, address indexed to, uint amount, uint timestamp);

    error NotEnoughFunds(uint256 available, uint256 requested);
    error AllocationFailed (address donator, address from, address to, uint amount, uint timestamp);
    error InvalidIndex(uint index);
    error NotARecipient(address addr);
    error NotADonator(address addr);
    error NullDonation(address addr);
    error UseDonateFunction();
    error TransferFailed();
    error ReceiptAlreadyRequested(address donator, uint tokenId);
    error ReceiptNotRequested(address donator, uint tokenId);
    error ReceiptAlreadyMinted(address donator, uint tokenId);

    modifier onlyRecipient() {
        bool isRecipient = false;
        for (uint i = 0; i < ALLOCATION_RECIPIENTS.length; i++) {
            if (ALLOCATION_RECIPIENTS[i].wallet == msg.sender) {
                isRecipient = true;
                break;
            }
        }
        require(isRecipient, NotARecipient(msg.sender));
        _;
    }

    modifier onlyDonator() {
        bool isDonator = false;
        require(donations[msg.sender].length > 0, NotADonator(msg.sender));
        _;
    }

    constructor(address _donationReceiptAddress) Ownable(msg.sender) {
        ALLOCATION_RECIPIENTS.push(
            Recipient("Colin", payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8), 1000)
        );
        ALLOCATION_RECIPIENTS.push(
            Recipient("Alex", payable(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC), 2000)
        );
        ALLOCATION_RECIPIENTS.push(
            Recipient("Julian", payable(0x90F79bf6EB2c4f870365E785982E1f101E93b906), 3500)
        );
        ALLOCATION_RECIPIENTS.push(
            Recipient("Klem", payable(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65), 3500)
        );

        donationReceipt = DonationReceipt(_donationReceiptAddress);
    }

    // Optional: Owner can rescue stuck tokens/ETH in emergency
    // and transfer it back to the donator
//    function emergencyWithdraw(address _donator, uint256 _amount) external onlyOwner {
//
//        require(totalUserDonations[_donator] >= _amount, NotEnoughFunds(totalUserDonations[_donator], _amount));
//
//        (bool success,) = _donator.call{value: _amount}("");
//        require(success, "Transfer failed");
//    }



    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function userDonationCount(address _donator) external view returns (uint) {
        return donations[_donator].length;
    }

    function recipients() external view returns (Recipient[] memory) {
        return ALLOCATION_RECIPIENTS;
    }

    function isAllowedRecipient() external view returns (bool) {
        bool isRecipient = false;
        for (uint i = 0; i < ALLOCATION_RECIPIENTS.length; i++) {
            if (ALLOCATION_RECIPIENTS[i].wallet == msg.sender) {
                isRecipient = true;
                break;
            }
        }

        return isRecipient;
    }

    function userDonationAt(address _donator, uint _index) external view returns (Donation memory) {
        require(_index < donations[_donator].length, InvalidIndex(_index));
        return donations[_donator][_index];
    }

    function userTotalDonations(address _donator) external view returns (uint) {
        return totalUserDonations[_donator];
    }

    function userUnspentDonations(address _donator) external view returns (uint) {
        return totalUnspentUserDonations[_donator];
    }

    function transferLeftoversToWallet() external onlyOwner {
        require(totalDonationLeftovers > 0, NotEnoughFunds(0, totalDonationLeftovers));
        uint amount = totalDonationLeftovers;
        totalDonationLeftovers = 0;
        (bool success,) = owner().call{value: amount}("");
        require(success, TransferFailed());

        emit LeftoverTransferred(address(this), owner(), amount, block.timestamp);
    }

    function getRecipientBalanceForDonator(address _recipient, address _donator) external view returns (uint) {
        return recipientBalancesByDonator[_recipient][_donator];
    }

    function getRecipientDonators(address _recipient) external view returns (address[] memory) {
        return recipientDonators[_recipient];
    }

    function getRecipientTotalBalance(address _recipient) onlyRecipient external view returns (uint) {
        return recipientTotalBalance[_recipient];
    }

    function donate() external payable returns (Donation memory)  {
        return _deposit();
    }

    /**
     * @dev use the DonationReceived event to rebuild the donation Struct
     * and provide it as parameter
     */
    function allocate(Donation calldata d) external onlyOwner () {
        _allocateDonation(d);
    }

    function payout(address payable _to, string calldata _message) external payable onlyRecipient () {
        require(recipientTotalBalance[msg.sender] >= msg.value, NotEnoughFunds(recipientTotalBalance[msg.sender], msg.value));
        _payout(_to, msg.value, recipientDonators[msg.sender], _message);
    }

    function requestReceipt(uint _index) external onlyDonator() {
        require(_index < donations[msg.sender].length, InvalidIndex(_index));
        Donation storage d = _userDonationAtStorage(msg.sender, _index);
        require(!d.receiptRequested, ReceiptAlreadyRequested(msg.sender, _index));

        d.receiptRequested = true;

        emit ReceiptRequested(msg.sender, _index, block.timestamp);
    }

    function mintReceipt(address _donator, uint _index, string calldata _tokenURI) external onlyOwner() {
        require(_index < donations[_donator].length, InvalidIndex(_index));
        Donation storage d = _userDonationAtStorage(_donator, _index);
        require(d.receiptRequested, ReceiptNotRequested(_donator, _index));
        require(!d.receiptMinted, ReceiptAlreadyMinted(_donator, _index));
        d.receiptMinted = true;
        uint256 tokenId = donationReceipt.mint(_donator, _tokenURI);
        emit ReceiptMinted(msg.sender, _donator, _index, tokenId, block.timestamp);
    }

    function _userDonationAtStorage(address _donator, uint _index) private view returns (Donation storage) {
        return donations[_donator][_index];
    }

    function _deposit() private returns (Donation memory){
        require(msg.value > 0, NullDonation(msg.sender));
        // check if donator is a new one
        if (donations[msg.sender].length == 0) {
            totalDonators++;
        }

        Donation memory d = Donation({
            donator: msg.sender,
            amount: msg.value,
            remaining: msg.value,
            timestamp: block.timestamp,
            allocated: false,
            receiptRequested: false,
            receiptMinted: false,
            index: donations[msg.sender].length // length of 1 is index 0
        });

        donations[msg.sender].push(d);

        totalUserDonations[msg.sender] += msg.value;
        totalUnspentUserDonations[msg.sender] += msg.value;
        totalDonated += msg.value;

        emit DonationReceived(d.donator, d.amount, d.timestamp, donations[msg.sender].length - 1);

        return d;
    }

    function _allocateDonation(Donation memory d) private nonReentrant {
        uint256 remainingAmount = d.amount;
        for (uint256 i = 0; i < ALLOCATION_RECIPIENTS.length; i++) {
            uint256 recipientAmount = (d.amount * ALLOCATION_RECIPIENTS[i].percentage) / PERCENTAGE_BASE;
            address recipientWallet = ALLOCATION_RECIPIENTS[i].wallet;

            if (recipientAmount == 0) continue;

            remainingAmount -= recipientAmount;
            totalUnspentUserDonations[d.donator] -= recipientAmount;
            totalAllocated += recipientAmount;

            // Save amout donated by this donor to this reicipient
            if (recipientBalancesByDonator[recipientWallet][d.donator] == 0) {
                recipientDonators[recipientWallet].push(d.donator);
            }
            recipientBalancesByDonator[recipientWallet][d.donator] += recipientAmount;
            recipientTotalBalance[recipientWallet] += recipientAmount;

            (bool success,) = recipientWallet.call{value: recipientAmount}("");
            require(success, AllocationFailed(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp));


            emit FundsAllocated(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp);
        }

        // Handle rounding errors (if any)
        if (remainingAmount > 0) {
            totalDonationLeftovers += remainingAmount;
        }

        _userDonationAtStorage(d.donator, d.index).allocated = true;
    }

    function _payout(address payable _to, uint _amount, address[] memory _donators, string calldata _message) onlyRecipient private {
        // loop though all donors of this recipient
        uint _remaining = _amount;
        recipientTotalBalance[msg.sender] -= _amount;
        totalSpent += _amount;

        for (uint256 i = 0; i < _donators.length; i++) {
            address donator = _donators[i];
            Donation[] storage userDonations = donations[donator];

            for (uint256 j = 0; j < userDonations.length && _remaining > 0 ; j++) {
                Donation storage d = userDonations[j];

                if (!d.allocated || d.remaining == 0) continue;

                uint _toSend = _remaining < d.remaining ? _remaining : d.remaining;
                d.remaining -= _toSend;
                _remaining -= _toSend;

                // Update the recipient-specific balance tracking
                recipientBalancesByDonator[msg.sender][donator] -= _toSend;

                if(_toSend > 0) {
                    emit FundsSpent(d.donator, msg.sender, _to, _toSend, block.timestamp);
                    emit SpendingReason(d.donator, block.timestamp, _message);
                }
            }
        }
        (bool success,) = payable(_to).call{value: _amount}("");
        require(success, TransferFailed());

        _cleanupSpentDonations();
    }

    function _cleanupSpentDonations() private {
        address[] storage activeDonators = recipientDonators[msg.sender];
        uint writeIndex = 0;

        // Iterate through all current donators for this recipient
        for (uint i = 0; i < activeDonators.length; i++) {
            address donator = activeDonators[i];
            Donation[] storage userDonations = donations[donator];

            // Remove fully spent donations (where remaining == 0 for ALL recipients)
            uint j = userDonations.length;
            while (j > 0) {
                j--;
                Donation storage d = userDonations[j];

                // Only remove if donation is allocated AND completely spent by ALL recipients
                if (d.allocated && d.remaining == 0) {
                    uint lastIndex = userDonations.length - 1;
                    if (j != lastIndex) {
                        userDonations[j] = userDonations[lastIndex];
                        // Update the swapped donation's index to reflect its new position
                        userDonations[j].index = j;
                    }
                    userDonations.pop();
                }
            }

            // Check if THIS RECIPIENT still has any balance from this donator
            // Use recipientBalancesByDonator which tracks recipient-specific balances
            bool hasRemainingForThisRecipient = recipientBalancesByDonator[msg.sender][donator] > 0;

            // If this recipient still has funds from this donator, keep them in the active list
            if (hasRemainingForThisRecipient) {
                if (writeIndex != i) {
                    activeDonators[writeIndex] = activeDonators[i];
                }
                writeIndex++;
            }
        }

        // Truncate the activeDonators array to remove donators with no remaining funds for this recipient
        while (activeDonators.length > writeIndex) {
            activeDonators.pop();
        }
    }

    receive() external payable {
        revert("UseDonateFunction");
    }

    fallback() external payable {
        revert("UseDonateFunction");
    }

}