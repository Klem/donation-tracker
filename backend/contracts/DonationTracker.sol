// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DonationTracker is Ownable, ReentrancyGuard {
    mapping(address => Donation[]) private donations;
    mapping(address => uint) private totalUserDonations;
    mapping(address => uint) private totalUnspentUserDonations;
    mapping(address => mapping(address => uint)) private recipientBalancesByDonator;
    mapping(address => address[]) private recipientDonators;

    uint public totalDonated;
    uint public totalAllocated;
    uint public totalDonators;
    uint public totalDonationLeftovers; // from possible rounding issues

    uint private constant PERCENTAGE_BASE = 10000; // 100% is 10000 units

    struct Donation {
        address donator;
        uint amount;
        uint timestamp;
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
        address payable wallet; // Use 'payable' for direct transfers
        uint percentage; // In units of PERCENTAGE_BASE
    }

    Recipient[] private ALLOCATION_RECIPIENTS;

    event DonationReceived(address indexed donator, uint amount, uint indexed timestamp, uint index);
    event FundsAllocated (address indexed donator, address indexed from, address indexed to, uint amount, uint timestamp);

    error NotEnoughFunds(uint256 available, uint256 requested);
    error AllocationFailed (address donator, address from, address to, uint amount, uint timestamp);
    error InvalidIndex(uint index);
    error NotRecipient(address addr);
    error UseDonateFunction();

    modifier onlyRecipient() {
        bool isRecipient = false;
        for (uint i = 0; i < ALLOCATION_RECIPIENTS.length; i++) {
            if (ALLOCATION_RECIPIENTS[i].wallet == msg.sender) {
                isRecipient = true;
                break;
            }
        }
        require(isRecipient, NotRecipient(msg.sender));
        _;
    }

    constructor() Ownable(msg.sender) {
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
        require(totalDonationLeftovers > 0, NotEnoughFunds(totalDonationLeftovers, totalDonationLeftovers));

        (bool success,) = owner().call{value: totalDonationLeftovers}("");
        require(success, "Transfer failed");
    }

    function getRecipientBalanceForDonator(address _recipient, address _donator) external view returns (uint) {
        return recipientBalancesByDonator[_recipient][_donator];
    }

    function getRecipientDonators(address _recipient) external view returns (address[] memory) {
        return recipientDonators[_recipient];
    }

    function getRecipientTotalBalance(address _recipient) external view returns (uint) {
        uint total = 0;
        address[] memory donatorsList = recipientDonators[_recipient];
        for (uint i = 0; i < donatorsList.length; i++) {
            total += recipientBalancesByDonator[_recipient][donatorsList[i]];
        }
        return total;
    }

    function donate() external payable returns (Donation memory)  {
        return _deposit();
    }

    /**
     * @dev use the DonationReceived event to rebuild the donation Struct
     * and provide it as parameter
     */
    function allocate(Donation memory d) external onlyOwner ()  {
         _deposit();
    }

    function _deposit() private returns (Donation memory){
        require(msg.value > 0, "NullDonation");
        // check if donator is a new one
        if (donations[msg.sender].length == 0) {
            totalDonators++;
        }

        Donation memory d = Donation({
            donator: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
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

            remainingAmount -= recipientAmount;
            totalUnspentUserDonations[d.donator] -= recipientAmount;
            totalAllocated += recipientAmount;

            // Save amout donated by this donor to this reicipient
            if (recipientBalancesByDonator[recipientWallet][d.donator] == 0) {
                recipientDonators[recipientWallet].push(d.donator);
            }
            recipientBalancesByDonator[recipientWallet][d.donator] += recipientAmount;

            (bool success,) = recipientWallet.call{value: recipientAmount}("");
            require(success, AllocationFailed(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp));


            emit FundsAllocated(d.donator, address(this), recipientWallet, recipientAmount, block.timestamp);
        }

        // Handle rounding errors (if any)
        if (remainingAmount > 0) {
            totalDonationLeftovers += remainingAmount;
        }
    }

    receive() external payable {
        revert("UseDonateFunction");
    }

    fallback() external payable {
        revert("UseDonateFunction");
    }

}