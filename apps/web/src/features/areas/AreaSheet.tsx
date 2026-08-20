import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Button } from '../../components/ui/Button'
import {
  AREA_COLORS,
  AREA_ICONS,
  areaSchema,
  type AreaInput,
  type LifeArea,
} from '../../lib/schemas'

interface AreaSheetProps {
  open: boolean
  area?: LifeArea | null
  onClose: () => void
  onSubmit: (values: AreaInput) => void
  onArchive?: () => void
  saving?: boolean
}

export function AreaSheet({ open, area, onClose, onSubmit, onArchive, saving }: AreaSheetProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AreaInput>({
    resolver: zodResolver(areaSchema),
    values: {
      name: area?.name ?? '',
      color: area?.color ?? AREA_COLORS[0],
      icon: area?.icon ?? AREA_ICONS[0],
      sort_order: area?.sort_order ?? 0,
    },
  })

  const color = watch('color')
  const icon = watch('icon')

  return (
    <BottomSheet open={open} onClose={onClose} title={area ? 'Edit area' : 'New area'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="area-name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="area-name"
            autoFocus
            {...register('name')}
            className="w-full rounded-xl border border-gray-200 bg-paper px-4 py-3 text-base outline-none focus:border-accent"
          />
          {errors.name && <p className="mt-1 text-sm text-flame-ink">{errors.name.message}</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {AREA_ICONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={icon === option}
                onClick={() => setValue('icon', option, { shouldDirty: true })}
                className={`h-11 w-11 rounded-xl text-xl ${
                  icon === option ? 'bg-accent/10 ring-2 ring-accent' : 'bg-paper'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {AREA_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Colour ${option}`}
                aria-pressed={color === option}
                onClick={() => setValue('color', option, { shouldDirty: true })}
                style={{ backgroundColor: option }}
                className={`h-11 w-11 rounded-full ${color === option ? 'ring-2 ring-ink ring-offset-2' : ''}`}
              />
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="area-sort" className="mb-1 block text-sm font-medium">
            Sort order
          </label>
          <input
            id="area-sort"
            type="number"
            min={0}
            {...register('sort_order', { valueAsNumber: true })}
            className="w-full rounded-xl border border-gray-200 bg-paper px-4 py-3 text-base outline-none focus:border-accent"
          />
        </div>

        <Button type="submit" block disabled={saving}>
          {saving ? 'Saving…' : area ? 'Save changes' : 'Create area'}
        </Button>

        {area && onArchive && (
          <Button
            type="button"
            variant="danger"
            block
            onClick={() => {
              if (
                window.confirm(`Archive "${area.name}"? Its projects stay, the area is hidden.`)
              ) {
                onArchive()
              }
            }}
          >
            Archive area
          </Button>
        )}
      </form>
    </BottomSheet>
  )
}
