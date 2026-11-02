const axios = require("axios")
const cheerio = require("cheerio")
const utils = require("../lib/utils")
const fs = require("fs").promises

const scrapeHideMNProxies = async () => {
  try {
    console.log(`Fetching from Hide.mn`)
    const startTime = Date.now()
    const baseUrl = "https://hide.mn/en/proxy-list/"
    let startParam = 0
    let currentPage = 1
    let totalProxyCount = 0
    let validCount = 0
    let indoCount = 0
    let hasMorePages = true
    let emptyPagesCount = 0
    const maxEmptyPages = 3

    // Create axios instance with rotating user agents
    const axiosInstance = utils.createAxiosInstance(axios)

    // Add additional headers that might help bypass scraping protection
    axiosInstance.defaults.headers["Referer"] = "https://hide.mn/"
    axiosInstance.defaults.headers["Sec-Fetch-Dest"] = "document"
    axiosInstance.defaults.headers["Sec-Fetch-Mode"] = "navigate"
    axiosInstance.defaults.headers["Sec-Fetch-Site"] = "same-origin"
    axiosInstance.defaults.headers["Sec-Fetch-User"] = "?1"
    axiosInstance.defaults.headers["Upgrade-Insecure-Requests"] = "1"

    console.log("Fetching proxies page by page from hide.mn...\n")

    while (hasMorePages && emptyPagesCount < maxEmptyPages) {
      const url = startParam === 0 ? `${baseUrl}#list` : `${baseUrl}?start=${startParam}#list`

      console.log(`Processing page ${currentPage} (start=${startParam})...`)

      try {
        // Add a random delay between requests to avoid detection
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

        const response = await axiosInstance.get(url)
        const $ = cheerio.load(response.data)

        // Try multiple selectors to find the proxy table
        const tableSelectors = [
          ".table_block table",
          "table.proxy-list",
          "table.table",
          ".proxy-list table",
          "#proxy-table",
          "table.table-striped",
          "table", // Generic fallback
        ]

        let proxyTable
        let usedSelector = ""

        for (const selector of tableSelectors) {
          const tables = $(selector)
          if (tables.length > 0) {
            // If multiple tables found, try to identify the one with proxies
            for (let i = 0; i < tables.length; i++) {
              const table = tables.eq(i)
              const headerRow = table.find("tr").first()
              const headerCells = headerRow.find("th, td")

              // Check if this looks like a proxy table by examining headers
              const headerTexts = headerCells.map((_, cell) => $(cell).text().trim().toLowerCase()).get()

              if (
                headerTexts.some(
                  (text) =>
                    text.includes("ip") || text.includes("host") || text.includes("address") || text.includes("proxy"),
                )
              ) {
                proxyTable = table
                usedSelector = `${selector} (table ${i + 1})`
                break
              }
            }

            if (proxyTable) break

            // If we couldn't identify by headers, just take the first table
            proxyTable = tables.first()
            usedSelector = selector
            break
          }
        }

        if (!proxyTable) {
          console.log(`\nNo proxy table found on page ${currentPage}.`)

          // Save HTML for debugging
          try {
            await fs.writeFile(`hide_mn_page_${currentPage}.html`, response.data)
            console.log(`Saved HTML to hide_mn_page_${currentPage}.html for debugging`)
          } catch (err) {
            console.error(`Failed to save HTML: ${err.message}`)
          }

          emptyPagesCount++

          if (emptyPagesCount >= maxEmptyPages) {
            console.log(`\nReached ${maxEmptyPages} consecutive empty pages. Stopping.`)
            hasMorePages = false
            break
          }

          // Try to find pagination links anyway
          const nextPageLink = $('.pagination .next_array a, .pagination a:contains("Next")')
          if (nextPageLink.length > 0 && nextPageLink.attr("href")) {
            const href = nextPageLink.attr("href")
            const match = href.match(/start=(\d+)/)
            if (match && match[1]) {
              startParam = Number.parseInt(match[1], 10)
              currentPage++
              continue
            }
          }

          // If we can't find pagination, try incrementing by a standard amount
          startParam += 64 // Assuming 64 is the page size
          currentPage++
          continue
        }

        console.log(`Found proxy table using ${usedSelector}`)

        // Try to find rows in the table
        const rows = proxyTable.find("tr")

        if (rows.length <= 1) {
          // Only header row or empty
          console.log(`\nNo proxy rows found on page ${currentPage}.`)
          emptyPagesCount++

          if (emptyPagesCount >= maxEmptyPages) {
            console.log(`\nReached ${maxEmptyPages} consecutive empty pages. Stopping.`)
            hasMorePages = false
            break
          }

          // Try to find pagination links anyway
          const nextPageLink = $('.pagination .next_array a, .pagination a:contains("Next")')
          if (nextPageLink.length > 0 && nextPageLink.attr("href")) {
            const href = nextPageLink.attr("href")
            const match = href.match(/start=(\d+)/)
            if (match && match[1]) {
              startParam = Number.parseInt(match[1], 10)
              currentPage++
              continue
            }
          }

          startParam += 64
          currentPage++
          continue
        }

        emptyPagesCount = 0
        const pageProxies = []

        // Debug: Print the structure of the first row
        if (rows.length > 1) {
          const firstRow = rows.eq(1) // Skip header row
          const cells = firstRow.find("td")
          console.log(`First row has ${cells.length} cells`)

          if (cells.length >= 2) {
            console.log(`First cell: "${cells.eq(0).text().trim()}"`)
            console.log(`Second cell: "${cells.eq(1).text().trim()}"`)
          }
        }

        // Skip the first row (header)
        for (let i = 1; i < rows.length; i++) {
          const row = rows.eq(i)
          const cells = row.find("td")

          if (cells.length < 2) continue

          // Multiple extraction methods

          // Method 1: Direct text extraction
          let ip = cells.eq(0).text().trim()
          let port = cells.eq(1).text().trim()

          // Method 2: Look for data attributes
          if (!ip || !port) {
            ip = cells.eq(0).attr("data-ip") || row.attr("data-ip")
            port = cells.eq(1).attr("data-port") || row.attr("data-port")
          }

          // Method 3: Check for obfuscated content
          if (!ip || !port) {
            // Some sites use JavaScript to decode the IP/port
            // Try to find any encoded data
            const script = row.find("script").text()
            if (script) {
              const ipMatch = script.match(/ip\s*=\s*['"]([^'"]+)['"]/)
              const portMatch = script.match(/port\s*=\s*['"]?(\d+)['"]?/)

              if (ipMatch) ip = ipMatch[1]
              if (portMatch) port = portMatch[1]
            }
          }

          // Method 4: Check for IP:Port in a single cell
          if ((!ip || !port) && cells.length > 0) {
            const fullText = row.text().trim()
            const ipPortMatch = fullText.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/)
            if (ipPortMatch) {
              ip = ipPortMatch[1]
              port = ipPortMatch[2]
            }
          }

          // Clean and validate
          if (ip && port) {
            const proxy = `${ip}:${port}`
            if (utils.isValidProxy(proxy)) {
              pageProxies.push(proxy)
            }
          }
        }

        if (pageProxies.length === 0) {
          console.log(`\nNo valid proxies extracted on page ${currentPage}.`)
          emptyPagesCount++

          if (emptyPagesCount >= maxEmptyPages) {
            console.log(`\nReached ${maxEmptyPages} consecutive empty pages. Stopping.`)
            hasMorePages = false
            break
          }
        } else {
          const results = await utils.processProxies(pageProxies)
          totalProxyCount += pageProxies.length
          validCount += results.valid
          indoCount += results.indo
          console.log(
            `Page ${currentPage}: Found ${pageProxies.length} proxies (${results.valid} valid, ${results.indo} Indonesian)`,
          )
        }

        // Find pagination links
        const nextPageLink = $('.pagination .next_array a, .pagination a:contains("Next")')
        if (nextPageLink.length > 0 && nextPageLink.attr("href")) {
          const href = nextPageLink.attr("href")
          const match = href.match(/start=(\d+)/)
          if (match && match[1]) {
            startParam = Number.parseInt(match[1], 10)
            currentPage++
          } else {
            // If we can't find the start parameter, try to increment by a fixed amount
            startParam += 64
            currentPage++
          }
        } else {
          // Check if there are any pagination links
          const paginationLinks = $(".pagination a")
          if (paginationLinks.length === 0) {
            console.log(`No pagination found. This might be the only page.`)
            hasMorePages = false
          } else {
            // Try to increment by a fixed amount
            startParam += 64
            currentPage++
          }
        }
      } catch (error) {
        console.error(`\nError processing page ${currentPage}:`, error.message)

        try {
          console.log(`Retrying page ${currentPage} after a delay...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))

          // Update user agent for retry
          axiosInstance.defaults.headers["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"

          const response = await axiosInstance.get(url, { timeout: 30000 })

          // Try to find pagination links
          const $ = cheerio.load(response.data)
          const nextPageLink = $('.pagination .next_array a, .pagination a:contains("Next")')
          if (nextPageLink.length > 0 && nextPageLink.attr("href")) {
            const href = nextPageLink.attr("href")
            const match = href.match(/start=(\d+)/)
            if (match && match[1]) {
              startParam = Number.parseInt(match[1], 10)
              currentPage++
              continue
            }
          }

          // If we can't find pagination, try to increment by a fixed amount
          startParam += 64
          currentPage++
        } catch (retryError) {
          console.error(`Retry failed for page ${currentPage}:`, retryError.message)
          emptyPagesCount++

          if (emptyPagesCount >= maxEmptyPages) {
            console.log(`\nReached ${maxEmptyPages} consecutive error/empty pages. Stopping.`)
            hasMorePages = false
            break
          }

          // Try to increment by a fixed amount
          startParam += 64
          currentPage++
        }
      }
    }

    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(
      `✅ Hide.mn: Found ${totalProxyCount} proxies (${validCount} valid, ${indoCount} Indonesian) in ${timeElapsed}s`,
    )
    return { total: totalProxyCount, valid: validCount, indo: indoCount }
  } catch (error) {
    console.error(`❌ Error fetching proxies from Hide.mn:`, error.message)
    return { total: 0, valid: 0, indo: 0 }
  }
}

module.exports = scrapeHideMNProxies
