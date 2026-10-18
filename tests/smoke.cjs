const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8000/');
 assert.equal(await page.title(),'RoadLedger');
 await page.locator('#pickup').fill('Dallas, TX'); await page.locator('#delivery').fill('Austin, TX'); await page.locator('#pay').fill('1000'); await page.locator('#distance').fill('200'); await page.locator('#rate').fill('25'); await page.locator('#loadForm button[type=submit]').click();
 assert.equal(await page.locator('#gross').innerText(),'$1,000.00'); assert.equal(await page.locator('#earned').innerText(),'$250.00'); assert.equal(await page.locator('#count').innerText(),'1');
 await page.reload(); assert.equal(await page.locator('#count').innerText(),'1'); assert.match(await page.locator('#loadList').innerText(),/Dallas/);
 await page.locator('nav [data-tab=reports]').click(); assert.equal(await page.locator('#rGross').innerText(),'$1,000.00'); assert.equal(await page.locator('#rMiles').innerText(),'200');
 const downloadPromise=page.waitForEvent('download'); await page.locator('#exportCSV').click(); const download=await downloadPromise; await download.saveAs('/tmp/roadledger-smoke.csv'); assert.match(require('node:fs').readFileSync('/tmp/roadledger-smoke.csv','utf8'),/Dallas, TX/);
 await page.locator('#themeToggle').click(); await page.reload(); assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('dark')),true);
 for(const tab of await page.locator('nav [data-tab]').all()){await tab.click(); const name=await tab.getAttribute('data-tab'); assert.equal(await page.locator('#'+name+'Tab').isVisible(),true);}
 console.log('PASS: startup, load creation, totals, reload persistence, reports, CSV export, theme persistence, all 12 navigation panels.'); assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
