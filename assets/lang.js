/* neureps.com — language detection & switching
   priority: explicit choice (session/local storage) > geo by IP (cached per session) > browser language
   pages live at / (ko) and /en/ (en) with mirrored paths */
(function () {
  var KEY = 'neureps-lang';
  var AUTO_KEY = 'neureps-lang-auto';
  var path = location.pathname;
  var isEn = path === '/en' || path.indexOf('/en/') === 0;
  var explicitChoice = false;

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
    try { var v = window[storage].getItem(key); return v === 'ko' || v === 'en' ? v : null; }
    catch (e) { return null; }
  }

  function write(storage, key, value) {
    try { window[storage].setItem(key, value); return true; }
    catch (e) { return false; }
  }

  // All language links, including translations in page content, use data-lang.
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest && e.target.closest('[data-lang]');
    if (!link) return;
    var lang = link.getAttribute('data-lang');
    if (lang !== 'ko' && lang !== 'en') return;
    explicitChoice = true;
    write('sessionStorage', KEY, lang);
    write('localStorage', KEY, lang);
  });

  // mobile hamburger menu (drawer)
  var background = [];

  function openDrawer(header) {
    header.classList.add('nav-open');
    header.querySelector('.nav-toggle').setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('nav-modal-open');
    background = Array.from(document.querySelectorAll('main, .site-footer')).map(function (element) {
      var previous = element.inert;
      element.inert = true;
      return { element: element, inert: previous };
    });
    var firstLink = header.querySelector('.site-nav a');
    if (firstLink) firstLink.focus();
  }

  function closeDrawer(header, restoreFocus) {
    header.classList.remove('nav-open');
    document.documentElement.classList.remove('nav-modal-open');
    background.forEach(function (item) { item.element.inert = item.inert; });
    background = [];
    var toggle = header.querySelector('.nav-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus && toggle) toggle.focus();
  }

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var header = document.querySelector('.site-header');
    if (!header) return;
    var btn = e.target.closest('.nav-toggle');
    if (btn) {
      if (header.classList.contains('nav-open')) closeDrawer(header, true);
      else openDrawer(header);
      return;
    }
    // close after picking a menu item, tapping the dimmed backdrop
    // (the header's ::after, so the event targets the header itself),
    // or tapping anywhere outside the header
    if (header.classList.contains('nav-open') &&
        (e.target === header || e.target.closest('.site-nav a') ||
         !e.target.closest('.site-header'))) {
      closeDrawer(header, e.target === header || !!e.target.closest('.site-nav a'));
    }
  });

  document.addEventListener('keydown', function (e) {
    var header = document.querySelector('.site-header.nav-open');
    if (!header) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer(header, true);
    } else if (e.key === 'Tab') {
      var controls = Array.from(header.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (element) { return element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'; });
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !header.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // suppress the drawer transition while resizing across the breakpoint,
  // and drop the open state when leaving mobile layout
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    document.documentElement.classList.add('resizing');
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.documentElement.classList.remove('resizing');
    }, 150);
    if (window.innerWidth > 660) {
      var header = document.querySelector('.site-header.nav-open');
      if (header) {
        var toggleFocused = document.activeElement === header.querySelector('.nav-toggle');
        closeDrawer(header, false);
        if (toggleFocused) header.querySelector('.site-nav a').focus();
      }
    }
  });

  var chosen = read('sessionStorage', KEY) || read('localStorage', KEY);
  if (chosen) { go(chosen); return; }

  // no explicit choice yet: auto-detect once per session
  var cached = read('sessionStorage', AUTO_KEY);
  if (cached) { go(cached); return; }

  function browserLang() {
    var l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return l.toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
  }

  function settle(lang) {
    if (explicitChoice) return;
    // Without a usable cache, retain the requested URL so manual language
    // navigation cannot be repeatedly undone by auto-detection.
    if (write('sessionStorage', AUTO_KEY, lang)) go(lang);
  }

  var timer = null;
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (controller) timer = setTimeout(function () { controller.abort(); }, 2000);

  fetch('https://get.geojs.io/v1/ip/country.json', controller ? { signal: controller.signal } : {})
    .then(function (res) {
      if (!res.ok) throw new Error('Country lookup failed');
      return res.json();
    })
    .then(function (data) {
      if (timer) clearTimeout(timer);
      settle(data && /^[A-Z]{2}$/.test(data.country) ? (data.country === 'KR' ? 'ko' : 'en') : browserLang());
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      settle(browserLang());
    });
})();
