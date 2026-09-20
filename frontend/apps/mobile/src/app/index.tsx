import { Redirect } from 'expo-router';
import { MobileAppRoot } from '../MobileAppRoot';
import { NATIVE_PREVIEW_ENTRY_PATH } from '../config/mobileExperience';
import { runtimeConfig } from '../config/runtimeConfig';

export default function IndexRoute() {
  if (runtimeConfig.mobile.experienceMode === 'native-preview') {
    return <Redirect href={NATIVE_PREVIEW_ENTRY_PATH} />;
  }
  return <MobileAppRoot />;
}
