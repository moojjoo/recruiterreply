const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseUtcInstant(value: string): Date | null {
  if (!EXPLICIT_OFFSET.test(value.trim())) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateTime(
  value: string,
  locales?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const parsed = parseUtcInstant(value);
  if (!parsed) return "—";

  return new Intl.DateTimeFormat(locales, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(parsed);
}

export function formatLocalDate(
  value: string,
  locales?: Intl.LocalesArgument,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const parsed = parseUtcInstant(value);
  if (!parsed) return "—";

  return new Intl.DateTimeFormat(locales, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(parsed);
}
