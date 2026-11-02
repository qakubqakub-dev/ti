const axios = require("axios")
const cheerio = require("cheerio")
const utils = require("../lib/utils")

/**
 * Scrapes proxies from ProxyElite.info
 * @param {Function} reportProgress - Function to report progress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function ProxyElite(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0

  console.log("Starting to scrape ProxyElite.info...")
  const startTime = Date.now()

  try {
    // Create an axios instance with proper headers and timeout
    const axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })

    const mainPageUrl = "https://proxyelite.info/free-proxy-list/"
    console.log(`Fetching main page: ${mainPageUrl}`)

    const mainPageResponse = await axiosInstance.get(mainPageUrl)
    const mainPageHtml = mainPageResponse.data

    // Extract nonce from proxylister_ajax JavaScript variable
    const proxyAjaxRegex = /var\s+proxylister_ajax\s*=\s*(\{[^}]*\})/
    const proxyAjaxMatch = mainPageHtml.match(proxyAjaxRegex)

    let nonce = null
    if (proxyAjaxMatch && proxyAjaxMatch[1]) {
      const nonceRegex = /"nonce"\s*:\s*"([^"]+)"/
      const nonceMatch = proxyAjaxMatch[1].match(nonceRegex)
      if (nonceMatch && nonceMatch[1]) {
        nonce = nonceMatch[1]
        console.log(`Found nonce in proxylister_ajax: ${nonce}`)
      }
    }

    // Fallback methods if the primary method fails
    if (!nonce) {
      console.log("Could not find nonce in proxylister_ajax, trying alternative methods...")

      // Method 2: Direct regex on the entire HTML
      const directNonceRegex = /proxylister_ajax\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"/
      const directMatch = mainPageHtml.match(directNonceRegex)
      if (directMatch && directMatch[1]) {
        nonce = directMatch[1]
        console.log(`Found nonce with direct regex: ${nonce}`)
      }
    }

    if (!nonce) {
      // Method 3: Look for any nonce in the page
      const anyNonceRegex = /"nonce"\s*:\s*"([^"]+)"/g
      let match
      while ((match = anyNonceRegex.exec(mainPageHtml)) !== null) {
        nonce = match[1]
        console.log(`Found potential nonce: ${nonce}`)
        break
      }
    }

    if (!nonce) {
      console.error("Could not find nonce value. Aborting.")
      return { total, valid, indo }
    }

    // Find total proxies count
    const $ = cheerio.load(mainPageHtml)
    let totalProxiesCount = 0

    // Try multiple ways to find the total proxies count
    $("p, div, span").each((i, el) => {
      const text = $(el).text()
      if (text.includes("Proxies online:") || text.includes("proxies online")) {
        const strongText = $(el).find("strong").text().trim()
        const match = text.match(/(\d+)\s*proxies\s*online/i) || text.match(/Proxies\s*online:\s*(\d+)/i)

        if (strongText && !isNaN(Number.parseInt(strongText))) {
          totalProxiesCount = Number.parseInt(strongText)
          console.log(`Found total proxies count in strong tag: ${totalProxiesCount}`)
        } else if (match && match[1] && !isNaN(Number.parseInt(match[1]))) {
          totalProxiesCount = Number.parseInt(match[1])
          console.log(`Found total proxies count in text: ${totalProxiesCount}`)
        }
      }
    })

    if (totalProxiesCount === 0) {
      console.log("Could not find total proxies count, defaulting to 200")
      totalProxiesCount = 200 // Default if we can't find the count
    }

    const ajaxUrl = "https://proxyelite.info/wp-admin/admin-ajax.php"
    const allProxies = []

    let totalPages = Math.ceil(totalProxiesCount / 20) || 10
    totalPages = Math.min(totalPages, 60) // Limit to 60 pages to avoid excessive requests

    console.log(`Will fetch ${totalPages} pages of proxies`)

    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    const batchSize = 3 // Reduced batch size to avoid rate limiting

    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      const batch = pageNumbers.slice(i, i + batchSize)
      console.log(`Fetching batch of pages: ${batch.join(", ")}`)

      const batchPromises = batch.map((page) => fetchPage(page, ajaxUrl, nonce, mainPageUrl, axiosInstance))
      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value && result.value.length) {
          console.log(`Page ${batch[index]}: Found ${result.value.length} proxies`)
          allProxies.push(...result.value)
        } else {
          console.log(`Page ${batch[index]}: Failed or no proxies found`)
          if (result.reason) {
            console.error(`Error: ${result.reason.message}`)
          }
        }
      })

      // Add a longer delay between batches to avoid rate limiting
      if (i + batchSize < pageNumbers.length) {
        const delay = 1000 + Math.random() * 2000
        console.log(`Waiting ${Math.round(delay)}ms before next batch...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Filter out duplicates and invalid formats
    const uniqueProxies = [...new Set(allProxies)].filter((proxy) => {
      // Basic validation before processing
      const [ip, port] = proxy.split(":")
      return ip && port && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && /^\d+$/.test(port)
    })

    total = uniqueProxies.length
    console.log(`Found ${total} unique proxies after filtering`)

    // Process proxies in smaller batches to avoid overwhelming the system
    const proxyBatchSize = 50
    for (let i = 0; i < uniqueProxies.length; i += proxyBatchSize) {
      const proxyBatch = uniqueProxies.slice(i, i + proxyBatchSize)

      for (let j = 0; j < proxyBatch.length; j++) {
        const proxy = proxyBatch[j]
        const overallIndex = i + j
        reportProgress(overallIndex + 1)

        try {
          // Validate and write the proxy
          if (utils.isValidProxy && !utils.isValidProxy(proxy)) {
            continue
          }

          await utils.writeProxy(proxy, false)
          valid++

          // Check if it's an Indonesian proxy
          const isIndo = await utils.isIndonesianProxy(proxy)
          if (isIndo) {
            indo++
            await utils.writeProxy(proxy, true)
          }
        } catch (error) {
          console.error(`Error processing proxy ${proxy}: ${error.message}`)
        }
      }

      // Add a small delay between batches
      if (i + proxyBatchSize < uniqueProxies.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ ProxyElite.info: Found ${total} proxies (${valid} valid, ${indo} Indonesian) in ${timeElapsed}s`)
  } catch (error) {
    console.error(`❌ Error scraping ProxyElite.info: ${error.message}`)
    if (error.response) {
      console.error(
        `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data).substring(0, 200)}...`,
      )
    }
  }

  return { total, valid, indo }
}

/**
 * Fetches a single page of proxies
 */
