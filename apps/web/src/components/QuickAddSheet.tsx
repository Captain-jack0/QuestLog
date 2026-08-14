import { useEffect, useRef } from 'react'

/**
 * Placeholder Quick Add sheet (full version: task FE-08).
 * For now it just captures a title and logs it.
 */
export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-20" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const title = inputRef.current?.value.trim()
            if (title) {
              console.log('quick add (wire to Supabase in FE-08):', title)
              if (inputRef.current) inputRef.current.value = ''
            }
          }}
        >
          <input
            ref={inputRef}
            placeholder="What's on your mind, Captain?"
            className="w-full rounded-xl border border-gray-200 bg-paper px-4 py-3 text-base outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-accent py-3 font-semibold text-white active:scale-[0.99]"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
