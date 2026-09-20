import LegalPage from './LegalPage';

const PrivacyPolicy = () => (
  <LegalPage eyebrow="Legal" title="Privacy Policy" updated="July 28, 2026">
    <section>
      <h2>What Pokémon Go Nexus collects</h2>
      <p>
        We collect the account information you provide, such as your email address,
        username, optional Pokémon GO trainer details, optional location, and the
        Pokémon collection, friendship, search, and trade information you choose to
        store or share through the service.
      </p>
      <p>
        When you use Google, Discord, or Facebook to authenticate, we receive a
        provider account identifier and email address. We do not receive or store
        your password for those providers.
      </p>
    </section>
    <section>
      <h2>How information is used</h2>
      <p>
        Information is used to authenticate your account, provide collection and
        trade features, show the profile and discovery information you elect to
        share, protect the service, diagnose errors, and improve Pokémon Go Nexus.
      </p>
    </section>
    <section>
      <h2>Sharing and service providers</h2>
      <p>
        We do not sell personal information. Information is shared only as needed
        to operate the service, comply with law, prevent abuse, or provide features
        you request. Authentication providers process login information under their
        own privacy policies.
      </p>
    </section>
    <section>
      <h2>Retention, security, and your choices</h2>
      <p>
        Account information is retained while your account is active and for only
        as long afterward as reasonably required for security, backups, or legal
        obligations. You can edit optional profile and privacy settings or delete
        your account and associated application data from Account Security.
      </p>
    </section>
  </LegalPage>
);

export default PrivacyPolicy;
