import { ethers } from 'ethers';


const DONATION_TRACKER_ABI = [
  'function mintReceipt(address _donator, uint _index, string calldata _tokenURI) external',
  'event ReceiptMinted(address indexed minter, address indexed donator, uint index, uint tokenId, uint timestamp)',
];

export async function mintReceipt(
  donatorAddress: string,
  donationIndex: number,
  metadataURI: string
): Promise<{ txHash: string; tokenId: number }> {
  try {
    // Get environment variables
    const rpcUrl = process.env.RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS
    const privateKey = process.env.OWNER_PRIVATE_KEY;

    if (!rpcUrl || !contractAddress || !privateKey) {
      throw new Error('Missing environment variables: RPC_URL, CONTRACT_ADDRESS, or OWNER_PRIVATE_KEY');
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Connect to contract
    const contract = new ethers.Contract(contractAddress, DONATION_TRACKER_ABI, wallet);

    console.log(`🔗 Minting receipt for ${donatorAddress}, donation #${donationIndex}`);
    console.log(`📝 Metadata URI: ${metadataURI}`);

    // Call mintReceipt
    const tx = await contract.mintReceipt(donatorAddress, donationIndex, metadataURI);

    console.log(`⏳ Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    console.log(`✅ Receipt minted! Block: ${receipt.blockNumber}`);

    // Extract token ID from the ReceiptMinted event
    const receiptMintedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'ReceiptMinted';
      } catch {
        return false;
      }
    });

    let tokenId = 0;
    if (receiptMintedEvent) {
      const parsed = contract.interface.parseLog(receiptMintedEvent);
      tokenId = Number(parsed?.args?.tokenId || 0);
      console.log(`🎫 NFT Token ID: ${tokenId}`);
    }

    return {
      txHash: tx.hash,
      tokenId,
    };
  } catch (error: any) {
    console.error('❌ Error minting receipt:', error);
    throw new Error(`Failed to mint receipt: ${error.message}`);
  }
}
