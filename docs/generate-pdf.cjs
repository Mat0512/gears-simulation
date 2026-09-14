const puppeteer = require('../../molecule-module/node_modules/puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const htmlPath = path.resolve(__dirname, 'user-manual.html');
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
        path: path.resolve(__dirname, 'user-manual.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    await browser.close();
    console.log('PDF generated: docs/user-manual.pdf');
})();
