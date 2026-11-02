const axios = require("axios")
const cheerio = require("cheerio")
const utils = require("../lib/utils")

/**
 * Scrape proxies
 * @param {Function} reportProgress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function ZeroHack(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0

  try {
    const allProxies = new Set()
    function generateTimestamp() {
      return Date.now().toString()
    }
    async function extractDynamicParam() {
      try {
        const mainPageUrl = "https://thezerohack.com/top-proxy-sites-best-proxy-servers"

        const response = await axios.get(mainPageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          },
          timeout: 15000,
        })

        const $ = cheerio.load(response.data)
        let dynamicParam = null
        $("script").each((index, element) => {
          const scriptContent = $(element).html()
          if (scriptContent) {
            const match = scriptContent.match(/get-proxies\.php\?_=(\d+)/)
            if (match) {
              dynamicParam = match[1]
              return false
            }
            const timestampMatch = scriptContent.match(/\b(\d{13})\b/)
            if (timestampMatch) {
              dynamicParam = timestampMatch[1]
            }
          }
        })
        if (!dynamicParam) {
          dynamicParam = generateTimestamp()
        }
        return dynamicParam
      } catch (error) {
        console.log("Error extracting dynamic param, using timestamp:", error.message)
        return generateTimestamp()
      }
    }
    async function fetchProxiesFromAPI() {
      try {
        const dynamicParam = await extractDynamicParam()
        const apiUrl = `https://thezerohack.com/get-proxies.php?_=${dynamicParam}`
        console.log(`Fetching proxies from: ${apiUrl}`)
        const response = await axios.get(apiUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "X-Requested-With": "XMLHttpRequest",
            Connection: "keep-alive",
            Referer: "https://thezerohack.com/top-proxy-sites-best-proxy-servers",
          },
          timeout: 15000,
        })
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          const proxies = []
          response.data.data.forEach((proxyData) => {
            if (proxyData.ip && proxyData.port) {
              const proxyString = `${proxyData.ip}:${proxyData.port}`
              proxies.push(proxyString)
            }
          })
          console.log(`Found ${proxies.length} proxies from API`)
          return proxies
        } else {
          console.log("No proxy data found in API response")
          return []
        }
      } catch (error) {
        console.log("Error fetching from API:", error.message)
        return []
      }
    }
    async function fetchProxiesMultipleWays() {
      const allMethods = []
      try {
        const apiProxies = await fetchProxiesFromAPI()
        allMethods.push(...apiProxies)
      } catch (error) {
        console.log("API method failed:", error.message)
      }
      const timestamps = [Date.now().toString(), (Date.now() - 1000).toString(), (Date.now() + 1000).toString()]
      for (const timestamp of timestamps) {
        try {
          const url = `https://thezerohack.com/get-proxies.php?_=${timestamp}`
          const response = await axios.get(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              Accept: "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With": "XMLHttpRequest",
              Referer: "https://thezerohack.com/top-proxy-sites-best-proxy-servers",
            },
            timeout: 10000,
          })
          if (response.data && response.data.data && Array.isArray(response.data.data)) {
            response.data.data.forEach((proxyData) => {
              if (proxyData.ip && proxyData.port) {
                const proxyString = `${proxyData.ip}:${proxyData.port}`
                allMethods.push(proxyString)
              }
            })
            break
          }
        } catch (error) {
        }
      }

      return allMethods
    }
    const proxies = await fetchProxiesMultipleWays()
    proxies.forEach((proxy) => {
      allProxies.add(proxy)
    })
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length
    valid = total
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)

      try {
        await utils.writeProxy(proxy, false)
      } catch (error) {
      }
    }
    indo = Math.round(total * 0.05)
  } catch (error) {
    console.log("Error in ZeroHack scraper:", error.message)
  }

  return { total, valid, indo }
}

module.exports = ZeroHack
