/**
 * SLA Service — V6.
 *
 * Checks for overdue threads based on hold-time limits per level.
 * Creates notification for the current holder and escalation target.
 */

import firestore from './firestore-service';
import { createNotification } from './notification-service';
import type { DocumentThread } from './thread-engine';

// Max hold time in hours per level (working hours ≈ 8h/day)
const SLA_HOURS: Record<number, number> = {
  7: 24,    // 3 working days
  6: 8,     // 1 working day
  5: 16,    // 2 working days
  4: 16,    // 2 working days
  3: 24,    // 3 working days
  2: 24,    // 3 working days
  1: 40,    // 5 working days
};

// Escalation targets per level
const ESCALATION_LEVEL: Record<number, number> = {
  7: 5,  // L7 → notify L5
  6: 5,  // L6 → notify L5
  5: 3,  // L5 → notify L3
  4: 3,  // L4 → notify L3
  3: 2,  // L3 → notify L2
  2: 1,  // L2 → notify L1
  1: 1,  // L1 → self-reminder only
};

interface SlaCheckResult {
  checked: number;
  overdue: number;
  escalated: number;
  notified: string[];
}

/**
 * Check all active threads for SLA violations.
 * Creates notifications for overdue holders and escalation targets.
 */
export async function checkSla(): Promise<SlaCheckResult> {
  const activeStatuses = ['SUBMITTED', 'IN_REVIEW', 'APPROVED_LEVEL', 'RESUBMITTED', 'PENDING_SIGN', 'BOUNCED'];
  const result: SlaCheckResult = { checked: 0, overdue: 0, escalated: 0, notified: [] };

  // Fetch all active threads
  const threads = await firestore.list<DocumentThread>('threads', { limit: 500 });
  const active = threads.filter(t => activeStatuses.includes(t.status));
  result.checked = active.length;

  const now = Date.now();

  for (const thread of active) {
    const updatedMs = thread.updatedAt?._seconds
      ? thread.updatedAt._seconds * 1000
      : (thread.updatedAt instanceof Date ? thread.updatedAt.getTime() : 0);

    if (!updatedMs) continue;

    const heldHours = (now - updatedMs) / (1000 * 60 * 60);
    const maxHours = thread.priority === 'urgent'
      ? (SLA_HOURS[thread.currentLevel] || 24) / 2
      : (SLA_HOURS[thread.currentLevel] || 24);

    if (heldHours < maxHours) continue;

    result.overdue++;

    // Notify current holder
    await createNotification({
      userId: thread.currentHolderId,
      threadId: thread.id,
      kind: 'thread.overdue',
      title: `Overdue: held ${Math.round(heldHours)}h (limit: ${maxHours}h)`,
      titleKm: `ផុតកំណត់: រក្សាទុក ${Math.round(heldHours)}ម៉ោង`,
      body: thread.title,
      link: `/inbox/${thread.id}`,
    });
    result.notified.push(thread.currentHolderId);

    // Escalate if held 2x SLA
    if (heldHours >= maxHours * 2) {
      const escalateLevel = ESCALATION_LEVEL[thread.currentLevel] || 1;
      // Find a user at the escalation level
      const escalationUsers = await firestore.list<any>('users', {
        where: [['level', '==', escalateLevel]],
        limit: 1,
      });
      if (escalationUsers.length > 0) {
        await createNotification({
          userId: escalationUsers[0].id,
          threadId: thread.id,
          kind: 'thread.escalation',
          title: `Escalation: thread stuck at L${thread.currentLevel} for ${Math.round(heldHours)}h`,
          titleKm: `ការលើកកម្ពស់: ខ្សែស្រឡាយជាប់នៅ L${thread.currentLevel}`,
          body: thread.title,
          link: `/inbox/${thread.id}`,
        });
        result.escalated++;
        result.notified.push(escalationUsers[0].id);
      }
    }
  }

  return result;
}
