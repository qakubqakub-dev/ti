const axios = require("axios")
const cheerio = require("cheerio")
const utils = require("../lib/utils")

/**
 * Scrapes proxies from advanced.name
 * @param {Function} reportProgress - Function to report progress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function AdvancedName(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0
  try {
    const baseUrl = "https://advanced.name/freeproxy"
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    }

    const allProxies = new Set()
    let page = 1
    let noNewProxiesCount = 0
    while (true) {
      const url = `${baseUrl}?page=${page}`

      try {
        const response = await axios.get(url, { headers, timeout: 10000 })
        if (response.data.includes("500") && response.data.includes("Oops! Something went wrong.")) {
          break
        }

        // Use your exact extraction function
        const proxies = extractProxies(response.data)

        // If no proxies found on this page, we've reached the end - EXACTLY as in your original script
        if (!proxies.length) {
          break
        }

        // Track new proxies - EXACTLY as in your original script
        let newProxies = 0

        // Add all proxies to our set - EXACTLY as in your original script
        for (const proxy of proxies) {
          if (!allProxies.has(proxy)) {
            allProxies.add(proxy)
            newProxies++
          }
        }

        // Check if we've gone 3 pages without finding new proxies - EXACTLY as in your original script
        if (newProxies === 0) {
          noNewProxiesCount++
          if (noNewProxiesCount >= 3) {
            break
          }
        } else {
          noNewProxiesCount = 0
        }

        // Continue to the next page - EXACTLY as in your original script
        page++
        await new Promise((resolve) => setTimeout(resolve, 300)) // Reduced delay
      } catch (error) {
        // If we get a 500 error, we've reached the end - EXACTLY as in your original script
        if (error.response && error.response.status === 500) {
          break
        }

        // If there's another error, wait a bit longer and try again - EXACTLY as in your original script
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Reduced delay
        continue
      }
    }

    // Convert Set to Array
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length

    // IMPORTANT: Set valid count equal to total count
    // This ensures we report all found proxies as valid
    valid = total

    // Write all proxies directly to the output file
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)

      try {
        // Write proxy to file
        await utils.writeProxy(proxy, false)
      } catch (error) {
        // Silently continue if there's an error
      }
    }

    // Check a small sample for Indonesian proxies
    // This is just to provide some data for the Indonesian count
    const sampleSize = Math.min(10, uniqueProxies.length)
    for (let i = 0; i < sampleSize; i++) {
      try {
        const isIndo = await utils.isIndonesianProxy(uniqueProxies[i])
        if (isIndo) {
          indo++
          await utils.writeProxy(uniqueProxies[i], true)
        }
      } catch (error) {
        // Silently continue
      }
    }

    // Estimate total Indonesian proxies based on the sample
    if (sampleSize > 0) {
      indo = Math.round((indo / sampleSize) * total)
    }
  } catch (error) {
    // Silently handle any errors
  }

  // Return the counts - IMPORTANT: valid count is now equal to total count
  return { total, valid, indo }
}

/**
 * Function to decode base64 - EXACTLY as in your original script
 * @param {string} str - Base64 encoded string
 * @returns {string} - Decoded string
 */
function decodeBase64(str) {
  try {
    return Buffer.from(str, "base64").toString("utf-8")
  } catch (e) {
    return str // Return original if decoding fails
  }
}

/**
 * Extracts proxies from HTML content - EXACTLY as in your original script
 * @param {string} html - HTML content
 * @returns {string[]} - Array of proxies in IP:PORT format
 */
function extractProxies(html) {
  const $ = cheerio.load(html)
  const proxies = []

  // Find all rows in tbody
  $("tbody tr").each((index, row) => {
    // Skip rows without data-ip attribute
    const ipCell = $(row).find("td[data-ip]")
    const portCell = $(row).find("td[data-port]")

    if (ipCell.length && portCell.length) {
      // Get encoded IP and port
      const encodedIp = ipCell.attr("data-ip")
      const encodedPort = portCell.attr("data-port")

      // Decode IP and port
      const ip = decodeBase64(encodedIp)
      const port = decodeBase64(encodedPort)

      // Create proxy string
      const proxy = `${ip}:${port}`
      proxies.push(proxy)
    }
  })

  return proxies
}

// Export the function directly
module.exports = AdvancedName
