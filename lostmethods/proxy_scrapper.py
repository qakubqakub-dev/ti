import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from colorama import init, Fore, Style
from tqdm import tqdm
import os
import time
import pyfiglet
import collections.abc
import re
import random
if not hasattr(collections, 'Callable'):
    collections.Callable = collections.abc.Callable
init(autoreset=True)
added_proxies = set()
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 11.5; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
]
def get_random_user_agent():
    return random.choice(USER_AGENTS)
def fetch_proxies_from_geonode(soup):
    proxies = []
    rows = soup.find_all('tr')
    for row in rows:
        cols = row.find_all('td')
        if len(cols) >= 8:
            proxy = f"{cols[0].text}:{cols[1].text}"
            proxies.append(proxy)
    return proxies
def fetch_proxies_from_proxyscrape(response):
    proxy_list = response.text.strip().split('\r\n')
    return proxy_list
def fetch_proxies_from_free_proxy_sites(soup):
    proxies = []
    rows = soup.find_all('tr')
    for row in rows[1:]:
        cols = row.find_all('td')
        if len(cols) >= 2:
            ip = cols[0].text.strip()
            port = cols[1].text.strip()
            if ip and port:
                proxy = f"{ip}:{port}"
                proxies.append(proxy)
    return proxies
def fetch_proxies_from_advanced_name(soup):
    proxies_text = soup.get_text()
    proxy_list = proxies_text.split('\n')
    return proxy_list

def fetch_proxies_from_other_sources(soup):
    proxies = []
    rows = soup.find_all('tr')
    for row in rows[1:]:
        cols = row.find_all('td')
        if len(cols) >= 2:
            proxy = f"{cols[0].text.strip()}:{cols[1].text.strip()}"
            proxies.append(proxy)
    return proxies

def fetch_proxies_from_echolink(soup):
    proxies = []
    rows = soup.find_all('tr')
    for row in rows[1:]:
        cols = row.find_all('td')
        if len(cols) >= 5 and cols[4].text.strip() == 'Ready':
            proxy = f"{cols[1].text.strip()}:{cols[2].text.strip()}"
            proxies.append(proxy)
    return proxies
def is_valid_proxy(proxy_str):
    ip_port_pattern = r'^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$'
    match = re.match(ip_port_pattern, proxy_str)
    if not match:
        return False
    ip = match.group(1)
    ip_parts = ip.split('.')
    for part in ip_parts:
        if not 0 <= int(part) <= 255:
            return False
    port = int(match.group(2))
    if not 1 <= port <= 65535:
        return False
    return True
def clean_proxy(proxy):
    ip_port_pattern = r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})'
    match = re.search(ip_port_pattern, proxy)
    if match:
        ip = match.group(1)
        port = match.group(2)
        return f"{ip}:{port}"
    parts = proxy.split(':')
    if len(parts) >= 2:
        potential_proxy = f"{parts[0]}:{parts[1]}"
        if is_valid_proxy(potential_proxy):
            return potential_proxy
    return None
def add_proxy_to_file(proxy):
    global added_proxies
    clean_proxy_str = clean_proxy(proxy)
    if clean_proxy_str and clean_proxy_str not in added_proxies:
        with open('proxy.txt', 'a') as f:
            f.write(clean_proxy_str + '\n')
        added_proxies.add(clean_proxy_str)
        return True
    return False
def fetch_proxies(url, print_sample=False):
    proxies = []
    domain = urlparse(url).netloc
    valid_count = 0
    print(Fore.YELLOW + f"\nFetching proxies from {domain}...\n")
    try:
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        if 'geonode.com' in url:
            proxies = fetch_proxies_from_geonode(soup)
        elif 'proxyscrape.com' in url:
            proxies = fetch_proxies_from_proxyscrape(response)
        elif any(site in url for site in ['sslproxies.org', 'free-proxy-list.net', 'us-proxy.org', 'socks-proxy.net']):
            proxies = fetch_proxies_from_free_proxy_sites(soup)
        elif 'advanced.name' in url:
            proxies = fetch_proxies_from_advanced_name(soup)
        elif any(site in url for site in ['freeproxy.world', 'iplocation.net', '2ip.io', 'hidemy.life', 'freeproxylist.cc']):
            proxies = fetch_proxies_from_other_sources(soup)
        elif 'echolink.org' in url:
            proxies = fetch_proxies_from_echolink(soup)
        for proxy in proxies:
            if add_proxy_to_file(proxy):
                valid_count += 1
        print(Fore.GREEN + f"\nFetched {len(proxies)} proxies from {domain}.")
        print(Fore.GREEN + f"Added {valid_count} valid proxies to proxy.txt\n")
        if print_sample and valid_count > 0:
            print(Fore.CYAN + f"Sample of {min(5, valid_count)} proxies:")
            sample_count = 0
            for proxy in proxies:
                clean_proxy_str = clean_proxy(proxy)
                if clean_proxy_str:
                    print(clean_proxy_str)
                    sample_count += 1
                    if sample_count >= 5:
                        break
            print()
            print(Fore.YELLOW + Style.BRIGHT + "\nLoading..")
        time.sleep(0.5)
    except requests.exceptions.RequestException as e:
        print(Fore.RED + f"Failed to fetch proxies from {domain}: {e}")
    return domain, valid_count
def run_proxy_scraper():
    os.system('cls' if os.name == 'nt' else 'clear') 
    print(Fore.YELLOW + Style.BRIGHT + pyfiglet.figlet_format("Proxy Scraper"))
    print(Fore.CYAN + Style.BRIGHT + "- Nexarium Executive Stresser\n")
    with open('proxy.txt', 'w') as f:
        pass
    urls = [
        'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&format=text',
        'https://www.sslproxies.org/',
        'https://free-proxy-list.net',
        'https://us-proxy.org/',
        'https://socks-proxy.net/',
        'https://advanced.name/freeproxy/667e4f3871c2f',
        'https://www.freeproxy.world/?country=US',
        'https://www.echolink.org/proxylist.jsp',
        'https://www.iplocation.net/proxy-list',
        'https://2ip.io/proxy/',
        'https://hidemy.life/en/proxy-list-servers',
        'https://freeproxylist.cc'
    ]
    total_valid_count = 0
    print(Fore.YELLOW + "\nFetching Proxies...\n")
    for url in tqdm(urls, desc="Progress", unit=" website"):
        domain, valid_count = fetch_proxies(url, print_sample=True)
        total_valid_count += valid_count
        os.system('cls' if os.name == 'nt' else 'clear') 
        print(Fore.YELLOW + Style.BRIGHT + pyfiglet.figlet_format("Proxy Scraper"))
        print(Fore.CYAN + Style.BRIGHT + "NEXARIUM EXECUTIVE STRESSER\n")
    print(Fore.BLUE + Style.BRIGHT + f"\nAll proxies fetched and saved to proxy.txt.")
    print(Fore.GREEN + f"Successfully saved {total_valid_count} valid proxies in IP:PORT format.")
    print(Fore.GREEN + f"Removed {len(added_proxies) - total_valid_count} duplicate proxies.")
if __name__ == "__main__":
    run_proxy_scraper()
