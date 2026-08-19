/**
 * Timezone options for the settings picker.
 *
 * The platform list is authoritative but not exhaustive — Chrome, for one, omits plain
 * "UTC", which is exactly the value new profiles are created with. A stored zone that is
 * missing from the list renders as a blank select and blocks saving, so the current value
 * is always folded in.
 */
export function timeZones(current?: string | null): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const platform = intl.supportedValuesOf?.('timeZone') ?? []

  const zones = new Set<string>(platform.length ? platform : [local])
  zones.add('UTC')
  if (current) zones.add(current)
  return [...zones].sort()
}
