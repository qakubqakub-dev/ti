const axios = require("axios");
const utils = require("../lib/utils");

const fetchProxyRackProxies = async () => {
  try {
    console.log(`Fetching from ProxyRack API`);
    const startTime = Date.now();
    
    const headers = {
      Host: "proxyfinder.proxyrack.com",
      "Sec-Ch-Ua-Platform": "Windows",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Ch-Ua": '"Not:A-Brand";v="24", "Chromium";v="134"',
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Sec-Ch-Ua-Mobile": "?0",
      Accept: "*/*",
      Origin: "https://www.proxyrack.com",
      "Sec-Fetch-Site": "same-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      Referer: "https://www.proxyrack.com/",
      "Accept-Encoding": "gzip, deflate, br",
    };
    
    const response = await axios.get("https://proxyfinder.proxyrack.com/proxies.json?perPage=100000&offset=20", {
      headers,
    });
    
    if (response.status === 200 && response.data && response.data.records) {
      const proxies = response.data.records;
      let proxyCount = 0;
      let validCount = 0;
      let indoCount = 0;
      
      for (const proxy of proxies) {
        const ip = proxy.ip;
        const port = proxy.port;
        if (ip && port) {
          const proxyString = `${ip}:${port}`;
          proxyCount++;
          
          if (utils.isValidProxy(proxyString)) {
            validCount++;
            if (!utils.uniqueProxies.has(proxyString)) {
              utils.uniqueProxies.add(proxyString);
              if (utils.isIndonesianIP(ip)) {
                indoCount++;
                if (!utils.uniqueIndonesianProxies.has(proxyString)) {
                  utils.uniqueIndonesianProxies.add(proxyString);
                }
              }
            }
          }
        }
      }
      
      await utils.writeProxiesToFile();
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ ProxyRack API: Found ${proxyCount} proxies (${validCount} valid, ${indoCount} Indonesian) in ${timeElapsed}s`,
      );
      
      return { total: proxyCount, valid: validCount, indo: indoCount };
    } else {
      console.log(`❌ Failed to fetch proxies from ProxyRack API: Invalid response`);
      return { total: 0, valid: 0, indo: 0 };
    }
  } catch (error) {
    console.error(`❌ Error fetching proxies from ProxyRack API:`, error.message);
    return { total: 0, valid: 0, indo: 0 };
  }
};

module.exports = fetchProxyRackProxies;