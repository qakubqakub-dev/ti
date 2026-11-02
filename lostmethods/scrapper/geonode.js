const axios = require("axios");
const utils = require("../lib/utils");

const fetchGeonodeProxies = async () => {
  try {
    console.log(`Fetching from geonode API`);
    const startTime = Date.now();
    let page = 1;
    let hasMoreData = true;
    let totalProxyCount = 0;
    let totalValidCount = 0;
    let totalIndoCount = 0;
    const axiosInstance = utils.createAxiosInstance(axios);
    
    while (hasMoreData) {
      const url = `https://proxylist.geonode.com/api/proxy-list?limit=500&page=${page}&sort_by=lastChecked&sort_type=desc`;
      console.log(`Fetching page ${page} from geonode API`);
      
      try {
        const response = await axiosInstance.get(url);
        if (response.status === 200 && response.data && response.data.data && response.data.data.length > 0) {
          const proxies = response.data.data;
          let pageProxyCount = 0;
          let pageValidCount = 0;
          let pageIndoCount = 0;
          
          for (const proxy of proxies) {
            const ip = proxy.ip;
            const port = proxy.port;
            
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
          }
          
          await utils.writeProxiesToFile();
          totalProxyCount += pageProxyCount;
          totalValidCount += pageValidCount;
          totalIndoCount += pageIndoCount;
          
          console.log(
            `✅ geonode API page ${page}: Found ${pageProxyCount} proxies (${pageValidCount} valid, ${pageIndoCount} Indonesian)`,
          );
          
          if (proxies.length < 500) {
            hasMoreData = false;
            console.log(`Reached the last page of geonode API results`);
          } else {
            page++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } else {
          hasMoreData = false;
          console.log(`No more data from geonode API or invalid response`);
        }
      } catch (error) {
        console.error(`❌ Error fetching page ${page} from geonode API:`, error.message);
        hasMoreData = false;
      }
    }
    
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ geonode API: Found ${totalProxyCount} proxies (${totalValidCount} valid, ${totalIndoCount} Indonesian) in ${timeElapsed}s`,
    );
    
    return { total: totalProxyCount, valid: totalValidCount, indo: totalIndoCount };
  } catch (error) {
    console.error(`❌ Error fetching proxies from geonode API:`, error.message);
    return { total: 0, valid: 0, indo: 0 };
  }
};

module.exports = fetchGeonodeProxies;