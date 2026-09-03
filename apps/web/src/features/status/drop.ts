import type { StatusChange } from './useUpdateStatus'

/**
 * The variables for dropping a thread straight from a card. Pure on purpose: `dropped` is
 * outside needsResumeContext, so no sheet ever collects resume context for it and the call
 * site has nothing to decide — which is exactly why the contract needs a guard of its own.
 *
 * The two empty strings are the contract, not a placeholder: the RPC appends a log for every
 * status change, and an abandoned thread has no place it was left off and no next step. The
 * history above it is append-only and stays either way.
 */
export function dropChange(itemType: 'task' | 'project', itemId: string): StatusChange {
  return { itemType, itemId, status: 'dropped', leftOff: '', nextStep: '' }
}
