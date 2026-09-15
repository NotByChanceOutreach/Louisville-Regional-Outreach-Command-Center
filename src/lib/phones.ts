import { NEEDS_RESEARCH } from '../types/models.ts';

export function parsePhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = raw.split(/\s*(?:\/|,|;|\bor\b)\s*/i);
  const found: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7) found.push(trimmed);
  }
  return found;
}

export function toTelHref(phone: string): string {
  const kept = phone.replace(/[^\d+]/g, '');
  return `tel:${kept}`;
}

export function parseEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return matches ?? [];
}

export function toMailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function displayOrResearch(value: string | null | undefined): string {
  if (!value || value.trim() === '') return NEEDS_RESEARCH;
  return value;
}

export function hasUsablePhone(value: string | null | undefined): boolean {
  return parsePhones(value).length > 0;
}

export function hasUsableEmail(value: string | null | undefined): boolean {
  return parseEmails(value).length > 0;
}

export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function websiteHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/\//, '')}`;
}

export function looksLikeWebsite(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('@')) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  return /\.[a-z]{2,}(\/|$)/i.test(trimmed) && !/\s/.test(trimmed);
}
