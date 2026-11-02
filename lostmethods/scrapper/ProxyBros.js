const axios = require("axios");
const cheerio = require("cheerio");
const utils = require("../lib/utils");

const fetchProxyBrosProxies = async () => {
  try {
    console.log(`Fetching from ProxyBros`);
    const startTime = Date.now();
    let page = 1;
    let hasMoreData = true;
    let totalProxyCount = 0;
    let totalValidCount = 0;
    let totalIndoCount = 0;
    const axiosInstance = utils.createAxiosInstance(axios);
    
    while (hasMoreData) {
      const url = `https://proxybros.com/free-proxy-list/${page}/`;
      console.log(`Fetching page ${page} from ProxyBros`);
      
      try {
        const response = await axiosInstance.get(url);
        if (response.status === 200 && response.data) {
          const $ = cheerio.load(response.data);
          const proxyRows = $("table.proxylist-table tbody tr");
          
          if (proxyRows.length === 0) {
            hasMoreData = false;
            console.log(`No more proxies found on page ${page}`);
            break;
          }
          
          let pageProxyCount = 0;
          let pageValidCount = 0;
          let pageIndoCount = 0;
          
          proxyRows.each((i, row) => {
            const ip = $(row).find("span.proxy-ip").text().trim();
            const port = $(row).find("td[data-port]").text().trim();
            
            if (ip && port) {
              const proxyString = `${ip}:${port}`;
              pageProxyCount++;
              
              if (utils.isValidProxy(proxyString)) {
                pageValidCount++;
                if (!utils.uniqueProxies.has(proxyString)) {
                  utils.uniqueProxies.add(proxyString);
                  if (utils.isIndonesianIP(ip)) {
                    pageIndoCount++;
                    if (!utils.uniqueIndonesianProxies.has(proxyString)) {
                      utils.uniqueIndonesianProxies.add(proxyString);
                    }
                  }
                }
              }
            }
          });
          
          await utils.writeProxiesToFile();
          totalProxyCount += pageProxyCount;
          totalValidCount += pageValidCount;
          totalIndoCount += pageIndoCount;
          
          console.log(
            `✅ ProxyBros page ${page}: Found ${pageProxyCount} proxies (${pageValidCount} valid, ${pageIndoCount} Indonesian)`,
          );
          
          if (pageProxyCount > 0) {
            page++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            hasMoreData = false;
            console.log(`No more proxies found on page ${page}`);
          }
        } else {
          hasMoreData = false;
          console.log(`No more data from ProxyBros or invalid response`);
        }
      } catch (error) {
        console.error(`❌ Error fetching page ${page} from ProxyBros:`, error.message);
        hasMoreData = false;
      }
    }
    
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ ProxyBros: Found ${totalProxyCount} proxies (${totalValidCount} valid, ${totalIndoCount} Indonesian) in ${timeElapsed}s`,
    );
    
    return { total: totalProxyCount, valid: totalValidCount, indo: totalIndoCount };
  } catch (error) {
    console.error(`❌ Error fetching proxies from ProxyBros:`, error.message);
    return { total: 0, valid: 0, indo: 0 };
  }
};

module.exports = fetchProxyBrosProxies;