const express = require('express');
const puppeteer = require('puppeteer');

// ГЛОБАЛНА ЗАЩИТА СРЕЩУ СРИВОВЕ
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Засечена и изолирана асинхронна грешка:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('⚠️ Засечена и изолирана критична грешка:', error.message);
});

const app = express();

// СЕРВИРАНЕ НА ФРОНТЕНДА ОТ ПАПКА PUBLIC
app.use(express.static('public'));

let streamCache = {
    diema1: '', diema2: '', diema3: '',
    max1: '', max2: '', euro1: '', euro2: '',
    btv_comedy: '', star_channel: '', star_life: '', lastUpdated: null
};

const channelsConfig = [
    { id: 'diema1', name: 'Diema Sport', pageUrl: 'https://www.seirsanduk.online/?player=12&id=hd-diema-sport-hd&pass=', fallbackUrl: 'https://www.seirsanduk.online/?id=hd-diema-sport-hd&pass=&hash=' },
    { id: 'diema2', name: 'Diema Sport 2', pageUrl: 'https://www.seirsanduk.online/?player=12&id=hd-diema-sport-2-hd&pass=', logo: 'https://nstatic.nova.bg/public/doc/doc/1625131615_ds_web.jpg' },
    { id: 'diema3', name: 'Diema Sport 3', pageUrl: 'https://www.seirsanduk.online/?player=12&id=hd-diema-sport-3-hd&pass=' },
    { id: 'max1', name: 'Max Sport 1', pageUrl: 'https://www.seirsanduk.online/?id=hd-max-sport-1-hd&pass=&hash=' },
    { id: 'max2', name: 'Max Sport 2', pageUrl: 'https://www.seirsanduk.online/?id=hd-max-sport-2-hd&pass=&hash=' },
    { id: 'euro1', name: 'Eurosport 1', pageUrl: 'https://www.seirsanduk.online/?id=hd-eurosport-1-hd&pass=&hash=' },
    { id: 'euro2', name: 'Eurosport 2', pageUrl: 'https://www.seirsanduk.online/?id=hd-eurosport-2-hd&pass=&hash=' },
    { id: 'btv_comedy', name: 'BTV Comedy', pageUrl: 'https://www.seirsanduk.online/?id=hd-btv-comedy-hd&pass=&hash=' },
    { id: 'star_channel', name: 'Star Channel', pageUrl: 'https://www.seirsanduk.online/?id=hd-star-channel-hd&pass=&hash=' },
    { id: 'star_life', name: 'Star Life', pageUrl: 'https://www.seirsanduk.online/?id=hd-star-life-hd&pass=&hash=' }
];

async function scrapeTokens() {
    console.log('\n🚀 СТАРТИРАНЕ НА СКАНИРАНЕ ЗА СТРИЙМОВЕ...');
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: true,
            // СЛЕДВАЩИЯТ РЕД Е КЛЮЧОВ ЗА RENDER: Казва му да ползва инсталирания в Linux Chromium
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=site-per-process',
                '--window-size=1280,720'
            ]
        });

        browser.on('targetcreated', async (target) => {
            try {
                if (target.type() === 'page') {
                    const popupPage = await target.page();
                    if (popupPage && !popupPage.isClosed()) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await popupPage.close().catch(() => {});
                    }
                }
            } catch (e) {}
        });

        for (const channel of channelsConfig) {
            console.log(`🔄 Сканиране: ${channel.name}...`);
            let foundStream = await scanSingleChannel(browser, channel, channel.pageUrl);

            if (!foundStream && channel.fallbackUrl) {
                console.log(`   ⚠️ Опит за алтернативен плеър за ${channel.name}...`);
                foundStream = await scanSingleChannel(browser, channel, channel.fallbackUrl);
            }

            if (foundStream) {
                streamCache[channel.id] = foundStream;
            }
        }

        streamCache.lastUpdated = new Date();
        console.log('🏁 СКАНИРАНЕТО НА СТРИЙМОВЕ ЗАВЪРШИ\n');

    } catch (error) {
        console.error('Критична грешка в Chromium:', error.message);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

async function scanSingleChannel(browser, channel, url) {
    let page;
    let foundStream = null;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        page.on('request', request => {
            try {
                const reqUrl = request.url();
                if (reqUrl.includes('.m3u8') && !foundStream) {
                    foundStream = reqUrl;
                    console.log(`   ✅ Намерен линк за ${channel.name}`);
                }
            } catch (err) {}
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        await page.evaluate(() => {
            const playerEl = document.getElementById('player');
            if (!playerEl) return;
            const allElements = document.querySelectorAll('div, iframe, section');
            allElements.forEach(el => {
                const style = window.getComputedStyle(el);
                if ((style.position === 'absolute' || style.position === 'fixed') && !el.contains(playerEl) && el.id !== 'player') {
                    el.remove();
                }
            });
        }).catch(() => {});

        await page.mouse.click(640, 360).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (err) {
        console.error(`   ❌ Проблем при ${channel.name}:`, err.message);
    } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
    }
    return foundStream;
}

setInterval(scrapeTokens, 20 * 60 * 1000);
scrapeTokens();

app.get('/api/streams', (req, res) => { 
    res.json(streamCache); 
});

// ДИНАМИЧЕН ПОРТ ЗА RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🛡️ Сървърът работи на порт ${PORT}`); 
});
