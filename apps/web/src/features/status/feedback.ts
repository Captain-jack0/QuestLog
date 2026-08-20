/** Shape of rpc_update_status' json return (BE-04). */
export interface StatusResult {
  xp_awarded: number
  total_xp: number
  level: number
  leveled_up: boolean
  streak_current: number
  streak_best: number
  freeze_tokens: number
  new_badges: string[]
}

export interface StatusFeedback {
  /** Always shown: what the action was worth. */
  xpToast: string
  confetti: boolean
  levelToast: string | null
  badgeToasts: string[]
}

const readable = (code: string) => code.replace(/_/g, ' ')

/**
 * Turns an RPC result into exactly what the user should see. Pure on purpose: the hook
 * only has to fire what this returns.
 */
export function statusFeedback(result: StatusResult): StatusFeedback {
  return {
    xpToast: `+${result.xp_awarded ?? 0} ✨`,
    confetti: result.leveled_up === true,
    levelToast: result.leveled_up ? `Level ${result.level}!` : null,
    badgeToasts: (result.new_badges ?? []).map((code) => `Badge earned: ${readable(code)} 🏅`),
  }
}
