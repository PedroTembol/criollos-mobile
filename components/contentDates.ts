export function validContentDate(value?: string): string | undefined {
  const day = value?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : undefined;
}

export function contentDateRange(fromValue?: string, toValue?: string) {
  const from = validContentDate(fromValue);
  const to = validContentDate(toValue);
  const malformed = Boolean(fromValue?.trim() && !from) || Boolean(toValue?.trim() && !to);
  const error = malformed ? 'Las fechas del enlace deben usar una fecha válida con formato YYYY-MM-DD.'
    : from && to && from > to ? 'La fecha inicial debe ser anterior o igual a la fecha final.' : undefined;
  return { from, to, error };
}

/** These values are calendar days in Puerto Rico, not instants to shift to device time. */
export function formatContentDate(day: string): string {
  const value = validContentDate(day);
  if (!value) return '';
  const [year, month, date] = value.split('-');
  return `${date}/${month}/${year}`;
}
