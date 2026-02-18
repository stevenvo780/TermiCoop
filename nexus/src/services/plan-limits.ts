/**
 * Plan limits enforcement.
 *
 * Each plan defines hard caps on the number of owned workers and
 * concurrent sessions a user is allowed.  The `free` tier is the
 * default for every new user.
 */

import { WorkerModel } from '../models/worker.model';
import db from '../config/database';

export interface PlanLimits {
  maxWorkers: number;        // Max owned workers (not shared)
  maxSessions: number;       // Max concurrent sessions (-1 = unlimited)
  canShare: boolean;         // Can share workers with other users
  canSaveSnippets: boolean;  // Can save commands/snippets
  canTagWorkers: boolean;    // Can create tags / worker groups
  canUseApi: boolean;        // Dedicated API access
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxWorkers: 1,
    maxSessions: 1,
    canShare: false,
    canSaveSnippets: false,
    canTagWorkers: false,
    canUseApi: false,
  },
  basico: {
    maxWorkers: 3,
    maxSessions: 3,
    canShare: false,
    canSaveSnippets: false,
    canTagWorkers: false,
    canUseApi: false,
  },
  pro: {
    maxWorkers: 10,
    maxSessions: -1, // unlimited
    canShare: true,
    canSaveSnippets: true,
    canTagWorkers: false,
    canUseApi: false,
  },
  enterprise: {
    maxWorkers: -1, // unlimited
    maxSessions: -1, // unlimited
    canShare: true,
    canSaveSnippets: true,
    canTagWorkers: true,
    canUseApi: true,
  },
};

/**
 * Returns the plan limits for a given plan id. Falls back to 'free'.
 */
export function getLimitsForPlan(planId: string): PlanLimits {
  return PLAN_LIMITS[planId] || PLAN_LIMITS.free;
}

/**
 * Returns the active plan id for a user. Reads the `plan` column
 * from the users table (defaults to 'free').
 */
export async function getUserPlan(userId: number): Promise<string> {
  const row = await db.get<{ plan: string }>('SELECT plan FROM users WHERE id = ?', [userId]);
  return row?.plan || 'free';
}

/**
 * Updates the plan column for a user.
 */
export async function setUserPlan(userId: number, planId: string): Promise<void> {
  await db.run('UPDATE users SET plan = ? WHERE id = ?', [planId, userId]);
}

/**
 * Count owned workers for a user.
 */
export async function countOwnedWorkers(userId: number): Promise<number> {
  const row = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) as count FROM workers WHERE owner_id = ?',
    [userId]
  );
  return row ? Number(row.count) : 0;
}

/**
 * Check whether a user can create a new worker given their plan.
 */
export async function canCreateWorker(userId: number): Promise<{ allowed: boolean; reason?: string; current: number; max: number }> {
  const planId = await getUserPlan(userId);
  const limits = getLimitsForPlan(planId);
  const current = await countOwnedWorkers(userId);

  if (limits.maxWorkers !== -1 && current >= limits.maxWorkers) {
    return {
      allowed: false,
      reason: `Tu plan "${planId}" permite máximo ${limits.maxWorkers} worker(s). Tienes ${current}. Actualiza tu plan para agregar más.`,
      current,
      max: limits.maxWorkers,
    };
  }

  return { allowed: true, current, max: limits.maxWorkers };
}

/**
 * Check whether a user can open a new session given their plan.
 * `currentSessions` should be the count of active sessions the user currently has.
 */
export function canOpenSession(planId: string, currentSessions: number): { allowed: boolean; reason?: string; current: number; max: number } {
  const limits = getLimitsForPlan(planId);

  if (limits.maxSessions !== -1 && currentSessions >= limits.maxSessions) {
    return {
      allowed: false,
      reason: `Tu plan "${planId}" permite máximo ${limits.maxSessions} sesión(es) simultánea(s). Cierra una sesión o actualiza tu plan.`,
      current: currentSessions,
      max: limits.maxSessions,
    };
  }

  return { allowed: true, current: currentSessions, max: limits.maxSessions };
}

/**
 * Check whether a user can share workers.
 */
export async function canShareWorker(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  const planId = await getUserPlan(userId);
  const limits = getLimitsForPlan(planId);

  if (!limits.canShare) {
    return {
      allowed: false,
      reason: `Tu plan actual no permite compartir workers. Actualiza al plan Pro o superior.`,
    };
  }

  return { allowed: true };
}
