export type FeedMetadata = {
  source?: string;
  fetchedAt?: string;
  generatedAt?: string;
  stale?: boolean;
  warning?: string | null;
  clientCache?: { source: 'network' | 'local-cache'; cachedAt: string; ageMs: number; networkError?: string | boolean };
  metadata?: { fetchedAt?: string | null; lastSuccessAt?: string | null; stale?: boolean; complete?: boolean; pagesFetched?: number; pagesDiscovered?: number };
};

export function describeFeedState(metadata: FeedMetadata | undefined, updatedAt: number, isError: boolean, now = Date.now()) {
  const cached = metadata?.clientCache?.source === 'local-cache';
  const sourceTime = metadata?.metadata?.lastSuccessAt || metadata?.metadata?.fetchedAt || metadata?.fetchedAt;
  const stamp = sourceTime || metadata?.clientCache?.cachedAt;
  const receivedAt = stamp ? Date.parse(stamp) : updatedAt;
  const minutes = Number.isFinite(receivedAt) && receivedAt > 0 ? Math.max(0, Math.floor((now - receivedAt) / 60000)) : null;
  const partial = metadata?.metadata?.complete === false;
  const stale = Boolean(metadata?.stale || metadata?.metadata?.stale || cached || (minutes !== null && minutes >= 30));
  const failed = isError || Boolean(metadata?.clientCache?.networkError);
  return { cached, stale, failed, partial, minutes, timestampLabel: sourceTime ? 'Fuente actualizada' : 'Recibido', text: failed
    ? 'No pudimos actualizar. Los datos guardados pueden haber cambiado.'
    : stale ? 'Mostrando datos guardados. Actualiza para comprobar cambios.'
    : partial ? 'La fuente solo pudo cargar parte del catálogo. Puede haber más contenido.'
    : metadata?.source === 'cache' ? 'Contenido de la caché de la fuente.' : 'Contenido recibido de la fuente.' };
}
