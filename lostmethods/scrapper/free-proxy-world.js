const axios = require("axios")
const cheerio = require("cheerio")
const utils = require("../lib/utils")

/**
 * @param {Function} reportProgress 
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function FreeProxyWorld(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0
  try {
    const baseUrl = "https://www.freeproxy.world/"
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    }
    const allProxies = new Set()
    let page = 1
    while (true) {
      const url = `${baseUrl}?type=&anonymity=&country=&speed=&port=&page=${page}`
      try {
        const response = await axios.get(url, { headers, timeout: 10000 })
        const proxies = extractProxyIPs(response.data)
        if (!proxies.length) {
          break
        }
        for (const proxy of proxies) {
          if (!allProxies.has(proxy)) {
            allProxies.add(proxy)
          }
        }
        page++
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (error) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }
    }
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)
      try {
        const isValid = await utils.validateProxy(proxy)

        if (isValid) {
          valid++
          const isIndo = await utils.isIndonesianProxy(proxy)

          if (isIndo) {
            indo++
            await utils.writeProxy(proxy, true)
          } else {
            await utils.writeProxy(proxy, false)
          }
        }
      } catch (error) {
      }
    }
  } catch (error) {
  }

  return { total, valid, indo }
}

/**
 * @param {string} html
 * @returns {string[]}
 */
function extractProxyIPs(html) {
  const $ = cheerio.load(html)
  const proxies = []

  $("td.show-ip-div").each((index, element) => {
    const ip = $(element).text().trim()
    const port = $(element).next().text().trim()

    if (ip && port) {
      proxies.push(`${ip}:${port}`)
    }
  })

  return proxies
}

module.exports = FreeProxyWorld
