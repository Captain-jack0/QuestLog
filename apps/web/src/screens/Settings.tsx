import {
  forwardRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Icon, type IconName } from '../components/ui/Icon'
import { useToast } from '../components/ui/Toast'
import { fieldClass } from '../components/ui/field'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useProfile } from '../features/gamification/queries'
import { downloadJson, fetchExportBundle, useUpdateProfile } from '../features/settings/queries'
import { timeZones } from '../features/settings/timezones'
import { ThemePicker } from '../features/settings/ThemePicker'
import { stopAllTimers } from '../features/timer/queries'
import { stopThenSignOut } from '../features/timer/autoStop'
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../features/settings/push'
import { localDateKey } from '../lib/time'
import { profileSchema, type ProfileInput } from '../lib/schemas'

export function SettingsScreen() {
  const { session } = useAuth()
  const toast = useToast()
  const profile = useProfile()
  const updateProfile = useUpdateProfile()
  const [exporting, setExporting] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: {
      display_name: profile.data?.display_name ?? '',
      timezone: profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      digest_enabled: profile.data?.digest_enabled ?? true,
      // the column is a postgres time; the input wants HH:MM
      digest_time: (profile.data?.digest_time ?? '08:00').slice(0, 5),
      push_enabled: profile.data?.push_enabled ?? false,
      stale_days: profile.data?.stale_days ?? 14,
    },
  })

  const staleDays = watch('stale_days')

  /** The browser has to agree before the toggle means anything. */
  async function togglePush(enabled: boolean) {
    try {
      if (enabled) {
        if (!session?.user.id) throw new Error('Not signed in')
        await subscribeToPush(session.user.id)
        toast('Push reminders on')
      } else {
        await unsubscribeFromPush()
      }
    } catch (error) {
      setValue('push_enabled', false)
      toast(error instanceof Error ? error.message : 'Could not enable push', 'error')
    }
  }

  async function sendTestDigest() {
    setSendingTest(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-digest', {
        body: { mode: 'test' },
      })
      if (error) throw error
      toast(
        (data as { result?: string })?.result === 'skipped'
          ? 'Nothing to report yet — no email sent'
          : 'Test digest on its way',
      )
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send the digest', 'error')
    } finally {
      setSendingTest(false)
    }
  }

  async function exportData() {
    setExporting(true)
    try {
      downloadJson(await fetchExportBundle(), `questlog-export-${localDateKey()}.json`)
      toast('Export downloaded')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  // One form around every card, so Save in the header covers all of them. Buttons that are not
  // the save (theme, test digest, export, sign out) are all type="button" for that reason.
  return (
    <form
      onSubmit={handleSubmit((values) =>
        updateProfile.mutate(values, {
          onSuccess: () => toast('Settings saved'),
          onError: (error) => toast(error.message, 'error'),
        }),
      )}
      // Room under the last card for the pinned mobile Save, so it never sits on Sign out.
      className={isDirty ? 'max-md:pb-[calc(3rem+env(safe-area-inset-bottom))]' : undefined}
    >
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-lg font-bold">Settings</h1>
          <p className="mt-1 text-body text-muted">
            Changes apply when you save; the theme switches at once.
          </p>
        </div>
        {/* One Save button. md+: in the header. Mobile: pinned above the tab bar (and above the
            timer deck when a clock runs) while there is something unsaved, hidden otherwise. */}
        <Button
          type="submit"
          className={`max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(76px+env(safe-area-inset-bottom))] max-md:z-30 max-md:mx-auto max-md:max-w-sm max-md:shadow-lg max-md:[body:has([aria-label='Running_timers'])_&]:bottom-[calc(164px+env(safe-area-inset-bottom))] ${
            isDirty ? '' : 'max-md:hidden'
          }`}
          disabled={updateProfile.isPending || !isDirty}
        >
          {updateProfile.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </header>

      {/* Two independent columns on md+, so a tall card never leaves a hole beside a short one.
          DOM order = number order = the single mobile column. */}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="grid gap-4">
          <Section n={1} icon="person" title="Profile">
            <p className="text-caption text-muted">Signed in as</p>
            <p className="mb-4 break-all text-body">{session?.user.email}</p>

            <label htmlFor="display-name" className={labelClass}>
              Display name
            </label>
            <input id="display-name" {...register('display_name')} className={fieldClass} />
            {errors.display_name && (
              <p className="mt-1 text-body text-alert-ink">{errors.display_name.message}</p>
            )}

            <label htmlFor="timezone" className={`mt-3 ${labelClass}`}>
              Timezone
            </label>
            <select id="timezone" {...register('timezone')} className={fieldClass}>
              {timeZones(profile.data?.timezone).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="mt-1 text-caption text-muted">
              Sets when your day rolls over for streaks, XP and the daily digest.
            </p>
          </Section>

          <Section n={2} icon="palette" title="Appearance">
            <ThemePicker />
          </Section>

          <Section n={3} icon="mail" title="Daily digest">
            <label className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="text-body-medium">Daily email digest</span>
              <Switch {...register('digest_enabled')} />
            </label>

            <label htmlFor="digest-time" className={`mt-3 ${labelClass}`}>
              Digest time
            </label>
            <input
              id="digest-time"
              type="time"
              {...register('digest_time')}
              className={fieldClass}
            />
            {errors.digest_time && (
              <p className="mt-1 text-body text-alert-ink">{errors.digest_time.message}</p>
            )}

            <Button
              type="button"
              variant="ghost"
              block
              className="mt-4"
              disabled={sendingTest}
              onClick={sendTestDigest}
            >
              {sendingTest ? 'Sending…' : 'Send me a test digest'}
            </Button>
          </Section>
        </div>

        <div className="grid gap-4">
          <Section n={4} icon="notifications" title="Push">
            <label className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="text-body-medium">
                Push reminders
                <span className="block text-caption text-muted">
                  {pushSupported()
                    ? 'A nudge later in the day, only if you have not checked in yet'
                    : 'This browser cannot do web push'}
                </span>
              </span>
              <Switch
                disabled={!pushSupported()}
                {...register('push_enabled', {
                  onChange: (event: ChangeEvent<HTMLInputElement>) =>
                    void togglePush(event.target.checked),
                })}
              />
            </label>
          </Section>

          <Section n={5} icon="route" title="Threads">
            <label
              htmlFor="stale-days"
              className="flex items-baseline justify-between gap-3 text-body-medium"
            >
              Call a thread stale after{' '}
              <span className="tabular text-title-md text-accent-ink">{staleDays} days</span>
            </label>
            <input
              id="stale-days"
              type="range"
              min={7}
              max={30}
              step={1}
              {...register('stale_days', { valueAsNumber: true })}
              className="h-11 w-full accent-accent"
            />
            <p className="text-caption text-muted">
              Started work left untouched for longer than this is marked stale.
            </p>
          </Section>

          <Section n={6} icon="database" title="Data">
            <p className="text-body">Your data lives in your account — export anytime.</p>
            <p className="mt-1 text-caption text-muted">
              One JSON file with every area, project, task, log, XP event and badge you own.
            </p>
            <Button
              type="button"
              variant="ghost"
              block
              className="mt-4"
              onClick={exportData}
              disabled={exporting}
            >
              <Icon name="download" /> {exporting ? 'Preparing…' : 'Export my data'}
            </Button>

            <hr className="my-4 border-line" />

            <p className="mb-3 text-caption text-muted">
              Deleting your account removes every row above. It is not self-service yet — email
              support and it is done by hand, after you export.
            </p>
            <Button
              type="button"
              variant="danger"
              block
              onClick={() => void stopThenSignOut(stopAllTimers, () => supabase.auth.signOut())}
            >
              <Icon name="logout" /> Sign out
            </Button>
          </Section>
        </div>
      </div>
    </form>
  )
}

const labelClass = 'mb-1 block text-body-medium'

/** Numbered settings card. The number is visual only: the heading's name stays the word. */
function Section({
  n,
  icon,
  title,
  children,
}: {
  n: number
  icon: IconName
  title: string
  children: ReactNode
}) {
  return (
    <Card className="md:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-title-md">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-accent-ink"
        >
          <Icon name={icon} className="icon-xl" />
        </span>
        <span>
          <span aria-hidden className="mr-1.5 tabular text-muted">
            {n}.
          </span>
          {title}
        </span>
      </h2>
      {children}
    </Card>
  )
}

/**
 * A checkbox drawn as a switch: still `<input type="checkbox">` underneath (same role and form
 * value as before), invisible but stretched over the track so it takes the clicks. Opacity hides
 * the input's own focus outline too, so the track redraws it on `peer-focus-visible` — same
 * colour, width and offset as the global :focus-visible rule. Off is a muted outline (≥3:1 on
 * both surfaces), on is filled accent; the 44px hit area is the whole label row around it.
 */
const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Switch(props, ref) {
    return (
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          {...props}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className="pointer-events-none h-full w-full rounded-full border-2 border-muted bg-surface-sunken transition peer-checked:border-accent peer-checked:bg-accent forced-colors:border-[CanvasText] forced-colors:peer-checked:bg-[Highlight] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-muted transition peer-checked:translate-x-5 peer-checked:bg-paper forced-colors:bg-[CanvasText] forced-colors:peer-checked:bg-[HighlightText] peer-disabled:opacity-50"
        />
      </span>
    )
  },
)
