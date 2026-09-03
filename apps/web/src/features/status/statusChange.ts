import type { ItemStatus } from '../../lib/schemas'

/**
 * The shape of a status change and the one rule about it, kept apart from the hook that sends
 * it. `useUpdateStatus` imports the supabase client, which throws at module load when the env
 * vars are missing — so anything importing these from there dragged a live client into every
 * test that touched them. Nothing in this file reaches past `lib/schemas` (types and zod only);
 * keep it that way and the predicate stays testable without a mock.
 */
export interface StatusChange {
  itemType: 'task' | 'project'
  itemId: string
  status: ItemStatus
  leftOff: string
  nextStep: string
  /** The task the next step points at, if the user picked one. */
  nextStepTaskId?: string | null
  note?: string
}

/** Paused/blocked need the resume context; done prefills it but does not demand it. */
export function needsResumeContext(status: ItemStatus): boolean {
  return status === 'paused' || status === 'blocked'
}
