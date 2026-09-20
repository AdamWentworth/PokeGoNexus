import { Redirect } from 'expo-router';
import { runtimeConfig } from '../../config/runtimeConfig';

export default function CollectionParityRoute() {
  if (runtimeConfig.mobile.experienceMode !== 'native-preview') {
    return <Redirect href="/" />;
  }
  return <Redirect href="/native/collection" />;
}
