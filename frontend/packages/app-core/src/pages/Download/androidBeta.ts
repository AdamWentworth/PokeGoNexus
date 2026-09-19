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
export const getAndroidBetaRelease = (): AndroidBetaRelease | null => manifest.release;
