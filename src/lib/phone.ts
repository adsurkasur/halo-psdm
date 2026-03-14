const PHONE_62_REGEX = /^62\d{8,13}$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhoneTo62(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";

  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;

  return digits;
}

export function isValidPhone62(value: string): boolean {
  return PHONE_62_REGEX.test(value);
}
