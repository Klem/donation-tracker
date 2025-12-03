'use client';
import '@rainbow-me/rainbowkit/styles.css';

import {getDefaultConfig, RainbowKitProvider, darkTheme} from '@rainbow-me/rainbowkit';
import {createConfig, injected, WagmiProvider} from 'wagmi';
import {sepolia} from 'wagmi/chains';
import {QueryClientProvider, QueryClient,} from "@tanstack/react-query";
import {http} from "viem";
import {localHardhat} from "@/utils/myLocalHardhat";

export const config = createConfig({
    chains: [sepolia],
    connectors: [injected({ target: 'metaMask' })],
    transports: { [sepolia.id]: http() },
    ssr: true
});

// export const config = createConfig({
//     chains: [localHardhat],
//     connectors: [injected({ target: 'metaMask' })],
//     transports: { [localHardhat.id]: http() },
//     ssr: true
// });



const queryClient = new QueryClient();

const RainbowKitAndWagmiProvider = ({children}: { children: React.ReactNode }) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#7b3fe4',
                        accentColorForeground: 'white',
                        borderRadius: 'small',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default RainbowKitAndWagmiProvider;