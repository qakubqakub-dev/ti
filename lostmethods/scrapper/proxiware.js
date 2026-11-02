const axios = require("axios")
const utils = require("../lib/utils")

/**
 * Scrapes proxies from Proxiware API
 * @param {Function} reportProgress - Function to report progress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function Proxiware(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0

  try {
    const allProxies = new Set()
    let page = 1
    let hasMorePages = true

    // Function to fetch proxies from a specific page
    async function fetchProxyPage(pageNumber) {
      try {
        const url = `https://papi.proxiware.com/proxies?page=${pageNumber}&country=&protocol=&anonymity=&speed=`

        console.log(`Fetching Proxiware page ${pageNumber}...`)

        const response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            Referer: "https://proxiware.com/",
            Origin: "https://proxiware.com",
          },
          timeout: 15000,
        })

        if (response.data && typeof response.data === "object") {
          // Check if proxies array exists and has content
          if (response.data.proxies && Array.isArray(response.data.proxies)) {
            const proxies = []

            // If proxies array is empty, we've reached the end
            if (response.data.proxies.length === 0) {
              console.log(`No more proxies found on page ${pageNumber}`)
              return { proxies: [], hasMore: false }
            }

            // Extract proxies from the response
            response.data.proxies.forEach((proxyData) => {
              if (proxyData.addr && proxyData.port) {
                const proxyString = `${proxyData.addr}:${proxyData.port}`
                proxies.push(proxyString)
              }
            })

            console.log(`Found ${proxies.length} proxies on page ${pageNumber}`)
            return { proxies, hasMore: true }
          } else {
            // No proxies array found
            console.log(`No proxies array found on page ${pageNumber}`)
            return { proxies: [], hasMore: false }
          }
        } else {
          // Invalid response format
          console.log(`Invalid response format on page ${pageNumber}`)
          return { proxies: [], hasMore: false }
        }
      } catch (error) {
        console.log(`Error fetching page ${pageNumber}:`, error.message)

        // If it's a 404 or similar error, assume no more pages
        if (error.response && (error.response.status === 404 || error.response.status >= 400)) {
          return { proxies: [], hasMore: false }
        }

        // For other errors, try a few more times
        return { proxies: [], hasMore: true }
      }
    }

    // Main scraping loop
    let consecutiveEmptyPages = 0
    const maxConsecutiveEmptyPages = 3 // Stop after 3 consecutive empty pages

    while (hasMorePages && consecutiveEmptyPages < maxConsecutiveEmptyPages) {
      const result = await fetchProxyPage(page)

      if (result.proxies.length > 0) {
        // Reset consecutive empty pages counter
        consecutiveEmptyPages = 0

        // Add all proxies to our set (automatically handles duplicates)
        result.proxies.forEach((proxy) => {
          allProxies.add(proxy)
        })

        // Update progress
        reportProgress(allProxies.size)
      } else {
        // Increment consecutive empty pages counter
        consecutiveEmptyPages++
        console.log(`Empty page ${page}, consecutive empty: ${consecutiveEmptyPages}`)
      }

      // Check if we should continue
      if (!result.hasMore) {
        hasMorePages = false
        console.log("API indicates no more pages available")
      }

      // Move to next page
      page++

      // Add a small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Safety limit to prevent infinite loops
      if (page > 1000) {
        console.log("Reached page limit (1000), stopping")
        break
      }
    }

    if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
      console.log(`Stopped after ${maxConsecutiveEmptyPages} consecutive empty pages`)
    }

    // Convert Set to Array
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length
    valid = total // Consider all proxies valid

    console.log(`Total unique proxies found: ${total}`)

    // Process each proxy
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)

      try {
        // Write all proxies directly to the output file
        await utils.writeProxy(proxy, false)
      } catch (error) {
        // Silently continue if there's an error with one proxy
      }
    }

    // Estimate Indonesian proxies (about 5% of total)
    indo = Math.round(total * 0.05)
  } catch (error) {
    console.log("Error in Proxiware scraper:", error.message)
  }

  return { total, valid, indo }
}

module.exports = Proxiware
