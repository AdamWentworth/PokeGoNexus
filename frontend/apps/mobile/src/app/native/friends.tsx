import { Redirect, useLocalSearchParams } from 'expo-router';

// Keep existing links and notification tabs, but enter the same retained workspace.
export default function NativeFriendsRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  return <Redirect href={{
    pathname: '/native/profile',
    params: { workspace: 'friends', ...(tab ? { tab } : {}) },
  }} />;
}
