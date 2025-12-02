import { NextRequest, NextResponse } from 'next/server';
import { uploadReceiptToIPFS } from '@/lib/ipfs';
import { generateReceiptImage } from '@/lib/receiptGenerator';
import { mintReceipt } from '@/lib/blockchain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { donatorAddress, donationIndex, donationAmount, timestamp } = body;

    // Validate input
    if (!donatorAddress || donationIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: donatorAddress, donationIndex' },
        { status: 400 }
      );
    }

    console.log(`📝 Generating receipt for donator: ${donatorAddress}, donation #${donationIndex}`);

    // Step 1: Generate receipt image
    const imageBuffer = await generateReceiptImage({
      donatorAddress,
      donationAmount,
      timestamp,
      receiptId: `${donatorAddress.slice(0, 6)}_${donationIndex}_${Date.now()}`,
    });

    // Step 2: Upload image and metadata to IPFS
    const { metadataURI, imageURI } = await uploadReceiptToIPFS(
      imageBuffer,
      {
        donatorAddress,
        donationIndex,
        donationAmount,
        timestamp,
      }
    );

    console.log(`✅ Uploaded to IPFS - Metadata: ${metadataURI}`);

    // Step 3: Mint the NFT receipt
    const { txHash, tokenId } = await mintReceipt(donatorAddress, donationIndex, metadataURI);

    console.log(`✅ Receipt minted! Transaction: ${txHash}, Token ID: ${tokenId}`);

    return NextResponse.json({
      success: true,
      metadataURI,
      imageURI,
      transactionHash: txHash,
      tokenId,
    });
  } catch (error: any) {
    console.error('❌ Error generating receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
