import { FaArrowLeft, FaCompass, FaHome, FaQuestionCircle } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';

import './InformationPage.css';
import usePublicPageMetadata from './usePublicPageMetadata';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  usePublicPageMetadata(
    'Page Not Found | Pokémon Go Nexus',
    'The requested Pokémon Go Nexus page could not be found. Return home or open the help directory.',
  );

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <AppPageShell
      className="information-page not-found-page"
      contentClassName="not-found-page__shell"
      maxWidth="reading"
    >
      <section className="not-found-card" aria-labelledby="not-found-title">
        <img
          alt="Pokémon Go Nexus"
          className="not-found-card__logo"
          onContextMenu={(event) => event.preventDefault()}
          src="/images/logo/lockup.png"
        />
        <span className="not-found-card__code">404</span>
        <h1 id="not-found-title">That route wandered off.</h1>
        <p>
          No Pokémon Go Nexus page matches
          {' '}<code>{location.pathname}</code>.
          {' '}The link may be outdated, incomplete, or mistyped.
        </p>
        <div className="not-found-card__actions">
          <Link className="information-button information-button--primary" to="/">
            <FaHome aria-hidden="true" /> Return home
          </Link>
          <button className="information-button" onClick={goBack} type="button">
            <FaArrowLeft aria-hidden="true" /> Go back
          </button>
        </div>
        <nav className="not-found-card__links" aria-label="Useful destinations">
          <Link to="/getting-started"><FaCompass aria-hidden="true" /> Getting Started</Link>
          <Link to="/faq"><FaQuestionCircle aria-hidden="true" /> Frequently asked questions</Link>
          <Link to="/help"><FaQuestionCircle aria-hidden="true" /> Help &amp; information</Link>
        </nav>
      </section>
    </AppPageShell>
  );
};

export default NotFound;
