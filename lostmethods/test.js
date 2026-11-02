// Simple test for AdvancedName scraper
const AdvancedName = require("./scrapper/advanced-name")

async function test() {
  console.log("Testing AdvancedName scraper...")
  console.log("AdvancedName type:", typeof AdvancedName)

  try {
    const result = await AdvancedName((count) => {
      if (count % 10 === 0) {
        console.log(`Processed ${count} proxies...`)
      }
    })

    console.log("Scraping completed!")
    console.log("Total proxies found:", result.total)
    console.log("Valid proxies:", result.valid)
    console.log("Indonesian proxies:", result.indo)
  } catch (error) {
    console.error("Error testing AdvancedName:", error)
  }
}

test()
