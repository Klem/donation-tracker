import "dotenv/config";
import pinataSDK from '@pinata/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const key = process.env.PINATA_API_KEY;
const secret = process.env.PINATA_API_SECRET;

// --- Add an explicit check and logging to confirm loading ---
if (!key || !secret) {
    console.error("❌ FATAL: PINATA_KEY or PINATA_SECRET is still missing after dotenv/config ran.");
    process.exit(1);
} else {
    console.log("✅ Credentials loaded (Length check passed). Starting Pinata client.");
}
// -----------------------------------------------------------



const receiptId = Date.now(); // Generates a unique number (e.g., 1700832000000)
const imageFileName = `FR_${receiptId}.jpeg`; // e.g., FR_1700832000000.jpeg
const jsonFileName = `FR_${receiptId}.json`;   // e.g., FR_1700832000000.json

const pinata = new pinataSDK(key, secret);
// Ensure 'receipt.pdf' exists in the backend directory
const receiptPath = path.resolve(__dirname, 'receipt.jpeg');
const readableStreamForFile = fs.createReadStream(receiptPath);

const options = {
    pinataMetadata: {
        name: imageFileName,
    },
    pinataOptions: {
        cidVersion: 0
    }
};

pinata.pinFileToIPFS(readableStreamForFile, options).then((result) => {
    console.log("Pinata Image Pin Result:");
    console.log(result);

    // The JSON body contains the link to the image
    const body = {
        description: "Fiscal Receipt NFT",
        // The image value must be the IPFS gateway URL or ipfs:// hash
        image: `https://ipfs.io/ipfs/${result.IpfsHash}`,
        // 3. The 'name' field in the JSON metadata is typically the name of the NFT,
        // which can also be dynamic/unique.
        name: `Donation Receipt #${receiptId}`,
    };

    // Update options for pinning the JSON file
    const jsonOptions = {
        pinataMetadata: {
            // 4. Used the dynamic variable for the JSON Pin name
            name: jsonFileName,
        },
        pinataOptions: {
            cidVersion: 0
        }
    };

    pinata.pinJSONToIPFS(body, jsonOptions).then((json) => {
        console.log("Pinata JSON Pin Result (Metadata URI):");
        console.log(`https://ipfs.io/ipfs/${json.IpfsHash}`); // This is the URI you use to mint the NFT
        console.log(json);
    }).catch((err) => {
        console.log("Error pinning JSON to IPFS:", err);
    });


}).catch((err) => {
    console.log("Error pinning File to IPFS:", err);
});