import { FaAndroid, FaArrowRight, FaDownload } from 'react-icons/fa';
import { Link } from 'react-router';

import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import usePublicPageMetadata from '@/pages/Information/usePublicPageMetadata';

import { getAndroidBetaRelease } from './androidBeta';
import '../Information/InformationPage.css';
import './Download.css';

const Download = () => {
  const release = getAndroidBetaRelease();
  const feedbackUrl = new URL('https://github.com/AdamWentworth/PokeGoNexus/issues/new');
  feedbackUrl.searchParams.set('title', `Android beta feedback${release ? ` (${release.version}, build ${release.versionCode})` : ''}`);
  feedbackUrl.searchParams.set('body', 'Phone model and Android version:\n\nApp version / build:\n\nSteps to reproduce:\n\nExpected result:\n\nActual result:\n\n');

  usePublicPageMetadata(
    'Android beta | Pokémon Go Nexus',
    'Try the Pokémon Go Nexus native Android beta, learn how to install updates, and share feedback. The web app remains available.',
  );

  return (
    <AppPageShell className="information-page download-page" contentClassName="information-page__shell" maxWidth="reading">
      <ProductPageHeader
        align="center"
        description="Your collection and trainer tools, in our native Android app. Help us test it while we work toward a full release."
        eyebrow="Optional early access"
        icon={<FaAndroid aria-hidden="true" />}
        title="Try the Android beta"
      />

      <section className="information-section download-release" aria-labelledby="android-release-title">
        <header className="information-section__header">
          <h2 id="android-release-title">{release ? 'Download for Android' : 'The first beta download is being prepared'}</h2>
          <p>
            The beta is still being tested. You can keep using the web app at any time.
            iPhone testing will open later.
          </p>
        </header>
        {release ? (
          <>
            <p className="download-release__version">
              Version {release.version} · Build {release.versionCode} · {(release.sizeBytes / 1024 / 1024).toFixed(0)} MB
              <br />
              Released <time dateTime={release.publishedAt}>{release.publishedAt}</time>
            </p>
            <div className="download-release__actions">
              <a className="information-button information-button--primary" href={release.downloadUrl}>
                <FaDownload aria-hidden="true" /> Download Android APK
              </a>
              <a className="information-button" href={release.releaseNotesUrl}>What changed</a>
            </div>
            <details className="download-release__checksum">
              <summary>Verify your download</summary>
              <p>SHA-256 checksum</p>
              <code>{release.sha256}</code>
            </details>
          </>
        ) : (
          <p>Come back here for the download once the first build has passed our device checks.</p>
        )}
        <Link className="information-button" to="/pokemon">Continue in the web app <FaArrowRight aria-hidden="true" /></Link>
      </section>

      <section className="information-section" aria-labelledby="android-account-title">
        <header className="information-section__header">
          <h2 id="android-account-title">Use your existing Pokémon Go Nexus account</h2>
          <p>
            Sign in with the account you use on this website. The beta connects to the same
            live service: collection edits, tags, profile changes, and trades affect your
            real account and appear on the web too.
          </p>
        </header>
      </section>

      <section className="information-section" aria-labelledby="android-install-title">
        <header className="information-section__header"><h2 id="android-install-title">Install and update</h2></header>
        <ol className="download-steps">
          <li>Open this page on your Android phone and download the APK.</li>
          <li>Open the downloaded file. If Android asks, allow your browser to install apps from this source, then tap Install.</li>
          <li>Open Pokémon Go Nexus and sign in. You can turn off the browser’s installation permission afterward.</li>
        </ol>
        <p>
          For updates, return here and install the newer APK over the existing app.
          Updates are manual during this beta. If Android reports a conflict or refuses
          an update, send us the message before uninstalling, especially if you have
          changes waiting to sync.
        </p>
      </section>

      <section className="information-cta" aria-labelledby="android-feedback-title">
        <div>
          <h2 id="android-feedback-title">Tell us what needs work</h2>
          <p>
            Include your phone model, Android version, app build, and the steps that caused
            the problem. Feedback on GitHub is public and requires a GitHub account;
            leave out private account details.
          </p>
        </div>
        <a className="information-button" href={feedbackUrl.href}>Send beta feedback <FaArrowRight aria-hidden="true" /></a>
      </section>
    </AppPageShell>
  );
};

export default Download;
