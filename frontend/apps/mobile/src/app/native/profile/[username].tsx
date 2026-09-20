import { useLocalSearchParams } from 'expo-router';
import { NativeTrainerProfileRoute } from '../../../features/social/NativeTrainerProfileRoute';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeForeignTrainerProfileRoute() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  return <NativeTrainerProfileRoute username={firstParam(params.username)} />;
}
