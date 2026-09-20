import AppPageShell from '@/components/layout/AppPageShell';
import { useAuth } from '@/contexts/AuthContext';

import HomeDashboard from './HomeDashboard';
import HomeFooter from './HomeFooter';
import HomeHeader from './HomeHeader';
import HowItWorks from './HowItWorks';
import './Home.css';

const Home = () => {
  const { isLoggedIn, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="home-page home-auth-loading" role="status">
        <img src="/images/logo/logo.png" alt="" />
        <strong>Opening Pokémon Go Nexus…</strong>
      </div>
    );
  }

  if (isLoggedIn && user) {
    return (
      <AppPageShell
        className="home-page home-page--dashboard"
        contentClassName="home-dashboard-shell"
        inset="compact"
        maxWidth="standard"
      >
        <HomeDashboard key={user.user_id} user={user} />
      </AppPageShell>
    );
  }

  return (
    <div className="home-page home-page--guest">
      <HomeHeader
        logoUrl="/images/logo/logo.png"
        lockupUrl="/images/logo/hero-lockup.png"
        isLoggedIn={false}
      />
      <HowItWorks />
      <HomeFooter />
    </div>
  );
};

export default Home;
