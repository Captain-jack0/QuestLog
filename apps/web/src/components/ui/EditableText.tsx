import { useEffect, useRef, useState } from 'react'

interface EditableTextProps {
  value: string
  onSave: (value: string) => void
  label: string
  className?: string
  disabled?: boolean
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
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed && trimmed !== value) onSave(trimmed)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`w-full rounded-lg border border-accent bg-paper px-2 py-1 outline-none ${className}`}
      />
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label} — click to edit`}
      onClick={() => setEditing(true)}
      className={`w-full rounded-lg px-2 py-1 text-left hover:bg-paper disabled:hover:bg-transparent ${className}`}
    >
      {value}
    </button>
  )
}
