const PHONE_INTL_REGEX = /^[1-9]\d{7,14}$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhoneInternational(value: string): string {
  const raw = value.trim();
  if (!raw) return "";

  let digits = digitsOnly(raw);
  if (!digits) return "";

  // International prefix commonly written as 00 (e.g. 001234...).
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Backward compatibility for Indonesian local input without country code.
  if (digits.startsWith("8")) return `62${digits}`;
  if (digits.startsWith("08")) return `62${digits.slice(1)}`;

  return digits;
}

export function isValidPhoneInternational(value: string): boolean {
  return PHONE_INTL_REGEX.test(value);
}

// Backward compatible aliases used across current codebase.
export const normalizePhoneTo62 = normalizePhoneInternational;
export const isValidPhone62 = isValidPhoneInternational;
