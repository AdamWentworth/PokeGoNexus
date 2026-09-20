import { WebReplicaApp } from './screens/WebReplicaApp';

// The root route is used only by the production-safe WebView profile. Native
// preview builds are redirected by Expo Router before this component mounts.
export const MobileAppRoot = () => <WebReplicaApp />;