async function fetchPage(page, ajaxUrl, nonce, mainPageUrl, axiosInstance) {
  try {
    console.log(`Fetching page ${page}...`)

    const postData = new URLSearchParams()
    postData.append("action", "proxylister_load_more")
    postData.append("nonce", nonce)
    postData.append("page", page)
    postData.append("atts[downloads]", "true")

    const response = await axiosInstance.post(ajaxUrl, postData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://proxyelite.info",
        Referer: mainPageUrl,
        "X-Requested-With": "XMLHttpRequest",
      },
    })

    if (response.data && response.data.success && response.data.data && response.data.data.rows) {
      const htmlContent = response.data.data.rows
      return extractProxies(htmlContent)
    } else {
      console.log(`Page ${page}: Invalid response format`)
      console.log(`Response: ${JSON.stringify(response.data).substring(0, 200)}...`)
      return []
    }
  } catch (error) {
    console.error(`Error fetching page ${page}: ${error.message}`)
    throw error // Re-throw to be caught by Promise.allSettled
  }
}

/**
 * Extracts proxies from HTML content using multiple methods
 */
function extractProxies(htmlContent) {
  const proxies = []

  // Method 1: Using regex to extract IP:Port
  const ipPortRegex = /<td[^>]*class="[^"]*table-ip[^"]*"[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/g
  let match

  while ((match = ipPortRegex.exec(htmlContent)) !== null) {
    const ip = match[1].trim()
    const port = match[2].trim()
    if (ip && port) {
      const proxy = `${ip}:${port}`
      proxies.push(proxy)
    }
  }

  // Method 2: Using cheerio if regex didn't find anything
  if (proxies.length === 0) {
    try {
      const $ = cheerio.load(htmlContent)

      // Try different selectors
      $("tr").each((i, row) => {
        const cells = $(row).find("td")
        if (cells.length >= 2) {
          let ip = null
          let port = null

          // Try to find IP cell
          cells.each((j, cell) => {
            const cellClass = $(cell).attr("class") || ""
            const cellText = $(cell).text().trim()

            if (cellClass.includes("ip") || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cellText)) {
              ip = cellText
            } else if (/^\d+$/.test(cellText) && Number.parseInt(cellText) > 0 && Number.parseInt(cellText) <= 65535) {
              port = cellText
            }
          })

          if (ip && port) {
            const proxy = `${ip}:${port}`
            proxies.push(proxy)
          }
        }
      })
    } catch (error) {
      console.error(`Error parsing HTML with cheerio: ${error.message}`)
    }
  }

  // Method 3: Generic IP:Port pattern matching
  if (proxies.length === 0) {
    const genericIpPortRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/g
    let genericMatch

    while ((genericMatch = genericIpPortRegex.exec(htmlContent)) !== null) {
      const ip = genericMatch[1]
      const port = genericMatch[2]
      if (ip && port) {
        const proxy = `${ip}:${port}`
        proxies.push(proxy)
      }
    }
  }

  return proxies
}

module.exports = ProxyElite
