import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { contentDateRange } from './contentDates';

export type ContentFilters = { q?: string; type?: ('evento' | 'gastronomia' | 'info')[]; category?: string[]; from?: string; to?: string };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export function useContentFilters({ includeDates = true }: { includeDates?: boolean } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[]; category?: string | string[]; type?: string | string[]; from?: string | string[]; to?: string | string[] }>();
  const q = first(params.q) || '';
  const category = first(params.category) || '';
  const type = first(params.type) || '';
  const from = includeDates ? first(params.from)?.trim() || undefined : undefined;
  const to = includeDates ? first(params.to)?.trim() || undefined : undefined;
  const fromParams = (): ContentFilters => ({
    q: q || undefined,
    category: category ? category.split(',').filter(Boolean) : undefined,
    type: type ? type.split(',').filter((t): t is 'evento' | 'gastronomia' | 'info' => ['evento', 'gastronomia', 'info'].includes(t)) : undefined,
    from,
    to,
  });
  const [filters, setFilters] = useState<ContentFilters>(fromParams);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  useEffect(() => { setFilters(fromParams()); }, [q, category, type, from, to]);
  useEffect(() => { const timer = setTimeout(() => setDebouncedFilters(filters), 250); return () => clearTimeout(timer); }, [filters]);
  const range = contentDateRange(filters.from, filters.to);
  const queryRange = contentDateRange(debouncedFilters.from, debouncedFilters.to);
  const queryFilters = { ...debouncedFilters, from: queryRange.from, to: queryRange.to };
  const clearFilters = () => {
    setFilters({});
    router.setParams({ q: undefined, category: undefined, type: undefined, from: undefined, to: undefined });
  };
  const clearDateFilters = () => {
    const next = { ...filters, from: undefined, to: undefined };
    setFilters(next);
    // Sync the remaining local search too, so the params effect does not restore old text.
    router.setParams({ q: next.q || undefined, category: next.category?.join(',') || undefined,
      type: next.type?.join(',') || undefined, from: undefined, to: undefined });
  };
  return { filters, queryFilters, setFilters, clearFilters, clearDateFilters, dateError: range.error, hasValidDates: !range.error && !queryRange.error };
}
