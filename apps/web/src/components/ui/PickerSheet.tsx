import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { rowFieldClass } from './field'

export interface PickerOption {
  id: string
  label: string
  hint?: string
  /** The one you are already in — shown, but not selectable. */
  current?: boolean
}

interface PickerListProps {
  options: PickerOption[]
  loading?: boolean
  emptyText?: string
  onPick: (id: string) => void
}

/**
 * The searchable list itself, sheet not included: `UpdateStatusSheet` swaps it in as a second
 * mode of the sheet it already owns, because two open `BottomSheet`s share one `document`
 * keydown listener — Escape would close both and Tab would fight over the trap.
 */
export function PickerList({
  options,
  loading,
  emptyText = 'Nothing to move into yet.',
  onPick,
}: PickerListProps) {
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const visible = options.filter((option) =>
    query ? `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(query) : true,
  )

  return (
    <>
      {options.length > 6 && (
        <input
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`mb-3 w-full ${rowFieldClass}`}
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
    </>
  )
}

interface PickerSheetProps extends PickerListProps {
  open: boolean
  title: string
  onClose: () => void
}

/**
 * A searchable list in a sheet: used for moving things, where a dropdown would bury the options.
 * The search box needs no reset effect — `BottomSheet` renders nothing while closed, so the
 * list unmounts and its state goes with it.
 */
export function PickerSheet({ open, title, onClose, ...list }: PickerSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <PickerList {...list} />
    </BottomSheet>
  )
}
