import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';

// Global styles first, so component styles (design + shell) load after them.
import './styles/tensile.css';
import './styles/app.css';
import App from './App';
import { api, API_URL } from './lib/api';
import type { ChainsOut } from './lib/types';
import { makeWagmiConfig } from './lib/web3';
import { SessionProvider } from './state/session';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 15_000 } },
});

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  let chains: ChainsOut;
  try {
    chains = await api<ChainsOut>('/chains'); // chains + contract addresses come from the backend
  } catch {
    root.render(
      <div className="t-content" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <h1 className="t-h1">Tensile is unreachable</h1>
        <p className="t-lead">Could not load the network list from {API_URL}. Check that the API is running, then reload.</p>
      </div>,
    );
    return;
  }

  root.render(
    <StrictMode>
      <WagmiProvider config={makeWagmiConfig(chains.chains)}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider config={chains}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SessionProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>,
  );
}

boot();