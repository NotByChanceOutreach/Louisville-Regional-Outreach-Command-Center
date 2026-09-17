import { boardChecklist, boardMemberContacts } from './boardSeed.ts';
import { priorityTasks } from './taskSeed.ts';
import { underwearSeedContacts } from './underwearContacts.ts';
import {
  DEFAULT_NAVIGATOR_URL,
  DEFAULT_RESOURCE_VERIFIER_URL,
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type CommandCenterSnapshot,
} from '../types/models.ts';

export function buildSeedSnapshot(now: Date = new Date()): CommandCenterSnapshot {
  const nowIso = now.toISOString();
  return {
    tasks: priorityTasks(nowIso),
    contacts: [...underwearSeedContacts(nowIso), ...boardMemberContacts(nowIso)],
    contactActivity: [],
    followUps: [],
    boardTasks: boardChecklist(),
    activity: [
      {
        id: 'activity-seeded',
        type: 'system',
        summary: 'Command Center seeded with four priorities, board directory, and underwear contacts.',
        entityType: 'system',
        entityId: null,
        createdAt: nowIso,
        createdBy: 'system',
        createdByUid: null,
        details: null,
      },
    ],
    settings: {
      ...DEFAULT_SETTINGS,
      seededAt: nowIso,
      schemaVersion: SCHEMA_VERSION,
      resourceVerifierUrl: DEFAULT_RESOURCE_VERIFIER_URL,
      navigatorUrl: DEFAULT_NAVIGATOR_URL,
    },
  };
}
