/**
 * Utilities for handling URLs in queries
 */

/**
 * Validates and normalizes a URL string
 * @param urlStr The URL string to validate
 * @returns The normalized URL if valid, null otherwise
 */
function validateUrl(urlStr: string): string | null {
  // Remove whitespace
  urlStr = urlStr.trim()

  // Handle site: prefix
  if (urlStr.startsWith('site:')) {
    urlStr = urlStr.substring(5).trim()
  }

  // Basic URL validation
  try {
    const url = new URL(urlStr)
    // Only allow http/https protocols
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // Additional validation: require at least one dot in hostname
      // This prevents things like "artificial" becoming "https://artificial/"
      if (url.hostname.includes('.')) {
        return url.toString()
      }
    }
  } catch {
    // Not a valid URL
  }

  // Try adding https:// if no protocol and contains a dot
  if (!urlStr.includes('://') && urlStr.includes('.')) {
    try {
      const url = new URL('https://' + urlStr)
      // Additional validation: require at least one dot in hostname
      if (url.hostname.includes('.')) {
        return url.toString()
      }
    } catch {
      // Not a valid URL
    }
  }

  return null
}

/**
 * Extracts URLs from a query string that may contain multiple URLs
 * @param query The query string that may contain URLs
 * @returns Array of extracted URLs
 */
export function extractUrls(query: string): string[] {
  // Split query by common delimiters
  const parts = query.split(/[\n,\s]+/)
  
  // Extract and validate URLs
  const urls = parts
    .map(part => validateUrl(part))
    .filter((url): url is string => url !== null)

  return [...new Set(urls)] // Remove duplicates
}

/**
 * Extracts a single URL from a query string
 * @param query The query string that may contain a URL
 * @returns The extracted URL if found, null otherwise
 * @deprecated Use extractUrls instead for better multi-URL support
 */
export function extractUrl(query: string): string | null {
  const urls = extractUrls(query)
  return urls.length > 0 ? urls[0] : null
}

/**
 * Checks if a query string contains any URLs
 * @param query The query string to check
 * @returns True if the query contains at least one URL
 */
export function isUrlQuery(query: string): boolean {
  return extractUrls(query).length > 0
}

/**
 * Checks if a query string contains multiple URLs
 * @param query The query string to check
 * @returns True if the query contains more than one URL
 */
export function isMultiUrlQuery(query: string): boolean {
  return extractUrls(query).length > 1
}
