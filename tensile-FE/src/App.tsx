import { useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import Borrow from './design/Borrow';
import Dispute from './design/Dispute';
import Film from './design/Film';
import Inspector from './design/Inspector';
import Landing from './design/Landing';
import Lend from './design/Lend';
import Liquidation from './design/Liquidation';
import LotPassport, { LotsIndex } from './design/LotPassport';
import Marketplace from './design/Marketplace';
import Onboarding, { OnboardingReview } from './design/Onboarding';
import Operations from './design/Operations';
import Overview from './design/Overview';
import Portfolio from './design/Portfolio';
import Purchase from './design/Purchase';
import Redemption from './design/Redemption';
import ReserveHealth from './design/ReserveHealth';
import RFQ from './design/RFQ';
import States from './design/States';
import Tokenize from './design/Tokenize';
import { Toast } from './shell/TopBar';

// Paths match ROUTES in tools/dc2react.mjs, so links inside the designs land here.
const ROUTES: [string, ComponentType][] = [
  ['/', Landing],
  ['/overview', Overview],
  ['/onboarding', Onboarding],
  ['/onboarding/review/:address', OnboardingReview],
  ['/tokenize', Tokenize],
  ['/lots', LotsIndex],
  ['/lots/:tokenId', LotPassport],
  ['/borrow', Borrow],
  ['/lend', Lend],
  ['/marketplace', Marketplace],
  ['/marketplace/buy', Purchase],
  ['/marketplace/rfq', RFQ],
  ['/portfolio', Portfolio],
  ['/redemptions', Redemption],
  ['/disputes', Dispute],
  ['/reserve', ReserveHealth],
  ['/risk', Liquidation],
  ['/console', Operations],
  ['/inspections', Inspector],
  ['/states', States],
  ['/film', Film],
];

/** The designs use plain <a href="/...">; route those clicks through the router instead of reloading. */
function useInAppLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      const href = a?.getAttribute('href');
      if (!a || a.target || !href) return;
      if (a.getAttribute('aria-disabled') === 'true') return e.preventDefault();
      if (!href.startsWith('/') || href.startsWith('//')) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  useInAppLinks();
  return (
    <>
      <ScrollToTop />
      <Routes>
        {ROUTES.map(([path, Screen]) => (
          <Route key={path} path={path} element={<Screen />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
