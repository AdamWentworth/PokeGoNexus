import type { FC, ReactNode } from 'react';
import { Link } from 'react-router';

import './LegalPage.css';

type LegalPageProps = {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
};

const LegalPage: FC<LegalPageProps> = ({ eyebrow, title, updated, children }) => (
  <main className="legal-page">
    <article className="legal-document">
      <header>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>Last updated: {updated}</p>
      </header>
      <div className="legal-document__content">{children}</div>
      <footer>
        <Link to="/help">Help &amp; information</Link>
        <Link to="/">Return to Pokémon Go Nexus</Link>
      </footer>
    </article>
  </main>
);

export default LegalPage;
