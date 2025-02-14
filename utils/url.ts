/**
 * Utilities for handling URLs in queries
 */

/**
 * Extracts a URL from a query string that may contain site: prefix
 * @param query The query string that may contain a URL
 * @returns The extracted URL if found, null otherwise
 */
export function extractUrl(query: string): string | null {
  // Remove whitespace
  query = query.trim()

  // Handle site: prefix
  if (query.startsWith('site:')) {
    query = query.substring(5).trim()
  }

  // Basic URL validation
  try {
    const url = new URL(query)
    // Only allow http/https protocols
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // Not a valid URL
  }

  // Try adding https:// if no protocol
  if (!query.includes('://')) {
    try {
      const url = new URL('https://' + query)
      return url.toString()
    } catch {
      // Not a valid URL
    }
  }

  return null
}

/**
 * Checks if a query string contains a URL
 * @param query The query string to check
 * @returns True if the query contains a URL
 */
export function isUrlQuery(query: string): boolean {
  return extractUrl(query) !== null
}
