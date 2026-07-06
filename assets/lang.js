/* neureps.com — language detection & switching
   priority: explicit choice (localStorage) > geo by IP (cached per session) > browser language
   pages live at / (ko) and /en/ (en) with mirrored paths */
(function () {
  var KEY = 'neureps-lang';
  var AUTO_KEY = 'neureps-lang-auto';
  var path = location.pathname;
  var isEn = path === '/en' || path.indexOf('/en/') === 0;
  var pageLang = isEn ? 'en' : 'ko';

  function counterpartPath(lang) {
    if (lang === 'en') {
      return isEn ? null : (path === '/' ? '/en/' : '/en' + path);
    }
    return isEn ? (path.replace(/^\/en\/?/, '/') || '/') : null;
  }

  function go(lang) {
    var target = counterpartPath(lang);
    if (target) location.replace(target + location.search + location.hash);
  }

  function read(storage, key) {
    try { var v = storage.getItem(key); return v === 'ko' || v === 'en' ? v : null; }
    catch (e) { return null; }
  }

  function write(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) {}
  }

  // remember an explicit choice made via the header switcher
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest && e.target.closest('[data-lang]');
    if (link) write(localStorage, KEY, link.getAttribute('data-lang'));
  });

  var chosen = read(localStorage, KEY);
  if (chosen) { go(chosen); return; }

  // no explicit choice yet: auto-detect once per session
  var cached = read(sessionStorage, AUTO_KEY);
  if (cached) { go(cached); return; }

  function browserLang() {
    var l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return l.toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
  }

  function settle(lang) {
    write(sessionStorage, AUTO_KEY, lang);
    go(lang);
  }

  var timer = null;
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (controller) timer = setTimeout(function () { controller.abort(); }, 2000);

  fetch('https://get.geojs.io/v1/ip/country.json', controller ? { signal: controller.signal } : {})
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (timer) clearTimeout(timer);
      settle(data && data.country === 'KR' ? 'ko' : 'en');
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      settle(browserLang());
    });
})();
