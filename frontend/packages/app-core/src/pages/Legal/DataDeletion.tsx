import { Link } from 'react-router';

import LegalPage from './LegalPage';

const DataDeletion = () => (
  <LegalPage eyebrow="Account help" title="User Data Deletion" updated="July 28, 2026">
    <section>
      <h2>Delete your account in Pokémon Go Nexus</h2>
      <ol>
        <li>Sign in to the Pokémon Go Nexus account you want to delete.</li>
        <li>Open <Link to="/settings/account">Settings → Account Security</Link>.</li>
        <li>Select <strong>Delete account</strong> and confirm the request.</li>
      </ol>
      <p>
        This removes the sign-in account and initiates deletion of associated
        Pokémon Go Nexus application data. Some limited records may remain temporarily
        in encrypted backups or where retention is required for security or law.
      </p>
    </section>
    <section>
      <h2>If you cannot sign in</h2>
      <p>
        Password-based accounts can use the password-reset option on the login
        screen. For Google, Discord, or Facebook accounts, sign in with the same
        provider and email address originally connected to Pokémon Go Nexus, then use
        the account-deletion steps above.
      </p>
    </section>
    <section>
      <h2>Remove Facebook access</h2>
      <p>
        Removing Pokémon Go Nexus from Facebook&apos;s Apps and Websites settings stops
        future Facebook access. To delete information already stored by
        Pokémon Go Nexus, also complete one of the deletion methods above.
      </p>
    </section>
  </LegalPage>
);

export default DataDeletion;
