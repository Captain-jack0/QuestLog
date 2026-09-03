import { describe, expect, it } from 'vitest'
import { dropChange } from './drop'
import { needsResumeContext } from './statusChange'

describe('dropChange', () => {
  it('drops rather than completing — the two are one word apart and worlds apart in XP', () => {
    expect(dropChange('task', 't-1').status).toBe('dropped')
  })

  it('sends empty resume context, because nothing collects it for a drop', () => {
    // No sheet opens on this path, so whatever these say is what reaches the RPC and the log
    // it writes. Anything non-empty here would be invented on the user's behalf.
    expect(dropChange('task', 't-1').leftOff).toBe('')
    expect(dropChange('task', 't-1').nextStep).toBe('')
  })

  it('is only sheet-free while `dropped` stays outside the resume statuses', () => {
    // The pairing above is safe *because* of this. If `dropped` ever joins paused/blocked,
    // the empty strings stop being a contract and start being a silent data loss.
    expect(needsResumeContext(dropChange('task', 't-1').status)).toBe(false)
  })

  it('passes the card its own identity through', () => {
    expect(dropChange('project', 'p-9')).toMatchObject({ itemType: 'project', itemId: 'p-9' })
  })
})
