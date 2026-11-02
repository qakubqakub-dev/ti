const axios = require("axios");
const utils = require("../lib/utils");
const fetchXrevProxies = async () => {
  try {
    const url = "https://api.xreverselabs.org/proxy/v2/all";
    console.log(`Fetching from xreverselabs API: ${url}`);
    const startTime = Date.now();
    const axiosInstance = utils.createAxiosInstance(axios);
    const response = await axiosInstance.get(url);
    if (response.status === 200 && response.data && response.data.proxy) {
      const proxyList = response.data.proxy;
      let proxyCount = 0;
      let validCount = 0;
      let indoCount = 0;
      for (const proxyString of proxyList) {
        proxyCount++;
        if (utils.isValidProxy(proxyString)) {
          validCount++;
          if (!utils.uniqueProxies.has(proxyString)) {
            utils.uniqueProxies.add(proxyString);
            const [ip] = proxyString.split(":");
            if (utils.isIndonesianIP(ip)) {
              indoCount++;
              if (!utils.uniqueIndonesianProxies.has(proxyString)) {
                utils.uniqueIndonesianProxies.add(proxyString);
              }
            }
          }
        }
      }
      await utils.writeProxiesToFile();
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ xreverselabs API: Found ${proxyCount} proxies (${validCount} valid, ${indoCount} Indonesian) in ${timeElapsed}s`,
      );
      return { total: proxyCount, valid: validCount, indo: indoCount };
    } else {
      console.log(`❌ Failed to fetch proxies from xreverselabs API: Invalid response`);
      return { total: 0, valid: 0, indo: 0 };
    }
  } catch (error) {
    console.error(`❌ Error fetching proxies from xreverselabs API:`, error.message);
    return { total: 0, valid: 0, indo: 0 };
  }
};
module.exports = fetchXrevProxies;