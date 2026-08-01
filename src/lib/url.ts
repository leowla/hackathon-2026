const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Turns loose user input into a well-formed absolute URL.
 * Returns null when the input can't be read as an http(s) URL.
 *
 * `example.com` -> `https://example.com/`
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

  return parsed.href
}

export function isValidUrl(input: string): boolean {
  return normalizeUrl(input) !== null
}
