// src/App.tsx

import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Routes,
  Route,
  useLocation,
} from 'react-router';

import './App.css';

import AppProviders  from './AppProviders';
import AppBootstrap  from './AppBootstrap';
import ActionMenu from './components/ActionMenu';
import AppStatusCenter from './components/status/AppStatusCenter';
import PerfTelemetryPanel from './components/dev/PerfTelemetryPanel';
import ErrorBoundary from './components/ErrorBoundary';
import RouteScrollRestoration from './components/navigation/RouteScrollRestoration';
import { ContextBackProvider } from './contexts/ContextBackContext';
import {
  AppLoadingFallback,
  AppLoadingProvider,
} from './contexts/AppLoadingContext';

const Home = lazy(() => import('./pages/Home/Home'));
const GettingStarted = lazy(() => import('./pages/Home/GettingStarted'));
const Download = lazy(() => import('./pages/Download/Download'));
const Help = lazy(() => import('./pages/Help/Help'));
const FAQ = lazy(() => import('./pages/FAQ/FAQ'));
const About = lazy(() => import('./pages/Information/About'));
const Safety = lazy(() => import('./pages/Information/Safety'));
const NotFound = lazy(() => import('./pages/Information/NotFound'));
const Pokedex = lazy(() => import('./pages/Pokedex/Pokedex'));
const Pokemon = lazy(() => import('./pages/Pokemon/Pokemon'));
const Raid = lazy(() => import('./pages/Raid/Raid'));
const RaidMethodology = lazy(() => import('./pages/Raid/RaidMethodology'));
const Max = lazy(() => import('./pages/Max/Max'));
const Pvp = lazy(() => import('./pages/Pvp/Pvp'));
const PvpMethodology = lazy(() => import('./pages/Pvp/PvpMethodology'));
const Rankings = lazy(() => import('./pages/Rankings/Rankings'));
const Login = lazy(() => import('./pages/Authentication/Login'));
const Register = lazy(() => import('./pages/Authentication/Register'));
const ResetPassword = lazy(() => import('./pages/Authentication/ResetPassword'));
const VerifyEmailChange = lazy(() => import('./pages/Authentication/VerifyEmailChange'));
const Profile = lazy(() => import('./pages/Trainer/Profile'));
const Friends = lazy(() => import('./pages/Trainer/Friends'));
const Settings = lazy(() => import('./pages/Trainer/Settings'));
const AccountSecurity = lazy(() => import('./pages/Trainer/AccountSecurity'));
const Search = lazy(() => import('./pages/Search/Search'));
const Trades = lazy(() => import('./pages/Trades/Trades'));
const PrivacyPolicy = lazy(() => import('./pages/Legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/Legal/TermsOfService'));
const DataDeletion = lazy(() => import('./pages/Legal/DataDeletion'));
const TradeBoardBuilderPage = lazy(() => import('./pages/TradeBoard/TradeBoardBuilderPage'));
const TradeBoardPage = lazy(() => import('./pages/TradeBoard/TradeBoardPage'));

export const AppRouteFallback: React.FC = () => (
  <AppLoadingFallback source="route" />
);

const LEGAL_ROUTES = new Set(['/privacy', '/terms', '/data-deletion']);

const AppContent: React.FC = () => {
  const { pathname } = useLocation();
  const isLegalRoute = LEGAL_ROUTES.has(pathname);
  const isStandalonePublicRoute = pathname.startsWith('/trade-board/');

  return (
    <div className="App">
      <main>
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/download" element={<Download />} />
          <Route path="/help" element={<Help />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<About />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/pokedex"      element={<Pokedex />} />
          <Route path="/pokemon"      element={<Pokemon isOwnCollection />} />
          <Route path="/raid"         element={<Raid />} />
          <Route path="/raid/methodology" element={<RaidMethodology />} />
          <Route path="/max"          element={<Max />} />
          <Route path="/pvp"          element={<Pvp />} />
          <Route path="/pvp/methodology" element={<PvpMethodology />} />
          <Route path="/rankings"     element={<Rankings />} />
          <Route path="/trades"       element={<Trades />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/register"     element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email-change" element={<VerifyEmailChange />} />
          <Route path="/profile"      element={<Profile />} />
          <Route path="/profile/friends" element={<Friends />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route
            path="/friends"
            element={<Navigate to="/profile/friends" replace />}
          />
          <Route path="/settings"     element={<Settings />} />
          <Route path="/settings/account" element={<AccountSecurity />} />
          <Route path="/account"      element={<Navigate to="/settings/account" replace />} />
          <Route path="/search"       element={<Search />} />
          <Route path="/pokemon/:username" element={<Pokemon isOwnCollection={false} />} />
          <Route path="/trade-board" element={<TradeBoardBuilderPage />} />
          <Route path="/trade-board/:username" element={<TradeBoardPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {!isLegalRoute && !isStandalonePublicRoute && <ActionMenu />}
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <ContextBackProvider>
      <RouteScrollRestoration />
      <AppLoadingProvider>
        <AppProviders>
          <AppBootstrap />
          <ErrorBoundary>
            <AppContent />
            <AppStatusCenter />
          </ErrorBoundary>
          <PerfTelemetryPanel />
        </AppProviders>
      </AppLoadingProvider>
    </ContextBackProvider>
  </Router>
);

export default App;
