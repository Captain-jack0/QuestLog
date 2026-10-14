import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { deleteConfirmed, ProjectRemoval, removalKind, removedRedirect } from './ProjectRemoval'

// Neither the Supabase client nor the session is needed to decide what renders.
vi.mock('./queries', () => ({
  deleteProject: vi.fn(),
  leaveProject: vi.fn(),
  restoreProject: vi.fn(),
}))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }))

function render(ownerId: string) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ProjectRemoval project={{ id: 'p1', title: 'Anchor', user_id: ownerId }} />
    </QueryClientProvider>,
  )
}

describe('deleteConfirmed', () => {
  it('stays off until the whole name is typed', () => {
    expect(deleteConfirmed('', 'Anchor')).toBe(false)
    expect(deleteConfirmed('Anch', 'Anchor')).toBe(false)
    expect(deleteConfirmed('anchor', 'Anchor')).toBe(false)
    expect(deleteConfirmed('Anchor!', 'Anchor')).toBe(false)
  })

  it('wakes on the exact name, stray spaces at the ends forgiven', () => {
    expect(deleteConfirmed('Anchor', 'Anchor')).toBe(true)
    expect(deleteConfirmed('  Anchor ', 'Anchor')).toBe(true)
  })
})

describe('removalKind', () => {
  it('lets only the owner delete', () => {
    expect(removalKind('me', 'me')).toBe('delete')
    expect(removalKind('someone-else', 'me')).toBe('leave')
    expect(removalKind('someone-else', undefined)).toBe('leave')
    // Still loading on both sides is not ownership.
    expect(removalKind(undefined, undefined)).toBe('leave')
  })
})

describe('removedRedirect', () => {
  it('sends the owner back to the area the project lived in', () => {
    expect(removedRedirect('delete', 'a1')).toBe('/areas/a1')
    expect(removedRedirect('delete', null)).toBe('/areas')
  })

  it("sends a member who left to the area list, never into the owner's area", () => {
    expect(removedRedirect('leave', 'a1')).toBe('/areas')
    expect(removedRedirect('leave', null)).toBe('/areas')
  })
})

describe('ProjectRemoval', () => {
  it('offers the owner Delete and no Leave', () => {
    const html = render('me')
    expect(html).toContain('aria-label="Delete project Anchor"')
    expect(html).not.toContain('Leave')
  })

  it('hides Delete from a member and offers Leave instead', () => {
    const html = render('someone-else')
    expect(html).toContain('aria-label="Leave project Anchor"')
    expect(html).not.toContain('Delete')
  })
})
