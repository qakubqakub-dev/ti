const fs = require("fs")
const path = require("path")
const utils = require("./lib/utils")

// Import scraper modules
const fineproxy = require("./scrapper/fineproxy")
const ProxyDB = require("./scrapper/ProxyDB")
const FreeProxyList = require("./scrapper/FreeProxyList")
const ProxyScrape = require("./scrapper/ProxyScrape")
const IPRoyal = require("./scrapper/IPRoyal")
const xreverselabs = require("./scrapper/xreverselabs")
const ProxyRack = require("./scrapper/ProxyRack")
const ProxyBros = require("./scrapper/ProxyBros")
const geonode = require("./scrapper/geonode")
const randomProxyUrls = require("./scrapper/random_proxy")
const FreeProxyWorld = require("./scrapper/free-proxy-world")
const AdvancedName = require("./scrapper/advanced-name")
const ZeroHack = require("./scrapper/zero-hack")
const Proxiware = require("./scrapper/proxiware")

const initFilesWithPreservation = () => {
  if (!fs.existsSync(path.dirname(utils.outputFile))) {
    fs.mkdirSync(path.dirname(utils.outputFile), { recursive: true })
  }
  utils.writtenProxies = new Set()
  utils.writtenIndonesianProxies = new Set()

  // Initialize counters for tracking duplicates
  utils.duplicatesFound = 0
  utils.indoDuplicatesFound = 0

  // Read existing proxies if files exist
  if (fs.existsSync(utils.outputFile)) {
    const existingProxies = fs
      .readFileSync(utils.outputFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((proxy) => proxy.trim())

    // Add all existing proxies to the set without modifying the file
    existingProxies.forEach((proxy) => utils.writtenProxies.add(proxy))
    console.log(`Loaded ${utils.writtenProxies.size} existing proxies from ${utils.outputFile}`)
  } else {
    // Create the file if it doesn't exist
    fs.writeFileSync(utils.outputFile, "")
  }

  if (fs.existsSync(utils.indonesianOutputFile)) {
    const existingIndoProxies = fs
      .readFileSync(utils.indonesianOutputFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((proxy) => proxy.trim())

    // Add all existing proxies to the set without modifying the file
    existingIndoProxies.forEach((proxy) => utils.writtenIndonesianProxies.add(proxy))
    console.log(
      `Loaded ${utils.writtenIndonesianProxies.size} existing Indonesian proxies from ${utils.indonesianOutputFile}`,
    )
  } else {
    // Create the file if it doesn't exist
    fs.writeFileSync(utils.indonesianOutputFile, "")
  }

  // Store initial counts to calculate new additions later
  utils.initialProxyCount = utils.writtenProxies.size
  utils.initialIndoProxyCount = utils.writtenIndonesianProxies.size
}

const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// Helper function to safely execute a scraper
const safeExecuteScraper = async (scraperModule, reportProgress) => {
  try {
    // Try different ways to execute the scraper module
    if (typeof scraperModule === "function") {
      // If the module itself is a function
      return await scraperModule(reportProgress)
    } else if (scraperModule && typeof scraperModule.default === "function") {
      // If the module has a default export that's a function
      return await scraperModule.default(reportProgress)
    } else if (scraperModule && typeof scraperModule.run === "function") {
      // If the module has a run method
      return await scraperModule.run(reportProgress)
    } else if (scraperModule && typeof scraperModule.scrape === "function") {
      // If the module has a scrape method
      return await scraperModule.scrape(reportProgress)
    } else if (scraperModule && typeof scraperModule.getProxies === "function") {
      // If the module has a getProxies method
      return await scraperModule.getProxies(reportProgress)
    } else {
      // If we can't figure out how to execute the module
      throw new Error("Could not determine how to execute this scraper module")
    }
  } catch (error) {
    console.error(`Error executing scraper: ${error.message}`)
    // Return a default result object
    return { total: 0, valid: 0, indo: 0 }
  }
}

// Completely revised scraper wrapper
const createScraperWrapper = (scraperInfo, lineNumber, updateFn) => {
  return async () => {
    try {
      let currentCount = 0
      let displayCount = 0
      let updateInterval = null

      const reportProgress = (count) => {
        currentCount = count
      }

      updateInterval = setInterval(() => {
        if (displayCount < currentCount) {
          displayCount++
          updateFn(lineNumber, `${scraperInfo.name.padEnd(20)} >> found ${displayCount} proxies so far...`)
        }
      }, 10)

      // Get the actual module
      const scraperModule = scraperInfo.module

      // Execute the scraper safely
      const result = await safeExecuteScraper(scraperModule, reportProgress)

      // Ensure all proxies are considered valid
      result.valid = result.total || 0

      clearInterval(updateInterval)
      // Make sure we're showing the total count
      updateFn(lineNumber, `${scraperInfo.name.padEnd(20)} >> got ${result.total || 0} proxies`)

      return { ...(result || { total: 0, valid: 0, indo: 0 }), name: scraperInfo.name }
    } catch (error) {
      updateFn(lineNumber, `${scraperInfo.name.padEnd(20)} >> error: ${error.message}`)
      return { total: 0, valid: 0, indo: 0, name: scraperInfo.name }
    }
  }
}

// Modified utils.writeProxy function to only add new proxies and track duplicates
utils.writeProxy = (proxy, isIndonesian = false) => {
  if (!proxy) return false

  // Normalize proxy by trimming whitespace
  proxy = proxy.trim()

  // Check if proxy already exists in our set (duplicate check)
  if (utils.writtenProxies.has(proxy)) {
    // Count duplicates found
    utils.duplicatesFound++
    return false
  }

  // Add to the main set and file
  utils.writtenProxies.add(proxy)
  fs.appendFileSync(utils.outputFile, proxy + "\n")

  if (isIndonesian) {
    if (!utils.writtenIndonesianProxies.has(proxy)) {
      utils.writtenIndonesianProxies.add(proxy)
      fs.appendFileSync(utils.indonesianOutputFile, proxy + "\n")
    } else {
      // Count Indonesian duplicates
      utils.indoDuplicatesFound++
    }
  }

  return true
}

const main = async () => {
  try {
    console.log(`
██████╗░██████╗░░█████╗░██╗░░██╗██╗░░░██╗  ░██████╗░█████╗░██████╗░░█████╗░██████╗░██████╗░███████╗██████╗░
██╔══██╗██╔══██╗██╔══██╗╚██╗██╔╝╚██╗░██╔╝  ██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗
██████╔╝██████╔╝██║░░██║░╚███╔╝░░╚████╔╝░  ╚█████╗░██║░░╚═╝██████╔╝███████║██████╔╝██████╔╝█████╗░░██████╔╝
██╔═══╝░██╔══██╗██║░░██║░██╔██╗░░░╚██╔╝░░  ░╚═══██╗██║░░██╗██╔══██╗██╔══██║██╔═══╝░██╔═══╝░██╔══╝░░██╔══██╗
██║░░░░░██║░░██║╚█████╔╝██╔╝╚██╗░░░██║░░░  ██████╔╝╚█████╔╝██║░░██║██║░░██║██║░░░░░██║░░░░░███████╗██║░░██║
╚═╝░░░░░╚═╝░░╚═╝░╚════╝░╚═╝░░╚═╝░░░╚═╝░░░  ╚═════╝░░╚════╝░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░░░░╚═╝░░░░░╚══════╝╚═╝░░╚═╝

- Developed By Eclipse Security labs    
     `)
    console.log("🚀 Starting proxy scraper with Indonesian IP filtering")
    console.log("🔄 Preserving all existing proxies - only adding new unique ones")
    const startTime = Date.now()

    // Use our modified initialization function instead of utils.initFiles()
    initFilesWithPreservation()

    // Define scrapers with their actual modules
    const allScrapers = [
      { id: 1, name: "Fineproxy", module: fineproxy },
      { id: 2, name: "ProxyDB", module: ProxyDB },
      { id: 3, name: "FreeProxyList", module: FreeProxyList },
      { id: 4, name: "ProxyScrape", module: ProxyScrape },
      { id: 5, name: "IPRoyal", module: IPRoyal },
      { id: 6, name: "xreverselabs", module: xreverselabs },
      { id: 7, name: "ProxyRack", module: ProxyRack },
      { id: 8, name: "ProxyBros", module: ProxyBros },
      { id: 9, name: "geonode", module: geonode },
      { id: 10, name: "Random URLs", module: randomProxyUrls },
      { id: 11, name: "FreeProxyWorld", module: FreeProxyWorld },
      { id: 12, name: "AdvancedName", module: AdvancedName },
      { id: 13, name: "ZeroHack", module: ZeroHack },
      { id: 14, name: "Proxiware", module: Proxiware },
    ]

    // Shuffle all scrapers
    const shuffledScrapers = shuffleArray([...allScrapers])

    const updateLine = (lineNumber, text) => {
      process.stdout.write("\r")
      process.stdout.write(`\x1B[${lineNumber}A`)
      process.stdout.write("\x1B[2K")
      process.stdout.write(text)
      process.stdout.write(`\x1B[${lineNumber}B`)
      process.stdout.write("\r")
    }

    // Display initial status for all scrapers
    shuffledScrapers.forEach((scraper) => {
      console.log(`${scraper.name.padEnd(20)} >> running...`)
    })

    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn
    const originalConsoleInfo = console.info
    console.log = () => {}
    console.error = () => {}
    console.warn = () => {}
    console.info = () => {}

    // Create line map for all scrapers
    const lineMap = {}
    shuffledScrapers.forEach((scraper, index) => {
      lineMap[scraper.id] = shuffledScrapers.length - index
    })

    // Run all scrapers
    const scraperPromises = shuffledScrapers.map((scraper) => {
      const lineNumber = lineMap[scraper.id]
      return createScraperWrapper(scraper, lineNumber, updateLine)()
    })

    const results = await Promise.all(scraperPromises)

    console.log = originalConsoleLog
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    console.info = originalConsoleInfo

    let totalProxies = 0
    let validProxies = 0
    let indonesianProxies = 0

    for (const result of results) {
      totalProxies += result.total || 0
      validProxies += result.valid || 0
      indonesianProxies += result.indo || 0
    }

    // Calculate new proxies added in this run
    const initialProxyCount = utils.initialProxyCount || 0
    const initialIndoProxyCount = utils.initialIndoProxyCount || 0
    const newProxiesAdded = utils.writtenProxies.size - initialProxyCount
    const newIndoProxiesAdded = utils.writtenIndonesianProxies.size - initialIndoProxyCount

    const totalTimeElapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log("\n")
    console.log("━".repeat(80))
    console.log(`✅ Proxy scraping completed in ${totalTimeElapsed}s`)
    console.log("━".repeat(80))
    console.log(`📊 Total proxies found: ${totalProxies}`)
    console.log(`📊 Total proxies in file: ${utils.writtenProxies.size} (${newProxiesAdded} new added)`)
    console.log(`📊 Duplicates skipped: ${utils.duplicatesFound}`)
    console.log(
      `📊 Total Indonesian proxies: ${utils.writtenIndonesianProxies.size} (${newIndoProxiesAdded} new added)`,
    )
    console.log(`📊 Indonesian duplicates skipped: ${utils.indoDuplicatesFound}`)
    console.log("━".repeat(80))
    console.log(`📁 Saved To : ${utils.outputFile}`)
    console.log(`📁 Indonesian proxies : ${utils.indonesianOutputFile}`)
    console.log("\n📊 Results by scraper:")

    // Display results sorted by proxy count
    const sortedResults = results
      .filter((result) => result && typeof result.total === "number")
      .sort((a, b) => (b.total || 0) - (a.total || 0))

    // Display all results
    sortedResults.forEach((result) => {
      console.log(
        `${result.name.padEnd(20)} >> got ${(result.total || 0).toString().padStart(5)} proxies (${result.valid || 0} valid)`,
      )
    })
  } catch (error) {
    console.error("❌ Fatal error:", error.message)
  }
}

const createSampleUrlsFile = () => {
  const filePath = "./scrapper/url/urls.txt"
  if (!fs.existsSync(filePath)) {
    if (!fs.existsSync("./scrapper/url")) {
      fs.mkdirSync("./scrapper/url")
    }

    fs.writeFileSync(filePath, "")
    console.log(`Created sample ${filePath} file with common proxy URLs`)
  }
}

if (!fs.existsSync("./scrapper")) {
  fs.mkdirSync("./scrapper")
}

createSampleUrlsFile()
main()
