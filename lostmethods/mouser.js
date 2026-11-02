const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

async function mouser(page) {
    const pageViewport = page.viewport();
    if (!pageViewport) return; // Pastikan viewport tersedia

    for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * pageViewport.width);
        const y = Math.floor(Math.random() * pageViewport.height);
        await page.mouse.click(x, y);
        await sleep(0.2); // Tambah jeda biar lebih realistis
    }

    const centerX = pageViewport.width / 2;
    const centerY = pageViewport.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();

    const movements = [
        [centerX + 100, centerY],
        [centerX + 100, centerY + 100],
        [centerX, centerY + 100],
        [centerX, centerY]
    ];

    for (const [x, y] of movements) {
        await page.mouse.move(x, y, { steps: 10 }); // Lebih halus
        await sleep(0.2);
    }

    await page.mouse.up();
    await sleep(1.5);
}

module.exports = mouser;
