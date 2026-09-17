import { hydrateContact } from '../lib/contactModel.ts';
import type { BoardTask, Contact } from '../types/models.ts';

const BOARD_SOURCE = 'Entered from Not By Chance Outreach leadership list supplied by Rick. Contact details not provided.';

type BoardMember = {
  id: string;
  contactName: string;
  facility: string;
  sortOrder: number;
};

const members: BoardMember[] = [
  { id: 'board-rick-aubrey', contactName: 'Rick Aubrey', facility: 'Executive Director', sortOrder: 1 },
  { id: 'board-sherrie-aubrey', contactName: 'Sherrie Aubrey', facility: 'President', sortOrder: 2 },
  { id: 'board-jennifer-holmes', contactName: 'Jennifer Holmes', facility: 'Treasurer', sortOrder: 3 },
  { id: 'board-marcus-biggs', contactName: 'Marcus Biggs', facility: 'Secretary', sortOrder: 4 },
  { id: 'board-dana-smith', contactName: 'Dana Smith', facility: 'Director', sortOrder: 5 },
  { id: 'board-gavin-winters', contactName: 'Gavin Winters', facility: 'Director', sortOrder: 6 },
];

export function boardMemberContacts(nowIso: string): Contact[] {
  return members.map((member) =>
    hydrateContact({
      id: member.id,
      organization: 'Not By Chance Outreach',
      facility: member.facility,
      contactName: member.contactName,
      phone: null,
      email: null,
      website: null,
      address: null,
      city: 'Louisville',
      state: 'KY',
      zip: null,
      category: 'Board',
      organizationType: 'Board / Leadership',
      inventory: null,
      approach: null,
      executives: null,
      channel: null,
      corridor: 'Louisville Metro Core',
      radialDistance: null,
      distTag: null,
      status: 'Not Contacted',
      lastContactAt: null,
      nextFollowUpAt: null,
      notes: null,
      verificationStatus: 'Research Needed',
      source: BOARD_SOURCE,
      lastVerified: null,
      sortOrder: member.sortOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
  );
}

const checklist = [
  'Create Microsoft Teams meeting',
  'Confirm date/time',
  'Add board members',
  'Send meeting invitation',
  'Prepare agenda',
  'Prepare board packet',
  'Upload documents',
  'Test meeting link',
  'Send reminder',
];

export function boardChecklist(): BoardTask[] {
  return checklist.map((title, index) => ({
    id: `board-task-${String(index + 1).padStart(2, '0')}`,
    title,
    done: false,
    sortOrder: index + 1,
    completedAt: null,
  }));
}

export { BOARD_SOURCE };
