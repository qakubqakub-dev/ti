const fs = require("fs")
const utils = require("../lib/utils")

/**
 * Scrapes proxies from IPRoyal
 * @param {Function} reportProgress - Function to report progress
 * @returns {Promise<{total: number, valid: number, indo: number}>}
 */
async function IPRoyal(reportProgress = () => {}) {
  let total = 0
  let valid = 0
  let indo = 0
  try {
    const authToken =
      "c07d9ce184008ff4be5ab6afa6a67a7513e5ece56e43b60ad1ddb0b86f952318e1ebebf54825bccb6191da8ad135cc29c963ce3f1c46dc4ad8364440333d6bee44ae20e3f0e63c29d3c5139c35f84b70d88b4e5de1e2f25cf07dca5d40fa5c0fa093490a5919e3269f2fa853776c59642c50b0cfc761c7f3943edd1908605661"
    async function fetchProxyPage(page, pageSize = 100) {
      const apiUrl = `https://cms.iproyal.com/api/free-proxy-records?fields[0]=ip&fields[1]=port&fields[2]=protocol&fields[3]=country&fields[4]=city&pagination[page]=${page}&pagination[pageSize]=${pageSize}`

      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            authorization: `Bearer ${authToken}`,
            origin: "https://iproyal.com",
            referer: "https://iproyal.com/",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }

        return await response.json()
      } catch (error) {
        return null
      }
    }
    function processPageData(data) {
      if (!data || !data.data || !Array.isArray(data.data)) {
        return []
      }
      const proxies = []
      data.data.forEach((record) => {
        let ip = ""
        let port = ""
        if (record.attributes) {
          ip = record.attributes.ip || ""
          port = record.attributes.port || ""
        } else {
          ip = record.ip || ""
          port = record.port || ""
        }

        if (ip && port) {
          proxies.push(`${ip}:${port}`)
        }
      })

      return proxies
    }
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
    const firstPageData = await fetchProxyPage(1, 100)
    let totalPages = 0

    if (firstPageData && firstPageData.meta && firstPageData.meta.pagination) {
      totalPages = firstPageData.meta.pagination.pageCount
    }

    if (totalPages === 0) {
      return { total: 0, valid: 0, indo: 0 }
    }
    const firstPageProxies = processPageData(firstPageData)
    const allProxies = new Set(firstPageProxies)
    const tasks = []
    for (let page = 2; page <= totalPages; page++) {
      tasks.push(async () => {
        const data = await fetchProxyPage(page, 100)
        if (data) {
          const pageProxies = processPageData(data)
          return pageProxies
        }
        return []
      })
    }
    const concurrency = 10
    const results = await concurrentLimit(tasks, concurrency)
    results.forEach((pageProxies) => {
      pageProxies.forEach((proxy) => {
        allProxies.add(proxy)
      })
    })
    const uniqueProxies = [...allProxies]
    total = uniqueProxies.length
    for (let i = 0; i < uniqueProxies.length; i++) {
      const proxy = uniqueProxies[i]
      reportProgress(i + 1)
      try {
        await utils.writeProxy(proxy, false)
        valid++
        if (i < 50) {
          const isIndo = await utils.isIndonesianProxy(proxy)

          if (isIndo) {
            indo++
            await utils.writeProxy(proxy, true)
          }
        }
      } catch (error) {
      }
    }
  } catch (error) {
  }

  return { total, valid, indo }
}

module.exports = IPRoyal
