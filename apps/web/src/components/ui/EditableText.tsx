import { useEffect, useRef, useState } from 'react'

interface EditableTextProps {
  value: string
  onSave: (value: string) => void
  label: string
  className?: string
  disabled?: boolean
  /** Longer text: a textarea that keeps Enter for newlines and saves on blur. */
  multiline?: boolean
  /** Shown in place of an empty value, as an invitation to fill it in. */
  placeholder?: string
  /** Multiline only: allows clearing the field back to empty. */
  allowEmpty?: boolean
}

/**
 * Click (or Enter) to edit, Enter to save, Escape to abandon. A button until it is being
 * edited, so keyboard and screen readers get a real control rather than a div that listens.
 */
export function EditableText({
  value,
  onSave,
  label,
  className = '',
  disabled,
  multiline = false,
  placeholder,
  allowEmpty = false,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  useEffect(() => {
    if (!editing) return
    const el = multiline ? areaRef.current : inputRef.current
    el?.focus()
    if (!multiline) inputRef.current?.select()
  }, [editing, multiline])

  function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed === value) return
    if (trimmed || allowEmpty) onSave(trimmed)
  }

  if (editing) {
    const shared = {
      'aria-label': label,
      value: draft,
    }

    return multiline ? (
      // Explicit buttons, because save-on-blur is a coin flip on touch keyboards.
      <div className="w-full">
        <textarea
          {...shared}
          ref={areaRef}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          className={`w-full rounded-lg border border-accent bg-paper px-2 py-1 ${className}`}
        />
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="btn-primary min-h-[44px] rounded-lg border border-accent px-3 text-xs font-semibold text-accent"
          >
            Save
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(false)}
            className="min-h-[44px] rounded-lg px-3 text-xs font-semibold text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <input
        {...shared}
        ref={inputRef}
        onBlur={commit}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`w-full rounded-lg border border-accent bg-paper px-2 py-1 ${className}`}
      />
    )
  }

  const empty = value.trim().length === 0

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label} — click to edit`}
      onClick={() => setEditing(true)}
      className={`min-h-[44px] w-full whitespace-pre-wrap rounded-lg px-2 py-1 text-left hover:bg-paper disabled:hover:bg-transparent ${
        empty ? 'text-muted' : ''
      } ${className}`}
    >
      {empty ? (placeholder ?? '—') : value}
    </button>
  )
}
