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
    mapping(address => uint256) private recipientPayoutCount;
    mapping(address => mapping(uint => uint)) private donationIndexToArrayIndex;
    mapping(address => mapping(uint => bool)) private donationIndexExists;

    /**
     * These will only increase onvertime
     */
    uint public totalDonated;
    uint public totalAllocated;
    uint public totalSpent;
    uint public totalDonators;

    uint private constant CLEANUP_FREQUENCY = 10; // 100% is 10000 units
    uint private constant PERCENTAGE_BASE = 10000; // 100% is 10000 units
    uint public totalDonationLeftovers; // from possible rounding issues

    // Safety limits to prevent gas issues and ensure contract stability
    uint public constant MAX_ACTIVE_DONATORS_PER_RECIPIENT = 10;
    uint public constant MAX_DONATIONS_PER_DONATOR = 20;

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
    event EmergencyWithdraw (address indexed from, address indexed to, uint amount, uint timestamp);
    event AllocationFailed (address donator, address from, address to, uint amount, uint timestamp);


    error NotEnoughFunds(uint256 available, uint256 requested);
    error InvalidIndex(uint index);
    error NotARecipient(address addr);
    error NotADonator(address addr);
    error NullDonation(address addr);
    error UseDonateFunction();
    error TransferFailed(address from, address to, uint amount);
    error ReceiptAlreadyRequested(address donator, uint tokenId);
    error ReceiptNotRequested(address donator, uint tokenId);
    error ReceiptAlreadyMinted(address donator, uint tokenId);
    error TooManyDonations(address donator, uint current, uint max);
    error TooManyActiveDonators(address recipient, uint current, uint max);
    error DonationDeleted(address donator, uint index);

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
        // Hardhat config
        ALLOCATION_RECIPIENTS.push( Recipient("Salaires", payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8), 1000));
        ALLOCATION_RECIPIENTS.push(Recipient("Fournisseurs", payable(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC), 2000));
        ALLOCATION_RECIPIENTS.push(Recipient("Communication", payable(0x90F79bf6EB2c4f870365E785982E1f101E93b906), 3500));
        ALLOCATION_RECIPIENTS.push(Recipient("Loyers et services", payable(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65), 3500));

