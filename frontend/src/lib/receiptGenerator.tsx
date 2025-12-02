import { ImageResponse } from '@vercel/og';

interface ReceiptData {
  donatorAddress: string;
  donationAmount: string;
  timestamp: number;
  receiptId: string;
}

export async function generateReceiptImage(data: ReceiptData): Promise<Buffer> {
  const date = new Date(data.timestamp * 1000);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '800px',
          height: '1000px',
          backgroundColor: 'white',
          position: 'relative',
        }}
      >
        {/* Main Border */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '760px',
            height: '960px',
            margin: '20px',
            border: '4px solid #2563eb',
            padding: '20px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1e40af',
              height: '120px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '36px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              REÇU FISCAL
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                color: 'white',
                marginTop: '8px',
              }}
            >
              Donation Tracker
            </div>
          </div>

          {/* Receipt ID and Date */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '20px',
              fontSize: '16px',
              color: '#374151',
            }}
          >
            <div style={{ display: 'flex' }}>Reçu N° {data.receiptId}</div>
            <div style={{ display: 'flex' }}>Date: {formattedDate}</div>
          </div>

          {/* Donation Details Section */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '10px',
              }}
            >
              Détails du Don
            </div>
            <div
              style={{
                width: '100%',
                height: '2px',
                backgroundColor: '#d1d5db',
                marginBottom: '30px',
              }}
            />

            {/* Donator Address */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '18px',
                  color: '#4b5563',
                  marginBottom: '8px',
                }}
              >
                Donateur:
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '16px',
                  color: '#374151',
                  fontFamily: 'monospace',
                }}
              >
                {data.donatorAddress}
              </div>
            </div>

            {/* Amount */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '30px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: '12px',
                }}
              >
                Montant du don:
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '42px',
                  fontWeight: 'bold',
                  color: '#059669',
                }}
              >
                {data.donationAmount} ETH
              </div>
            </div>
          </div>

          {/* Attestation Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#eff6ff',
              border: '2px solid #3b82f6',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#1e40af',
                marginBottom: '16px',
              }}
            >
              Attestation
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.8',
              }}
            >
              <div style={{ display: 'flex' }}>Ce reçu atteste de votre don effectué via la</div>
              <div style={{ display: 'flex' }}>blockchain Ethereum. Cette transaction est</div>
              <div style={{ display: 'flex' }}>vérifiable et immuable.</div>
            </div>
          </div>

          {/* NFT Badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#7c3aed',
              padding: '20px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              🎫 Reçu NFT Certifié
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '14px',
                color: 'white',
                marginTop: '4px',
              }}
            >
              Stocké de manière permanente sur IPFS
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: '14px',
              color: '#9ca3af',
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex' }}>Ce document est un NFT unique et infalsifiable</div>
            <div style={{ display: 'flex', marginTop: '4px' }}>Généré automatiquement par Donation Tracker</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 1000,
    }
  );

  // Convert Response to Buffer
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
