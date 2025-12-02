// DonationReceiptNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// OpenZeppelin Imports for ERC-721 implementation
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol"; // Provides _setTokenURI
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DonationReceip
 * @dev An ERC-721 token contract used to issue legal receipts for donations.
 * It uses ERC721URIStorage to manage metadata URIs for each token.
 * Minting is restricted to the contract owner (which will be the DonationTracker contract).
 */
contract DonationReceipt is ERC721URIStorage, Ownable {
    uint private _tokenIdCounter;

    /**
     * @notice Constructor sets the token name, symbol, and the initial owner.
     * @param initialOwner The address of the entity authorized to mint tokens.
     * This will be the address of the deployed DonationTracker contract after deployment.
     */
    constructor(address initialOwner)
    ERC721("Donation Receipt NFT", "DRNFT")
    Ownable(initialOwner)
    {}

    /**
     * @notice Mints a new NFT and assigns it to the donator.
     * @dev Restricted to be called only by the owner (the DonationTracker contract).
     * @param to The address of the donator (the recipient of the NFT).
     * @param tokenURI The IPFS URI pointing to the NFT metadata JSON (e.g., ipfs://Qm.../1.json).
     * @return newTokenId The ID of the newly minted token.
     */
    function mint(address to, string memory tokenURI) external onlyOwner returns (uint256) {
        // Ensure the recipient address is valid
        require(to != address(0), "ERC721: mint to the zero address");


        uint256 newTokenId = ++_tokenIdCounter;

        _safeMint(to, newTokenId);

        _setTokenURI(newTokenId, tokenURI);

        return newTokenId;
    }

}