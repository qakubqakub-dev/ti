const cloudscraper = require("cloudscraper")
const cheerio = require("cheerio")
const fs = require("fs").promises
const path = require("path")
const utils = require("../lib/utils")
const { CookieJar } = require("tough-cookie")

/**
 * Scrapes proxies from multiple sources without using Puppeteer
 * @param {Function} reportProgress - Progress reporting function
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function MultiSourceScraper(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0

  console.log("Starting Multi-Source Proxy Scraper...")
  const startTime = Date.now()

  // Create a cookie jar to store cookies between requests
  const cookieJar = new CookieJar()

  // Create a cloudscraper instance with advanced options
  const scraper = cloudscraper.defaults({
    jar: cookieJar,
    cloudflareMaxTimeout: 30000,
    followAllRedirects: true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
  })

  // Define proxy sources that don't use Cloudflare or have simpler protection
  const proxySources = [
    {
      name: "Free-Proxy-List",
      url: "https://free-proxy-list.net/",
      scraper: scrapeStandardTable,
    },
    {
      name: "SSL Proxies",
      url: "https://www.sslproxies.org/",
      scraper: scrapeStandardTable,
    },
    {
      name: "US Proxies",
      url: "https://www.us-proxy.org/",
      scraper: scrapeStandardTable,
    },
    {
      name: "Socks-Proxy",
      url: "https://www.socks-proxy.net/",
      scraper: scrapeStandardTable,
    },
    {
      name: "ProxyScrape",
      url: "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&proxy_format=ipport&format=text",
      scraper: scrapeRawText,
    },
    {
      name: "GeoNode",
      url: "https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&filterUpTime=90",
      scraper: scrapeGeoNode,
    },
    {
      name: "ProxyNova",
      url: "https://www.proxynova.com/proxy-server-list/",
      scraper: scrapeProxyNova,
    },
    {
      name: "SpysOne",
      url: "https://spys.one/en/free-proxy-list/",
      scraper: scrapeSpysOne,
    },
  ]

  const allProxies = new Set()

  // Try each proxy source
  for (const source of proxySources) {
    try {
      console.log(`Fetching proxies from ${source.name} (${source.url})...`)

      // Make the request
      const response = await scraper.get(source.url)

      // Extract proxies using the source-specific scraper
      const proxies = await source.scraper(response, source.url)

      console.log(`Found ${proxies.length} proxies from ${source.name}`)

      // Add to our collection
      proxies.forEach((proxy) => allProxies.add(proxy))

      // Add a delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000))
    } catch (error) {
      console.error(`Error fetching from ${source.name}: ${error.message}`)
    }
  }

  // Process all collected proxies
  const uniqueProxies = [...allProxies]
  total = uniqueProxies.length

  console.log(`Found ${total} unique proxies from all sources`)

  // Process each proxy
  for (let i = 0; i < uniqueProxies.length; i++) {
    const proxy = uniqueProxies[i]
    reportProgress(i + 1)

    try {
      if (utils.writeProxy) {
        await utils.writeProxy(proxy, false)
        valid++

        if (utils.isIndonesianProxy) {
          const isIndo = await utils.isIndonesianProxy(proxy)
          if (isIndo) {
            indo++
            await utils.writeProxy(proxy, true)
          }
        }
      } else {
        // Fallback if writeProxy is not available
        console.log(`Valid proxy: ${proxy}`)
        valid++
      }
    } catch (error) {
      console.error(`Error processing proxy ${proxy}: ${error.message}`)
    }
  }

  const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`✅ Multi-Source Scraper: Found ${total} proxies (${valid} valid, ${indo} Indonesian) in ${timeElapsed}s`)

  return { total, valid, indo }
}

/**
 * Scrape proxies from standard HTML tables
 * @param {string} html - HTML content
 * @returns {string[]} - Array of proxies
 */
