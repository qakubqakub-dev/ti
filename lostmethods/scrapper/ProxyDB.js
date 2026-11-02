const axios = require("axios");
const { JSDOM } = require("jsdom");
const utils = require("../lib/utils");

const autoDetectProxyDBScraper = async (reportProgress) => {
  try {
    const mainUrl = "https://proxydb.net/";
    const listUrl = "https://proxydb.net/list";
    let totalExpected = 0;
    const axiosInstance = utils.createAxiosInstance(axios);
    const mainResponse = await axiosInstance.get(mainUrl);

    if (mainResponse.status !== 200) {
      throw new Error(`Failed to fetch main page: ${mainResponse.status}`);
    }
    
    const html = mainResponse.data;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    let captionText = "";
    const caption = document.querySelector("caption");
    
    if (caption) {
      captionText = caption.textContent.trim();
    }
    
    if (!captionText) {
      const allElements = document.querySelectorAll("*");
      for (const element of allElements) {
        const text = element.textContent.trim();
        if (text.includes("proxies") && text.includes("total")) {
          captionText = text;
          break;
        }
      }
    }
    
    if (captionText) {
      let match = captionText.match(/of\s+(\d+,?\d*)\s+total/i);
      if (!match) {
        match = captionText.match(/(\d+,?\d*)\s+total/i);
      }
      if (!match) {
        match = captionText.match(/(\d+,?\d*)/);
      }
      if (match && match[1]) {
        const numberStr = match[1].replace(/,/g, "");
        totalExpected = Number.parseInt(numberStr, 10);
      }
    }
    
    if (totalExpected === 0) {
      totalExpected = 14140;
    }
    const headers = {
      Host: "proxydb.net",
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      Accept: "*/*",
      Origin: "https://proxydb.net",
      Referer: "https://proxydb.net/?protocol=http&protocol=https&protocol=socks4&protocol=socks5",
    };
    
    let totalProxies = 0;
    const proxiesPerPage = 30;
    let proxyList = [];
    
    async function fetchPageWithRetry(offset, retries = 3) {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const payload = JSON.stringify({
            protocols: ["http", "https", "socks4", "socks5"],
            anonlvls: [],
            offset: offset,
          });
          
          const response = await axios.post(listUrl, payload, {
            headers: headers,
            timeout: 10000,
          });
          
          if (response.status !== 200) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          const data = response.data;
          if (!data.proxies || !Array.isArray(data.proxies) || data.proxies.length === 0) {
            if (attempt < retries - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            return { success: false, proxies: [] };
          }
          
          return { success: true, proxies: data.proxies };
        } catch (error) {
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: "Max retries exceeded" };
    }
    const maxConcurrency = 5;
    const offsets = [];
    
    for (let i = 0; i < Math.min(totalExpected, 5000); i += proxiesPerPage) {
      offsets.push(i);
    }
    for (let i = 0; i < offsets.length; i += maxConcurrency) {
      const batch = offsets.slice(i, i + maxConcurrency);
      const promises = batch.map(offset => {
        return fetchPageWithRetry(offset);
      });
      
      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.success && result.proxies.length > 0) {
          for (const proxy of result.proxies) {
            const proxyString = `${proxy.ip}:${proxy.port}`;
            proxyList.push(proxyString);
            totalProxies++;
            
            // Report progress incrementally
            if (reportProgress) {
              reportProgress(totalProxies);
            }
          }
        }
      }
    }
    
    const results = await utils.processProxies(proxyList);
    
    return { total: proxyList.length, valid: results.valid, indo: results.indo };
  } catch (error) {
    return { total: 0, valid: 0, indo: 0 };
  }
};

module.exports = autoDetectProxyDBScraper;