// Run locally with Playwright and installed Chrome; no GitHub Actions required.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = http.createServer(async (request, response) => {
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Invalid path');
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

(async () => {
  let browser;
  let checks = 0;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const runtimeErrors = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    async function session({ blocked = [], writesBlocked = false, country = 'KR', locale = 'en-US', ...options } = {}) {
      const context = await browser.newContext({ locale, ...options });
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin + '/')) return route.continue();
        if (url.startsWith('https://get.geojs.io/')) return route.fulfill({ json: { country } });
        // Tests stay offline; local brand fonts and images are still loaded.
        return route.fulfill({ body: '', contentType: 'text/css' });
      });
      await context.addInitScript(({ blocked, writesBlocked }) => {
        for (const name of blocked) Object.defineProperty(window, name, {
          get() { throw new DOMException('Storage blocked', 'SecurityError'); }
        });
        if (writesBlocked) Storage.prototype.setItem = function () {
          throw new DOMException('Storage full', 'QuotaExceededError');
        };
      }, { blocked, writesBlocked });
      const page = await context.newPage();
      page.on('pageerror', error => runtimeErrors.push(error.message));
      return { context, page };
    }
    async function visit(page, url) {
      await page.goto(origin + url, { waitUntil: 'networkidle' });
    }
    async function choose(page, lang) {
      // Seed once, without overriding choices on subsequent navigations.
      await visit(page, '/app-ads.txt');
      await page.evaluate(lang => localStorage.setItem('neureps-lang', lang), lang);
    }
    async function expectPath(page, pathname) {
      await page.waitForURL(origin + pathname, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).pathname, pathname);
      checks++;
    }

    // Both directions of each translation link must survive auto-detection.
    for (const route of ['privacy', 'support']) {
      const { context, page } = await session();
      await visit(page, `/${route}/`);
      await page.locator('.note a').click();
      await expectPath(page, `/en/${route}/`);
      await page.reload({ waitUntil: 'networkidle' });
      await expectPath(page, `/en/${route}/`);
      await page.locator('.note a').click();
      await expectPath(page, `/${route}/`);
      await page.locator('.lang-switch [data-lang="en"]').click();
      await expectPath(page, `/en/${route}/`);
      await context.close();
    }

    // A blocked getter must not escape the safe storage helper. If nothing can
    // be persisted, the requested language URL remains usable in both directions.
    for (const options of [
      { blocked: ['localStorage'] },
      { blocked: ['sessionStorage'] },
      { blocked: ['localStorage', 'sessionStorage'] },
      { writesBlocked: true },
    ]) {
      const { context, page } = await session(options);
      await visit(page, '/privacy/');
      await page.locator('.note a').click();
      await expectPath(page, '/en/privacy/');
      await page.reload({ waitUntil: 'networkidle' });
      await expectPath(page, '/en/privacy/');
      await page.locator('.note a').click();
      await expectPath(page, '/privacy/');
      await context.close();
    }

    // Country lookup, browser-language fallback and query/fragment preservation.
    for (const config of [
      { country: 'KR', locale: 'en-US', from: '/en/music/?source=test#series', to: '/music/?source=test#series' },
      { country: 'US', locale: 'ko-KR', from: '/music/?source=test#series', to: '/en/music/?source=test#series' },
      { country: null, locale: 'ko-KR', from: '/en/music/', to: '/music/' },
    ]) {
      const { context, page } = await session(config);
      await visit(page, config.from);
      await page.waitForURL(origin + config.to, { waitUntil: 'networkidle' });
      assert.equal(page.url(), origin + config.to);
      checks++;
      await context.close();
    }

    const { context, page } = await session({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    await choose(page, 'ko');
    await visit(page, '/music/');
    const toggle = page.locator('.nav-toggle');
    const isFocused = selector => page.locator(selector).evaluate(e => e === document.activeElement);
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await isFocused('.site-nav a:first-child'), true);
    assert.equal(await page.locator('main').evaluate(e => e.inert), true);
    assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).overflow), 'hidden');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.site-header')), true);
    }
    await page.locator('.brand').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await isFocused('.nav-toggle'), true);
    await page.keyboard.press('Escape');
    assert.equal(await isFocused('.nav-toggle'), true);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('main').evaluate(e => e.inert), false);
    await toggle.click();
    await page.locator('.site-nav a[href="#series"]').click();
    assert.equal(new URL(page.url()).hash, '#series');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click();
    await page.mouse.click(10, 200);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await isFocused('.nav-toggle'), true);
    await toggle.click();
    await page.setViewportSize({ width: 1024, height: 812 });
    await page.waitForFunction(() => !document.querySelector('.site-header').classList.contains('nav-open'));
    assert.equal(await page.locator('main').evaluate(e => e.inert), false);
    assert.equal(await page.locator('html').evaluate(e => e.classList.contains('nav-modal-open')), false);
    checks++;
    assert.deepEqual(await page.locator('.eq-bar').evaluateAll(es => es.map(e => getComputedStyle(e).animationName)),
      ['none', 'none', 'none', 'none']);
    assert.deepEqual(await page.locator('.music-series-card, .video-card, .music-final-btn').evaluateAll(es =>
      [...new Set(es.map(e => getComputedStyle(e).transitionDuration))]), ['0s']);
    await page.setViewportSize({ width: 375, height: 812 });
    await toggle.click();
    assert.equal(await page.locator('.site-nav').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    await page.keyboard.press('Escape');
    checks++;

    // All pages retain valid controls, images and layout at seven screen widths.
    const routes = ['/', '/warmly/', '/music/', '/privacy/', '/support/'];
    for (const lang of ['ko', 'en']) {
      await choose(page, lang);
      for (const route of routes) {
        const url = lang === 'en' ? '/en' + route : route;
        await visit(page, url);
        assert.equal(new URL(page.url()).pathname, url);
        assert.equal(await page.locator('.nav-toggle').getAttribute('aria-controls'), 'site-nav');
        assert.deepEqual(await page.locator('img').evaluateAll(es => es.filter(e => !e.complete || !e.naturalWidth).map(e => e.src)), []);
        for (const width of [320, 375, 660, 700, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${url} at ${width}px`);
          checks++;
        }
      }
    }
    await visit(page, '/en/');
    const variant = await page.locator('.warmly-home-banner').getAttribute('data-banner-variant');
    await page.reload({ waitUntil: 'networkidle' });
    assert.notEqual(await page.locator('.warmly-home-banner').getAttribute('data-banner-variant'), variant);
    assert.equal(await page.locator('.music-home-banner').getAttribute('data-banner-variant'), variant === '2' ? '3' : '2');
    checks++;
    await context.close();
    assert.deepEqual(runtimeErrors, []);
    console.log(`PASS: ${checks} browser scenarios; no JavaScript errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
