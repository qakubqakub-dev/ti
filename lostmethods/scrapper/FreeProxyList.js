const axios = require("axios");
const cheerio = require("cheerio");
const utils = require("../lib/utils");

const fetchFreeProxyList = async () => {
  try {
    console.log(`Fetching from Free Proxy List`);
    const startTime = Date.now();
    const axiosInstance = utils.createAxiosInstance(axios);

    const response = await axiosInstance.get("https://free-proxy-list.net/");
    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const proxyRows = $("div.table-responsive.fpl-list table tbody tr");
      let proxyCount = 0;
      const proxyList = [];
      proxyRows.each((i, row) => {
        const columns = $(row).find("td");
        if (columns.length >= 2) {
          const ip = $(columns[0]).text().trim();
          const port = $(columns[1]).text().trim();
          if (ip && port) {
            const proxyString = `${ip}:${port}`;
            proxyList.push(proxyString);
            proxyCount++;
          }
        }
      });
      const results = await utils.processProxies(proxyList);
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ Free Proxy List: Found ${proxyCount} proxies (${results.valid} valid, ${results.indo} Indonesian) in ${timeElapsed}s`,
      );
      return { total: proxyCount, valid: results.valid, indo: results.indo };
    } else {
      console.log(`❌ Failed to fetch proxies from Free Proxy List: Status ${response.status}`);
      return { total: 0, valid: 0, indo: 0 };
    }
  } catch (error) {
    console.error(`❌ Error fetching proxies from Free Proxy List:`, error.message);
    return { total: 0, valid: 0, indo: 0 };
  }
};

module.exports = fetchFreeProxyList;