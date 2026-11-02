const fs = require("fs");
const path = require("path");
const axios = require("axios");
const utils = require("../lib/utils");

const downloadAndSaveProxies = async (url, reportProgress, currentCount) => {
  try {
    const axiosInstance = utils.createAxiosInstance(axios);
    
    const response = await axiosInstance.get(url);
    if (response.status === 200) {
      const dataArray = response.data.split("\n");
      let proxyCount = 0;
      let validCount = 0;
      let indoCount = 0;

      for (const d of dataArray) {
        if (d && d.includes(":")) {
          const cleanedProxy = utils.cleanProxyString(d);
          proxyCount++;
          if (reportProgress) {
            reportProgress(currentCount + proxyCount);
          }

          if (cleanedProxy && cleanedProxy.includes(":") && utils.isValidProxy(cleanedProxy)) {
            validCount++;
            if (!utils.uniqueProxies.has(cleanedProxy)) {
              utils.uniqueProxies.add(cleanedProxy);
              const [ip] = cleanedProxy.split(":");
              if (utils.isIndonesianIP(ip)) {
                indoCount++;
                const proxyString = cleanedProxy;
                if (!utils.uniqueIndonesianProxies.has(proxyString)) {
                  utils.uniqueIndonesianProxies.add(proxyString);
                }
              }
            }
          }
        }
      }
      
      await utils.writeProxiesToFile();
      return { total: proxyCount, valid: validCount, indo: indoCount };
    } else {
      return { total: 0, valid: 0, indo: 0 };
    }
  } catch (error) {
    return { total: 0, valid: 0, indo: 0 };
  }
}
const processRandomProxyUrls = async (reportProgress) => {
  try {
    const proxyFilePath = path.join(__dirname, "./url/urls.txt");
    
    if (!fs.existsSync(proxyFilePath)) {
      return { total: 0, valid: 0, indo: 0 };
    }
    const proxyUrls = fs
      .readFileSync(proxyFilePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((url) => url.trim());  
    let totalProxyCount = 0;
    let totalValidCount = 0;
    let totalIndoCount = 0;
    const promises = proxyUrls.map(url => {
      return downloadAndSaveProxies(url, reportProgress, totalProxyCount)
        .then(result => {
          totalProxyCount += result.total;
          totalValidCount += result.valid;
          totalIndoCount += result.indo;
          return result;
        });
    });
    
    await Promise.all(promises);
    
    return { total: totalProxyCount, valid: totalValidCount, indo: totalIndoCount };
  } catch (error) {
    return { total: 0, valid: 0, indo: 0 };
  }
};
module.exports = processRandomProxyUrls;