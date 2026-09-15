import { describe, expect, it } from 'vitest';
import { parseEmails, parsePhones, toMailtoHref, toTelHref, websiteHref } from './phones.ts';

describe('parsePhones', () => {
  it('splits two numbers from the Fruit of the Loom source string', () => {
    expect(parsePhones('(270) 781-6400 / (855) 253-4534')).toEqual(['(270) 781-6400', '(855) 253-4534']);
  });

  it('returns no numbers when the field is empty', () => {
    expect(parsePhones(null)).toEqual([]);
  });

  it('builds tel: links from a US formatted number', () => {
    expect(toTelHref('(502) 451-7373')).toBe('tel:5024517373');
  });
});

describe('parseEmails', () => {
  it('extracts real addresses and ignores desk labels', () => {
    expect(parseEmails('sales@sanmar.com / supplierinquiries@sanmar.com')).toEqual([
      'sales@sanmar.com',
      'supplierinquiries@sanmar.com',
    ]);
    expect(parseEmails('Amazon Community Operations Desk')).toEqual([]);
    expect(parseEmails('www.carhartt.com / Direct Plant Outreach')).toEqual([]);
  });

  it('builds mailto links', () => {
    expect(toMailtoHref('louisville@crookedmonkey.com')).toBe('mailto:louisville@crookedmonkey.com');
  });
});

describe('websiteHref', () => {
  it('adds https when a protocol is missing', () => {
    expect(websiteHref('merrickpromotions.com')).toBe('https://merrickpromotions.com');
  });
});