//        ALLOCATION_RECIPIENTS.push(Recipient("Julian", payable(0x165fe97417a9b8f3bC69DD2881e5675268120240), 2500));
//        ALLOCATION_RECIPIENTS.push( Recipient("Colin", payable(0x6c74829D66d1ea68fcc3ED7309aD56eEbe07A784), 2000));
//        ALLOCATION_RECIPIENTS.push(Recipient("Alex", payable(0xd1C764F76780B4F208DB7b7Bc7bb2d3425310b8a), 3000));
//        ALLOCATION_RECIPIENTS.push(Recipient("Klem", payable(0x8f134Cc37945FE29619ae7755A24329F7d478eA4), 2500));


        donationReceipt = DonationReceipt(_donationReceiptAddress);
    }

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
        require(donationIndexExists[_donator][_index], DonationDeleted(_donator, _index));

        uint currentArrayIndex = donationIndexToArrayIndex[_donator][_index];
        return donations[_donator][currentArrayIndex];
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
        require(success, TransferFailed(address (this), owner(), amount));

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

    function payout(address payable _to, string calldata _message) external payable onlyRecipient nonReentrant() {
        require(recipientTotalBalance[msg.sender] >= msg.value, NotEnoughFunds(recipientTotalBalance[msg.sender], msg.value));
        _payout(_to, msg.value, recipientDonators[msg.sender], _message);
    }

    function requestReceipt(uint _index) external onlyDonator() {
        require(donationIndexExists[msg.sender][_index], DonationDeleted(msg.sender, _index));
        Donation storage d = _userDonationAtStorage(msg.sender, _index);
        require(!d.receiptRequested, ReceiptAlreadyRequested(msg.sender, _index));

        d.receiptRequested = true;

        emit ReceiptRequested(msg.sender, _index, block.timestamp);
    }

    function mintReceipt(address _donator, uint _index, string calldata _tokenURI) external onlyOwner() {
        require(donationIndexExists[_donator][_index], DonationDeleted(_donator, _index));
        Donation storage d = _userDonationAtStorage(_donator, _index);
        require(d.receiptRequested, ReceiptNotRequested(_donator, _index));
        require(!d.receiptMinted, ReceiptAlreadyMinted(_donator, _index));
        d.receiptMinted = true;
        uint256 tokenId = donationReceipt.mint(_donator, _tokenURI);
        emit ReceiptMinted(msg.sender, _donator, _index, tokenId, block.timestamp);
    }

    function emergencyWithdraw() external onlyOwner() {
        require(address(this).balance > 0, NotEnoughFunds(address(this).balance,address(this).balance));
        uint amout = address(this).balance;
        (bool success,) = payable(owner()).call{value: address(this).balance}("");

        require(success, TransferFailed(address (this), owner(), amout));

        emit EmergencyWithdraw(address(this), owner(), amout, block.timestamp);
    }

    function _userDonationAtStorage(address _donator, uint _index) private view returns (Donation storage) {
        require(donationIndexExists[_donator][_index], DonationDeleted(_donator, _index));

        uint currentArrayIndex = donationIndexToArrayIndex[_donator][_index];
        return donations[_donator][currentArrayIndex];
    }

    function _deposit() private returns (Donation memory){
        require(msg.value > 0, NullDonation(msg.sender));

        // Check donation limit per donator
        require(
            donations[msg.sender].length < MAX_DONATIONS_PER_DONATOR,
            TooManyDonations(msg.sender, donations[msg.sender].length, MAX_DONATIONS_PER_DONATOR)
        );

        // check if donator is a new one
        if (donations[msg.sender].length == 0) {
            totalDonators++;
        }
        uint originalIndex = donations[msg.sender].length;
        Donation memory d = Donation({
            donator: msg.sender,
            amount: msg.value,
            remaining: msg.value,
            timestamp: block.timestamp,
            allocated: false,
            receiptRequested: false,
            receiptMinted: false,
            index: originalIndex // length of 1 is index 0
        });

        donations[msg.sender].push(d);
        donationIndexToArrayIndex[msg.sender][originalIndex] = originalIndex;
        donationIndexExists[msg.sender][originalIndex] = true;

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
                // Check active donators limit for this recipient
                require(
                    recipientDonators[recipientWallet].length < MAX_ACTIVE_DONATORS_PER_RECIPIENT,
                    TooManyActiveDonators(recipientWallet, recipientDonators[recipientWallet].length, MAX_ACTIVE_DONATORS_PER_RECIPIENT)
                );
                recipientDonators[recipientWallet].push(d.donator);
            }
            recipientBalancesByDonator[recipientWallet][d.donator] += recipientAmount;
            recipientTotalBalance[recipientWallet] += recipientAmount;

            (bool success,) = recipientWallet.call{value: recipientAmount}("");

            if(!success) {
                emit AllocationFailed(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp);
            } else {

            emit FundsAllocated(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp);
            }

        }

        // Handle rounding errors (if any)
        if (remainingAmount > 0) {
            totalDonationLeftovers += remainingAmount;
        }

        _userDonationAtStorage(d.donator, d.index).allocated = true;
    }

    function _payout(address payable _to, uint _amount, address[] memory _donators, string calldata _message) onlyRecipient private {
        // since we have no control over the payout address
        // we must make sure it goes through before hand

        (bool success,) = payable(_to).call{value: _amount}("");
        require(success, TransferFailed(msg.sender, _to, _amount));

        // only then we process internal balances
        uint _remaining = _amount;
        recipientTotalBalance[msg.sender] -= _amount;
        totalSpent += _amount;

        for (uint256 i = 0; i < _donators.length; i++) {
            address donator = _donators[i];
            Donation[] storage userDonations = donations[donator];

            for (uint256 j = 0; j < userDonations.length && _remaining > 0 ; j++) {
                Donation memory d = userDonations[j];

                if (!d.allocated || d.remaining == 0) continue;

                uint availableFromDonator = recipientBalancesByDonator[msg.sender][donator];
                uint _toSend = _remaining < d.remaining ? _remaining : d.remaining;

                // do not try to send more than the donator balance fo this receipient
                _toSend = _toSend < availableFromDonator ? _toSend : availableFromDonator;
                d.remaining -= _toSend;
                _remaining -= _toSend;

                // Update the recipient-specific balance tracking
                recipientBalancesByDonator[msg.sender][donator] -= _toSend;
                userDonations[j].remaining = d.remaining;

                if(_toSend > 0) {
                    emit FundsSpent(d.donator, msg.sender, _to, _toSend, block.timestamp);
                    emit SpendingReason(d.donator, block.timestamp, _message);
                }
            }
        }

        if (recipientPayoutCount[msg.sender] % CLEANUP_FREQUENCY == 0) {
            _cleanupSpentDonations();
        }

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
                    uint originalIndex = d.index;
                    uint lastIndex = userDonations.length - 1;
                    if (j != lastIndex) {
                        userDonations[j] = userDonations[lastIndex];
                        // element that was last index is now j
                        uint swappedOriginalIndex = userDonations[j].index;
                        donationIndexToArrayIndex[donator][swappedOriginalIndex] = j;
                    }
                    donationIndexExists[donator][originalIndex] = false;
                    delete donationIndexToArrayIndex[donator][originalIndex];
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