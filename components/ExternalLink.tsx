import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { createContentActionRunner, safeExternalUrl } from './contentActions';

export function ExternalLink(
  props: Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string }
) {
  const run = useRef(createContentActionRunner());
  return (
    <Link
      target="_blank"
      {...props}
      href={props.href}
      onPress={(e) => {
        props.onPress?.(e);
        if (e.defaultPrevented) return;
        const url = safeExternalUrl(props.href);
        if (!url) { e.preventDefault(); return; }
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          e.preventDefault();
          // Open the link in an in-app browser.
          void run.current(() => WebBrowser.openBrowserAsync(url)).catch(() =>
            Alert.alert('No pudimos abrir el enlace', 'Inténtalo de nuevo.'));
        }
      }}
    />
  );
}
