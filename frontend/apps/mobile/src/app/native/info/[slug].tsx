import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useNativeSession } from '../../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../../config/runtimeConfig';
import {
  isNativeInformationSlug,
  NATIVE_INFORMATION_PAGES,
} from '../../../features/information/nativeInformationContent';
import { resolveNativeActionMenuDestination } from '../../../navigation/nativeActionMenuNavigation';
import { NativeInformationScreen } from '../../../screens/NativeInformationScreen';

const LEGAL_INFORMATION_SLUGS = new Set(['privacy', 'terms', 'data-deletion']);

export const nativeInformationShowsActionMenu = (slug: string): boolean => (
  !LEGAL_INFORMATION_SLUGS.has(slug)
);

export const resolveNativeInformationContextLink = (path: string): {
  pathname: '/native/collection' | '/native/trades';
  params?: Record<string, string>;
} | null => {
  const [pathname = '/', query = ''] = path.split('?');
  const searchParams = new URLSearchParams(query);
  if (pathname === '/pokemon') {
    const params = Object.fromEntries(
      ['filter', 'search', 'tag']
        .map((key) => [key, searchParams.get(key)?.trim() ?? ''] as const)
        .filter(([, value]) => Boolean(value)),
    );
    return {
      pathname: '/native/collection',
      ...(Object.keys(params).length ? { params } : {}),
    };
  }
  if (pathname === '/trades') {
    const params = Object.fromEntries(
      ['section', 'mode', 'instance']
        .map((key) => [key, searchParams.get(key)?.trim() ?? ''] as const)
        .filter(([, value]) => Boolean(value)),
    );
    return {
      pathname: '/native/trades',
      ...(Object.keys(params).length ? { params } : {}),
    };
  }
  return null;
};

export default function NativeInformationRoute() {
  const router = useRouter();
  const session = useNativeSession();
  const params = useLocalSearchParams<{
    question?: string | string[];
    slug?: string | string[];
  }>();
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const question = Array.isArray(params.question) ? params.question[0] : params.question;
  if (!slug || !isNativeInformationSlug(slug)) return <Redirect href="/native" />;
  const page = NATIVE_INFORMATION_PAGES[slug];
  const showsActionMenu = nativeInformationShowsActionMenu(slug);

  const navigate = (path: string) => {
    setActionMenuOpen(false);
    const [pathAndQuery = '/', answerId = ''] = path.split('#');
    const [pathname = '/'] = pathAndQuery.split('?');
    const contextualDestination = resolveNativeInformationContextLink(path);
    if (contextualDestination) {
      router.push(contextualDestination.params
        ? {
            pathname: contextualDestination.pathname,
            params: contextualDestination.params,
          }
        : contextualDestination.pathname);
      return;
    }
    if (pathname === '/') {
      router.push('/native');
      return;
    }
    if (isNativeInformationSlug(pathname.slice(1))) {
      router.push({
        pathname: '/native/info/[slug]',
        params: {
          slug: pathname.slice(1),
          ...(pathname === '/faq' && answerId ? { question: answerId } : {}),
        },
      });
      return;
    }
    if (pathname === '/login') {
      router.push('/native/login');
      return;
    }
    if (pathname === '/register') {
      router.push('/native/register');
      return;
    }
    if (pathname === '/settings/account') {
      router.push('/native/account');
      return;
    }
    const destination = resolveNativeActionMenuDestination(pathname);
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    if (destination.kind === 'current') return;
    router.push({ pathname: '/web', params: { path } });
  };

  return (
    <>
      <NativeInformationScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        initialFaqId={question}
        isLoggedIn={Boolean(session.user)}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native')}
        onNavigate={navigate}
        page={page}
      />
      {showsActionMenu ? (
        <NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={() => setActionMenuOpen(true)} />
      ) : null}
      {showsActionMenu && actionMenuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={navigate}
          visible
        />
      ) : null}
    </>
  );
}
