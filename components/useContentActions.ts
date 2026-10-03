import { useRef } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { contentActionTarget, contentMapTarget, createContentActionRunner, safeExternalUrl } from './contentActions';

export function useContentActions() {
  const router = useRouter();
  const runner = useRef(createContentActionRunner());
  const run = async (action: () => unknown | Promise<unknown>) => {
    try { await runner.current(action); }
    catch { Alert.alert('No pudimos abrir esta acción', 'Inténtalo de nuevo. El contenido sigue disponible aquí.'); }
  };
  return {
    open: (href?: string | null) => run(async () => {
      const url = safeExternalUrl(href);
      if (!url) throw new Error('Invalid link');
      await Linking.openURL(url);
    }),
    navigate: (href: string) => run(async () => {
      const target = contentActionTarget(href);
      if (target) router.push(target);
      else {
        const url = safeExternalUrl(href);
        if (!url) throw new Error('Invalid link');
        await Linking.openURL(url);
      }
    }),
    map: (item: Parameters<typeof contentMapTarget>[0]) => run(() => router.push(contentMapTarget(item))),
    share: (item: { title: string; description?: string; location?: string | null; sourceUrl?: string | null }) => run(() => {
      const url = safeExternalUrl(item.sourceUrl);
      return Share.share({ title: item.title, message: [item.title, item.location, item.description, url].filter(Boolean).join('\n\n'), ...(url ? { url } : {}) });
    }),
  };
}
