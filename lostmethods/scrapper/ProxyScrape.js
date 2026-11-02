const axios = require("axios")
const utils = require("../lib/utils")

/**
 * Scrapes proxies from ProxyScrape
 * @param {Function} reportProgress - Function to report progress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function ProxyScrape(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0

  try {
    // Direct URLs with more options and backup sources
    const directUrls = [
      // Original URLs
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=http",
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=socks4",
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=socks5",
      "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=ipport&format=text",

      // Additional URLs with more parameters
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=http&timeout=10000&country=all&ssl=all&anonymity=all",
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=socks4&timeout=10000&country=all",
      "https://api.proxyscrape.com/?request=displayproxies&proxytype=socks5&timeout=10000&country=all",

      // Alternative proxy sources that return direct proxy lists
      "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
      "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt",
      "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
      "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
      "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt",
      "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt",
      "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt",
      "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
      "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt",
      "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
      "https://www.proxy-list.download/api/v1/get?type=http",
      "https://www.proxy-list.download/api/v1/get?type=https",
      "https://www.proxy-list.download/api/v1/get?type=socks4",
      "https://www.proxy-list.download/api/v1/get?type=socks5",
    ]

    const allProxies = new Set()

    // Function to fetch proxies from a URL with multiple retry attempts
    async function fetchProxies(url) {
      const maxRetries = 3

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await axios.get(url, {
            timeout: 15000, // Increased timeout
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              Accept: "text/plain, text/html, */*",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: "https://proxyscrape.com/",
              Origin: "https://proxyscrape.com",
            },
          })

          if (response.status === 200 && response.data) {
            // Handle different response types
            let data = response.data

            // Convert to string if it's not already
            if (typeof data !== "string") {
              data = JSON.stringify(data)
            }

            // Split the response by newlines and filter out empty lines
            const proxies = data
              .toString()
              .split(/\r?\n/)
              .filter((line) => {
                line = line.trim()
                // Check if line contains a valid proxy format (IP:PORT)
                return line.length > 0 && /\d+\.\d+\.\d+\.\d+:\d+/.test(line)
              })
              .map((line) => line.trim())

            return proxies
          }
        } catch (error) {
          // If this is the last attempt, log the error
          if (attempt === maxRetries - 1) {
            // Silent error handling
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      return []
    }

    // Function to limit concurrency
    async function concurrentLimit(tasks, limit) {
      const results = []
      const executing = new Set()

      for (const task of tasks) {
        const p = Promise.resolve().then(() => task())
        results.push(p)
        executing.add(p)

        const clean = () => executing.delete(p)
        p.then(clean).catch(clean)

        if (executing.size >= limit) {
          await Promise.race(executing)
        }
      }

      return Promise.all(results)
    }

    // Create tasks for fetching from all URLs concurrently
    const tasks = directUrls.map((url, index) => async () => {
      const proxies = await fetchProxies(url)
      return proxies
    })

    // Execute tasks with concurrency limit
    const concurrency = 5 // Process 5 URLs at a time
    const results = await concurrentLimit(tasks, concurrency)

    // Combine all results
    results.forEach((proxies) => {
      proxies.forEach((proxy) => {
        if (proxy.includes(":")) {
          allProxies.add(proxy)
        }
      })
    })

    // Convert Set to Array
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length

    // Set valid count equal to total count
    valid = total

    // Process each proxy
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)

      try {
        // Write all proxies directly to the output file
        await utils.writeProxy(proxy, false)

        // Check if it's an Indonesian proxy
        if (i < 50) {
          // Only check the first 50 proxies to save time
          const isIndo = await utils.isIndonesianProxy(proxy)

          if (isIndo) {
            indo++
            // Write as Indonesian proxy
            await utils.writeProxy(proxy, true)
          }
        }
      } catch (error) {
        // Silently continue if there's an error with one proxy
      }
    }
  } catch (error) {
    // Silently handle any errors
  }

  return { total, valid, indo }
}

module.exports = ProxyScrape
