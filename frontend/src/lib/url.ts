const ALLOWED_PROTOCOLS = ['http:', 'https:']
const DEFAULT_TLD = 'com'

/** Hosts that are legitimately dotless — don't glue a TLD onto these. */
const DOTLESS_HOSTS = ['localhost']
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Turns loose user input into a well-formed absolute URL.
 * Returns null when the input can't be read as an http(s) URL.
 *
 * `example.com`         -> `https://example.com`
 * `google`              -> `https://google.com`
 * `javascript:alert(1)` -> null
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // No scheme means the user typed a bare host, so assume https.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null
  // `https://` alone parses fine but has no host.
  if (!parsed.hostname) return null

  // A host with no dot is missing its TLD, so assume .com. IP literals and
  // localhost are dotless on purpose and must be left alone.
  if (needsTld(parsed.hostname)) {
    parsed.hostname = `${parsed.hostname}.${DEFAULT_TLD}`
  }

  return tidy(parsed)
}

export function isValidUrl(input: string): boolean {
  return normalizeUrl(input) !== null
}

function needsTld(hostname: string): boolean {
  if (hostname.includes('.')) return false
  if (DOTLESS_HOSTS.includes(hostname.toLowerCase())) return false
  // IPv6 literals arrive bracketed, e.g. `[::1]`.
  if (hostname.startsWith('[')) return false
  return !IPV4.test(hostname)
}

/**
 * `URL.href` expands an empty path to `/`, which reads as noise on a bare
 * domain. Drop that slash, but only when there's genuinely no path.
 */
function tidy(parsed: URL): string {
  const isBareHost = parsed.pathname === '/' && !parsed.search && !parsed.hash
  return isBareHost ? parsed.href.replace(/\/$/, '') : parsed.href
}
