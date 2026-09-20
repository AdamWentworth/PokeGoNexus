import manifest from './android-beta.json';

export interface AndroidBetaRelease {
  version: string;
  versionCode: number;
  publishedAt: string;
  downloadUrl: string;
  releaseNotesUrl: string;
  sha256: string;
  sizeBytes: number;
}

// A release is promoted explicitly after its exact APK has been tested.
// Keeping this in the web build makes rollback independent of native builds.
export const getAndroidBetaRelease = (): AndroidBetaRelease | null => {
  const release: AndroidBetaRelease | null = manifest.release;
  if (!release) return null;
  // The manifest pins the GitHub source artifact. CI verifies and copies those
  // exact bytes into the website so a download never navigates away to GitHub.
  return {
    ...release,
    downloadUrl: `/downloads/android/PokeGoNexus-Android-${release.versionCode}.apk`,
  };
};
