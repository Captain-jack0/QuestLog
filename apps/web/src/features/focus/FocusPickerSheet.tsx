import { useEffect, useState } from 'react'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/StatusChip'
import { rowFieldClass } from '../../components/ui/field'
import { usePickableItems, type PickableItem } from './queries'

interface FocusPickerSheetProps {
  open: boolean
  onClose: () => void
  onSubmit: (items: PickableItem[]) => void
  saving?: boolean
}

const MAX_FOCUS = 3

export function FocusPickerSheet({ open, onClose, onSubmit, saving }: FocusPickerSheetProps) {
  const items = usePickableItems(open)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PickableItem[]>([])

  useEffect(() => {
    if (open) {
      setSearch('')
      setSelected([])
    }
  }, [open])

  const query = search.trim().toLowerCase()
  const visible = (items.data ?? []).filter((item) =>
    query ? item.title.toLowerCase().includes(query) : true,
  )
  const projects = visible.filter((item) => item.itemType === 'project')
  const tasks = visible.filter((item) => item.itemType === 'task')

  const isSelected = (item: PickableItem) =>
    selected.some((s) => s.id === item.id && s.itemType === item.itemType)

  function toggle(item: PickableItem) {
    setSelected((current) =>
      isSelected(item)
        ? current.filter((s) => !(s.id === item.id && s.itemType === item.itemType))
        : current.length >= MAX_FOCUS
          ? current
          : [...current, item],
    )
  }

  /**
   * Called as a plain function, not rendered as <Group />: a component declared in a render
   * body is a new type every render and would remount the whole list — and each row owns
   * focus, which remounting throws away mid-keyboard-walk.
   *
   * A group that has nothing in it (or nothing left after the search) renders nothing rather
   * than an empty heading; with two columns the survivor simply takes the width.
   */
  const renderGroup = (id: string, heading: string, group: PickableItem[]) =>
    group.length > 0 && (
      <section aria-labelledby={id}>
        <h3 id={id} className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
          {heading} · {group.length}
        </h3>
        <ul className="space-y-2">
          {group.map((item) => (
            <li key={`${item.itemType}-${item.id}`}>
              <button
                type="button"
                aria-pressed={isSelected(item)}
                onClick={() => toggle(item)}
                disabled={!isSelected(item) && selected.length >= MAX_FOCUS}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left disabled:opacity-40 ${
                  isSelected(item) ? 'bg-accent/10 ring-2 ring-accent' : 'bg-paper'
                }`}
              >
                {/* min-w-0 so a long title wraps instead of shoving the status chip out of the
                    button — a flex item's automatic minimum is its longest word, which one
                    unbroken title would spend a whole 171px column on. The per-row
                    "task"/"project" line this used to carry is gone: the heading says it once
                    for the group, and the row got that width back. */}
                <span className="min-w-0 flex-1 font-medium leading-tight">{item.title}</span>
                <StatusChip status={item.status} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <BottomSheet open={open} onClose={onClose} title="Pick today's focus">
      <p className="mb-3 text-sm text-muted">
        Up to three things. {selected.length}/{MAX_FOCUS} chosen.
      </p>

      <input
        aria-label="Search items"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`mb-3 w-full ${rowFieldClass}`}
      />

      {items.isPending && <p className="text-muted">Loading your open items…</p>}
      {items.data?.length === 0 && (
        <p className="text-muted">Nothing open yet — add a project or a task first.</p>
      )}
      {visible.length === 0 && (items.data?.length ?? 0) > 0 && (
        <p className="text-muted">No open project or task matches that.</p>
      )}

      {/* Projects and tasks are two lists, because picking today's focus is two different
          decisions, and the old single list interleaved them with a lowercase enum as the
          only tell. Side by side only from `sm`, though: the sheet is full-bleed, so at a
          390px viewport the panel's p-4 leaves 358px, gap-4 splits that into two 171px
          columns, and a row spends 24px on px-3, 8px on its gap and ~80px on an unshrinkable
          "In progress" chip — leaving ~57px for a title set at the inherited 16px, six
          characters a line. Below `sm` the same two groups stack full width, inside one
          scroll container so a thumb never lands in a nested one. */}
      <div className="mb-4 grid max-h-[45dvh] gap-4 overflow-y-auto sm:grid-cols-2">
        {renderGroup('focus-pick-projects', 'Projects', projects)}
        {renderGroup('focus-pick-tasks', 'Tasks', tasks)}
      </div>

      <Button block disabled={selected.length === 0 || saving} onClick={() => onSubmit(selected)}>
        {saving ? 'Saving…' : `Focus on ${selected.length || 'nothing'} today`}
      </Button>
    </BottomSheet>
  )
}
