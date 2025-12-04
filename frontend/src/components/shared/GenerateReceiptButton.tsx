'use client';

import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ethers } from 'ethers';
import {CONTRACT_ABI, CONTRACT_ADDRESS, NFT_ADDRESS} from "@/utils/constants";

// DonationReceipt NFT contract address (for MetaMask import)


interface GenerateReceiptButtonProps {
  donation: {
    donator: string;
    amount: bigint;
    timestamp: bigint;
    receiptRequested: boolean;
    receiptMinted: boolean;
    index: bigint;
  };
}

export function GenerateReceiptButton({
  donation
}: GenerateReceiptButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptURL, setReceiptURL] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleGenerateReceipt = async () => {
    try {
      setError(null);
      setIsGenerating(true);

      // Step 1: Request receipt on blockchain (if not already requested)
      if (!donation.receiptRequested) {
        console.log('📝 Requesting receipt on blockchain...');

        writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'requestReceipt',
          args: [donation.index],
        });

        // Wait for the transaction to be confirmed
        // The useEffect below will handle the next step
      } else {
        // Receipt already requested, proceed to generation
        await generateAndMint();
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Failed to generate receipt');
      setIsGenerating(false);
    }
  };

  // When requestReceipt transaction is confirmed, proceed to generation
  React.useEffect(() => {
    if (isConfirmed && isGenerating) {
      generateAndMint();
    }
  }, [isConfirmed, isGenerating]);

  const generateAndMint = async () => {
    try {
      console.log('🎨 Generating receipt image and uploading to IPFS...');

      const response = await fetch('/api/generate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          donatorAddress: donation.donator,
          donationIndex: Number(donation.index),
          donationAmount: ethers.formatEther(donation.amount),
          timestamp: Number(donation.timestamp),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate receipt');
      }

      console.log('✅ Receipt generated!', data);

      setReceiptURL(data.imageURI);
      setTokenId(data.tokenId);
      alert(`Reçu fiscal généré avec succès! 🎉\nNFT Token ID: ${data.tokenId}`);
    } catch (err: any) {
      console.error('Error generating receipt:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Button disabled states
  const isDisabled = isGenerating || isConfirming || donation.receiptMinted;

  // Button text
  let buttonText = 'Générer reçu fiscal';
  if (isConfirming) buttonText = 'Confirmation...';
  if (isGenerating) buttonText = 'Génération en cours...';
  if (donation.receiptMinted) buttonText = '✅ Reçu généré';

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleGenerateReceipt}
        disabled={isDisabled}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {buttonText}
      </button>

      {error && (
        <div className="text-red-600 text-sm">
          ❌ Erreur: {error}
        </div>
      )}

      {receiptURL && (
        <a
          href={receiptURL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          📄 Voir le reçu sur IPFS →
        </a>
      )}

      {donation.receiptMinted && (
        <div className="text-green-600 text-sm">
          ✅ Reçu fiscal NFT disponible
        </div>
      )}

      {tokenId && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-semibold text-green-800 mb-2">
            🎫 NFT Token ID: {tokenId}
          </div>
          <div className="text-xs text-green-700 mb-2">
            Contract: {NFT_ADDRESS.slice(0, 6)}...{NFT_ADDRESS.slice(-4)}
          </div>
          <div className="text-xs text-green-600">
            Pour importer dans MetaMask:
            <br />
            1. Ouvrir MetaMask → NFTs
            <br />
            2. "Import NFTs"
            <br />
            3. Address: {NFT_ADDRESS}
            <br />
            4. Token ID: {tokenId}
          </div>
        </div>
      )}
    </div>
  );
}
