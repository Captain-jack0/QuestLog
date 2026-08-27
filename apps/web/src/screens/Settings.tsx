import { useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useProfile } from '../features/gamification/queries'
import { downloadJson, fetchExportBundle, useUpdateProfile } from '../features/settings/queries'
import { timeZones } from '../features/settings/timezones'
import { ThemePicker } from '../features/settings/ThemePicker'
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../features/settings/push'
import { localDateKey } from '../lib/time'
import { profileSchema, type ProfileInput } from '../lib/schemas'

const field =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-accent'

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

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Settings</h1>

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={handleSubmit((values) =>
          updateProfile.mutate(values, {
            onSuccess: () => toast('Settings saved'),
            onError: (error) => toast(error.message, 'error'),
          }),
        )}
      >
        <Card>
          <h2 className="mb-3 font-semibold">Profile</h2>
          <p className="mb-3 text-sm text-muted">{session?.user.email}</p>

          <label htmlFor="display-name" className="mb-1 block text-sm font-medium">
            Display name
          </label>
          <input id="display-name" {...register('display_name')} className={field} />
          {errors.display_name && (
            <p className="mt-1 text-sm text-alert-ink">{errors.display_name.message}</p>
          )}

          <label htmlFor="timezone" className="mb-1 mt-3 block text-sm font-medium">
            Timezone
          </label>
          <select id="timezone" {...register('timezone')} className={field}>
            {timeZones(profile.data?.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Sets when your day rolls over for streaks, XP and the daily digest.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Notifications</h2>

          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span>Daily email digest</span>
            <input
              type="checkbox"
              {...register('digest_enabled')}
              className="h-6 w-6 accent-accent"
            />
          </label>

          <label htmlFor="digest-time" className="mb-1 mt-2 block text-sm font-medium">
            Digest time
          </label>
          <input id="digest-time" type="time" {...register('digest_time')} className={field} />
          {errors.digest_time && (
            <p className="mt-1 text-sm text-alert-ink">{errors.digest_time.message}</p>
          )}

          <label className="mt-3 flex min-h-[44px] items-center justify-between gap-3">
            <span>
              Push reminders
              <span className="block text-xs text-muted">
                {pushSupported()
                  ? 'A nudge later in the day, only if you have not checked in yet'
                  : 'This browser cannot do web push'}
              </span>
            </span>
            <input
              type="checkbox"
              disabled={!pushSupported()}
              {...register('push_enabled', {
                onChange: (event: ChangeEvent<HTMLInputElement>) =>
                  void togglePush(event.target.checked),
              })}
              className="h-6 w-6 accent-accent"
            />
          </label>

          <Button
            type="button"
            variant="ghost"
            block
            className="mt-3"
            disabled={sendingTest}
            onClick={sendTestDigest}
          >
            {sendingTest ? 'Sending…' : 'Send me a test digest'}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Appearance</h2>
          <ThemePicker />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Preferences</h2>
          <label htmlFor="stale-days" className="mb-1 block text-sm font-medium">
            Call a thread stale after <span className="tabular">{staleDays}</span> days
          </label>
          <input
            id="stale-days"
            type="range"
            min={7}
            max={30}
            step={1}
            {...register('stale_days', { valueAsNumber: true })}
            className="w-full accent-accent"
          />
          <p className="text-xs text-muted">Grooming a stale thread is worth 15 ✨.</p>
        </Card>

        <Button
          type="submit"
          block
          className="md:col-span-2"
          disabled={updateProfile.isPending || !isDirty}
        >
          {updateProfile.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Your data</h2>
          <p className="mb-3 text-sm text-muted">
            One JSON file with every area, project, task, log, XP event and badge you own.
          </p>
          <Button variant="ghost" block onClick={exportData} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Export my data'}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Account</h2>
          <p className="mb-3 text-sm text-muted">
            Deleting your account removes every row above. It is not self-service yet — email
            support and it is done by hand, after you export.
          </p>
          <Button variant="danger" block onClick={() => void supabase.auth.signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}
