import { useEffect, useState } from 'react'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/StatusChip'
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
        className="mb-3 min-h-[44px] w-full rounded-xl border border-line bg-paper px-4 text-base focus:border-accent"
      />

      {items.isPending && <p className="text-muted">Loading your open items…</p>}
      {items.data?.length === 0 && (
        <p className="text-muted">Nothing open yet — add a project or a task first.</p>
      )}

      <ul className="mb-4 max-h-[45dvh] space-y-2 overflow-y-auto">
        {visible.map((item) => (
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
              <span className="flex-1">
                <span className="block font-medium leading-tight">{item.title}</span>
                <span className="text-xs text-muted">{item.itemType}</span>
              </span>
              <StatusChip status={item.status} />
            </button>
          </li>
        ))}
      </ul>

      <Button block disabled={selected.length === 0 || saving} onClick={() => onSubmit(selected)}>
        {saving ? 'Saving…' : `Focus on ${selected.length || 'nothing'} today`}
      </Button>
    </BottomSheet>
  )
}
