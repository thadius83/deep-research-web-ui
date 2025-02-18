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
      return url.toString()
    }
  } catch {
    // Not a valid URL
  }

  // Try adding https:// if no protocol
  if (!urlStr.includes('://')) {
    try {
      const url = new URL('https://' + urlStr)
      return url.toString()
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
  // Log the input query
  console.log('Extracting URLs from query:', query)

  // First try to find URLs using a pattern
  // Match URLs that might be in parentheses
  const urlPattern = /(?:\()?https?:\/\/[^\s"'<>)\]}]+(?:[^\s"'<>)\]}]|\([^\s"'<>)\]}]*\))*(?:[?#][^\s"'<>)\]}]+)?[.,]?/g
  const matches = query.match(urlPattern)
  console.log('URL pattern matches:', matches)

  if (matches) {
    // Extract and validate URLs
    const urls = matches
      .map(match => {
        // Remove any leading parenthesis
        // Remove leading parenthesis and trailing punctuation
        let cleanMatch = match.startsWith('(') ? match.substring(1) : match
        cleanMatch = cleanMatch.replace(/[.,]$/, '')
        const url = validateUrl(cleanMatch)
        console.log('Validating match:', { match, cleanMatch, url })
        return url
      })
      .filter((url): url is string => url !== null)

    const uniqueUrls = [...new Set(urls)] // Remove duplicates
    console.log('Extracted URLs:', uniqueUrls)
    return uniqueUrls
  }

  // Fallback: Try validating the entire query
  const url = validateUrl(query)
  console.log('Fallback validation:', { query, url })
  return url ? [url] : []
}

/**
 * Extracts a single URL from a query string
 * @param query The query string that may contain a URL
 * @returns The extracted URL if found, null otherwise
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
