import { nextBestAction } from './nextBestAction.ts';
import type { CommandCenterSnapshot } from './whatNextTypes.ts';
import type { Tone } from './status.ts';

export type { Tone } from './status.ts';

export type NextAction = {
  tone: Tone;
  title: string;
  detail: string;
  href: string;
  why?: string;
  actionLabel?: string;
  contactId?: string | null;
  phone?: string | null;
};

export function whatNext(snapshot: CommandCenterSnapshot, now: Date = new Date()): NextAction {
  const next = nextBestAction(snapshot, now);
  return {
    tone: next.tone,
    title: next.title,
    detail: next.detail,
    href: next.href,
    why: next.why,
    actionLabel: next.actionLabel,
    contactId: next.contactId,
    phone: next.phone,
  };
}