function scrapeStandardTable(html) {
  const proxies = []
  const $ = cheerio.load(html)

  $("table tr").each((i, row) => {
    if (i === 0) return // Skip header row

    const cells = $(row).find("td")
    if (cells.length >= 2) {
      const ip = $(cells[0]).text().trim()
      const port = $(cells[1]).text().trim()

      if (isValidIp(ip) && isValidPort(port)) {
        proxies.push(`${ip}:${port}`)
      }
    }
  })

  return proxies
}

/**
 * Scrape proxies from raw text format
 * @param {string} text - Raw text content
 * @returns {string[]} - Array of proxies
 */
function scrapeRawText(text) {
  const lines = text.split(/\r?\n/)
  return lines
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false

      const [ip, port] = line.split(":")
      return isValidIp(ip) && isValidPort(port)
    })
}

/**
 * Scrape proxies from GeoNode API
 * @param {string} response - JSON response
 * @returns {string[]} - Array of proxies
 */
function scrapeGeoNode(response) {
  try {
    const data = JSON.parse(response)
    const proxies = []

    if (data && data.data && Array.isArray(data.data)) {
      data.data.forEach((item) => {
        if (item.ip && item.port) {
          proxies.push(`${item.ip}:${item.port}`)
        }
      })
    }

    return proxies
  } catch (error) {
    console.error("Error parsing GeoNode response:", error.message)
    return []
  }
}

/**
 * Scrape proxies from ProxyNova
 * @param {string} html - HTML content
 * @returns {string[]} - Array of proxies
 */
function scrapeProxyNova(html) {
  const proxies = []
  const $ = cheerio.load(html)

  $("table#tbl_proxy_list tbody tr").each((i, row) => {
    try {
      // ProxyNova uses JavaScript to decode IPs, so we need to extract from the script
      const ipScript = $(row).find("td").eq(0).find("script").html()
      const portText = $(row).find("td").eq(1).text().trim()

      if (ipScript && portText) {
        // Try to extract the IP from the script
        const ipMatch = ipScript.match(/document\.write$$([^)]+)$$/)
        if (ipMatch && ipMatch[1]) {
          // Simplified extraction - in a real implementation, you'd need to evaluate the JS
          const ipParts = ipMatch[1].split("+")
          let ip = ""

          ipParts.forEach((part) => {
            const cleanPart = part.trim().replace(/'/g, "")
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanPart)) {
              ip = cleanPart
            }
          })

          if (ip && isValidIp(ip) && isValidPort(portText)) {
            proxies.push(`${ip}:${portText}`)
          }
        }
      }
    } catch (error) {
      // Skip this row if there's an error
    }
  })

  return proxies
}

/**
 * Scrape proxies from SpysOne
 * @param {string} html - HTML content
 * @returns {string[]} - Array of proxies
 */
function scrapeSpysOne(html) {
  const proxies = []
  const $ = cheerio.load(html)

  // SpysOne has a complex structure, so we'll use a generic approach
  const ipPortRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/g
  const htmlText = $.html()

  let match
  while ((match = ipPortRegex.exec(htmlText)) !== null) {
    const ip = match[1]
    const port = match[2]

    if (isValidIp(ip) && isValidPort(port)) {
      proxies.push(`${ip}:${port}`)
    }
  }

  return proxies
}

/**
 * Validate IP address
 * @param {string} ip - IP address
 * @returns {boolean} - True if valid
 */
function isValidIp(ip) {
  const parts = ip.split(".")
  if (parts.length !== 4) return false

  for (const part of parts) {
    const num = Number.parseInt(part)
    if (isNaN(num) || num < 0 || num > 255) return false
  }

  return true
}

/**
 * Validate port number
 * @param {string} port - Port number
 * @returns {boolean} - True if valid
 */
function isValidPort(port) {
  const num = Number.parseInt(port)
  return !isNaN(num) && num > 0 && num <= 65535
}

module.exports = MultiSourceScraper
