import { statusLabel, statusTone } from '../../components/ui/StatusChip'
import { DIFFICULTY_LABELS, PRIORITY_LABELS, type ItemStatus } from '../../lib/schemas'
import { clearedFilters, TASK_VIEWS, type TaskListPrefs, type TaskView } from './listPrefs'
import { SORT_KEYS, type SortKey } from './taskOrder'

/**
 * `StatusPicker`'s QUICK list minus `done` and `dropped` — closed work has its own
 * collapsible section, so a chip for either would fight it for the same decision.
 */
const FILTER_STATUSES: ItemStatus[] = ['in_progress', 'paused', 'blocked']

/**
 * `created` sorts oldest first (taskOrder.ts), so a "Newest" label would say the opposite
 * of what the comparator does. "Added" names the axis without claiming a direction.
 */
const SORT_LABELS: Record<SortKey, string> = { created: 'Added', priority: 'Priority' }

const VIEW_GLYPHS: Record<TaskView, string> = { card: '▦', row: '☰' }
const VIEW_LABELS: Record<TaskView, string> = { card: 'Card view', row: 'Row view' }

/** Every control in the bar is the same 44px pill; only the selected paint differs. */
const PILL = 'min-h-[44px] rounded-full px-3 text-xs font-semibold transition'
const IDLE = 'text-muted hover:bg-line/40'
/**
 * Pressed paint for every chip that is not a status. It says "I am on", not which axis — the
 * label already says that. Status chips keep `statusTone` so a pressed "Paused" reads exactly
 * like the Paused badge on the rows it is filtering to.
 */
const ON = 'bg-accent/15 text-accent'
/** Selection ring, a separate layer from the global `:focus-visible` ring (index.css). */
const SELECTED_RING = 'ring-2 ring-accent ring-offset-1'

interface TaskListControlsProps {
  prefs: TaskListPrefs
  onChange: (prefs: TaskListPrefs) => void
  /** `profiles.stale_days` — the threshold names itself on the chip instead of hiding. */
  staleDays: number
  /** Open tasks the active filters removed from the list. */
  hiddenCount: number
  /** Open tasks before filtering — the denominator of "Showing 4 of 12". */
  totalCount: number
}

/**
 * Stateless: the preferences live with whoever owns the list, so this renders a value and
 * reports a new one. Chips toggle independently (`aria-pressed`), and an empty selection
 * means "everything" — there is no "All" chip to get out of step with the rest.
 */
export function TaskListControls({
  prefs,
  onChange,
  staleDays,
  hiddenCount,
  totalCount,
}: TaskListControlsProps) {
  // Every filter in the bar, or the "Showing X of Y" line goes missing for the ones left out.
  const filtering =
    prefs.status.length > 0 || prefs.staleOnly || prefs.highPriorityOnly || prefs.quickOnly

  function toggleStatus(status: ItemStatus) {
    onChange({
      ...prefs,
      status: prefs.status.includes(status)
        ? prefs.status.filter((s) => s !== status)
        : [...prefs.status, status],
    })
  }

  return (
    <div className="mb-3 space-y-2">
      {/* Wraps to a second line at 390px rather than scrolling sideways: a filter that has
          scrolled out of sight is the trap this bar exists to prevent. */}
      <div role="group" aria-label="Filter tasks" className="flex flex-wrap gap-1.5">
        {FILTER_STATUSES.map((status) => {
          const active = prefs.status.includes(status)
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={`${PILL} ${active ? `${statusTone(status)} ${SELECTED_RING}` : `bg-paper ${IDLE}`}`}
            >
              {statusLabel(status)}
            </button>
          )
        })}
        {/* Staleness is a member of the same chip row, not a control of its own: one mental
            model, "only show me these". */}
        <button
          type="button"
          aria-pressed={prefs.staleOnly}
          onClick={() => onChange({ ...prefs, staleOnly: !prefs.staleOnly })}
          className={`${PILL} ${prefs.staleOnly ? `${ON} ${SELECTED_RING}` : `bg-paper ${IDLE}`}`}
        >
          Untouched {staleDays}d
        </button>

        {/* Glyph beside the word, so the row doubles as the legend the priority mark has
            nowhere else: the ▲ in the list is the ▲ on this chip, in the same accent. */}
        <button
          type="button"
          aria-pressed={prefs.highPriorityOnly}
          onClick={() => onChange({ ...prefs, highPriorityOnly: !prefs.highPriorityOnly })}
          className={`${PILL} ${
            prefs.highPriorityOnly ? `${ON} ${SELECTED_RING}` : `bg-paper ${IDLE}`
          }`}
        >
          <span aria-hidden>▲</span> {PRIORITY_LABELS.high}
          <span className="sr-only"> priority</span>
        </button>

        {/* The label already carries its own gloss ("S · Quick"), so the letter needs no
            second explanation here. */}
        <button
          type="button"
          aria-pressed={prefs.quickOnly}
          onClick={() => onChange({ ...prefs, quickOnly: !prefs.quickOnly })}
          className={`${PILL} ${prefs.quickOnly ? `${ON} ${SELECTED_RING}` : `bg-paper ${IDLE}`}`}
        >
          {DIFFICULTY_LABELS.S}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Not rendered at all while nothing is filtered — at rest the bar makes no claim.
            When a filter is on, this line is what turns "my task vanished" into a count and
            a way back. */}
        {filtering && (
          <p className="flex items-center gap-1 text-xs text-muted">
            Showing {totalCount - hiddenCount} of {totalCount}
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => onChange(clearedFilters(prefs))}
              className="min-h-[44px] rounded-full px-1 text-xs font-semibold text-accent hover:bg-line/40"
            >
              Show all
            </button>
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div role="radiogroup" aria-label="Sort tasks" className="flex rounded-full bg-paper">
            {SORT_KEYS.map((key) => {
              const active = prefs.sort === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => !active && onChange({ ...prefs, sort: key })}
                  className={`${PILL} ${active ? 'bg-accent/10 text-accent' : IDLE}`}
                >
                  {SORT_LABELS[key]}
                </button>
              )
            })}
          </div>

          <div className="flex rounded-full bg-paper">
            {TASK_VIEWS.map((view) => {
              const active = prefs.view === view
              return (
                <button
                  key={view}
                  type="button"
                  aria-pressed={active}
                  onClick={() => !active && onChange({ ...prefs, view })}
                  className={`min-h-[44px] min-w-[44px] rounded-full text-sm font-semibold transition ${
                    active ? 'bg-accent/10 text-accent' : IDLE
                  }`}
                >
                  <span aria-hidden>{VIEW_GLYPHS[view]}</span>
                  <span className="sr-only">{VIEW_LABELS[view]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
