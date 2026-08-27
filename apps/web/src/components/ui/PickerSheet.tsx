import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'

export interface PickerOption {
  id: string
  label: string
  hint?: string
  /** The one you are already in — shown, but not selectable. */
  current?: boolean
}

interface PickerSheetProps {
  open: boolean
  title: string
  options: PickerOption[]
  loading?: boolean
  emptyText?: string
  onClose: () => void
  onPick: (id: string) => void
}

/** A searchable list in a sheet: used for moving things, where a dropdown would bury the options. */
export function PickerSheet({
  open,
  title,
  options,
  loading,
  emptyText = 'Nothing to move into yet.',
  onClose,
  onPick,
}: PickerSheetProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  const query = search.trim().toLowerCase()
  const visible = options.filter((option) =>
    query ? `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(query) : true,
  )

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {options.length > 6 && (
        <input
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 min-h-[44px] w-full rounded-xl border border-line bg-paper px-4 text-base focus:border-accent"
        />
      )}

      {loading && <p className="text-muted">Loading…</p>}
      {!loading && options.length === 0 && <p className="text-muted">{emptyText}</p>}

      <ul className="max-h-[55dvh] space-y-2 overflow-y-auto">
        {visible.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              disabled={option.current}
              onClick={() => onPick(option.id)}
              className={`btn-quiet flex min-h-[44px] w-full flex-col justify-center rounded-xl border border-line px-3 py-2 text-left ${
                option.current ? 'bg-accent/10 text-accent' : ''
              }`}
            >
              <span className="font-medium leading-tight">
                {option.label}
                {option.current && ' · here now'}
              </span>
              {option.hint && <span className="text-xs text-muted">{option.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
