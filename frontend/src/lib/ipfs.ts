import pinataSDK, {PinataPinOptions} from '@pinata/sdk';

const pinata = new pinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_API_SECRET!
);

interface ReceiptMetadata {
  donatorAddress: string;
  donationIndex: number;
  donationAmount: string;
  timestamp: number;
}

export async function uploadReceiptToIPFS(
  imageBuffer: Buffer,
  metadata: ReceiptMetadata
): Promise<{ metadataURI: string; imageURI: string }> {
  try {
    const receiptId = `${metadata.donatorAddress.slice(0, 6)}_${metadata.donationIndex}_${Date.now()}`;
    const imageFileName = `FR_${receiptId}.png`;
    const jsonFileName = `FR_${receiptId}.json`;

    // Step 1: Upload image to IPFS
    console.log('📤 Uploading image to IPFS...');

    const imageOptions: PinataPinOptions= {
      pinataMetadata: {
        name: imageFileName,
      },
      pinataOptions: {
        cidVersion:0,
      },
    };

    // Convert buffer to readable stream for Pinata
    const { Readable } = await import('stream');
    const imageStream = Readable.from(imageBuffer);

    const imageResult = await pinata.pinFileToIPFS(imageStream, imageOptions);
    const imageURI = `https://ipfs.io/ipfs/${imageResult.IpfsHash}`;

    console.log(`✅ Image uploaded: ${imageURI}`);

    // Step 2: Create and upload metadata JSON
    console.log('📤 Uploading metadata to IPFS...');

    const metadataBody = {
      name: `Reçu Fiscal #${receiptId}`,
      description: `Reçu fiscal pour un don de ${metadata.donationAmount} ETH`,
      image: imageURI,
      attributes: [
        {
          trait_type: 'Donator Address',
          value: metadata.donatorAddress,
        },
        {
          trait_type: 'Donation Index',
          value: metadata.donationIndex,
        },
        {
          trait_type: 'Amount',
          value: metadata.donationAmount,
        },
        {
          trait_type: 'Timestamp',
          value: metadata.timestamp,
        },
        {
          display_type: 'date',
          trait_type: 'Date',
          value: metadata.timestamp,
        },
      ],
    };

    const jsonOptions: PinataPinOptions = {
      pinataMetadata: {
        name: jsonFileName,
      },
      pinataOptions: {
        cidVersion: 0,
      },
    };

    const jsonResult = await pinata.pinJSONToIPFS(metadataBody, jsonOptions);
    const metadataURI = `https://ipfs.io/ipfs/${jsonResult.IpfsHash}`;

    console.log(`✅ Metadata uploaded: ${metadataURI}`);

    return {
      metadataURI,
      imageURI,
    };
  } catch (error) {
    console.error('❌ Error uploading to IPFS:', error);
    throw new Error('Failed to upload to IPFS');
  }
}
