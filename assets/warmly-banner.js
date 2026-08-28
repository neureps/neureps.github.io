/* Alternate the two Warmly banners on every page load.
   sessionStorage guarantees a visible change on refresh without tracking users. */
(function () {
  var banners = document.querySelectorAll('[data-warmly-banner]');
  if (!banners.length) return;

  var key = 'neureps-warmly-banner';
  var previous = null;
  try { previous = sessionStorage.getItem(key); } catch (error) {}
  var next = previous === '2' ? '3' : previous === '3' ? '2' : (Math.random() < 0.5 ? '2' : '3');
  try { sessionStorage.setItem(key, next); } catch (error) {}

  banners.forEach(function (banner) {
    banner.setAttribute('data-banner-variant', next);
  });
})();
