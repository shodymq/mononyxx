/* Meta Pixel — one browser-side bootstrap for all public pages. */
(() => {
  const pixelId = '1580816737123369';
  const productionHosts = new Set(['mononyxx.com', 'www.mononyxx.com']);
  const metaPixelEnabled = productionHosts.has(window.location.hostname.toLowerCase());

  window.__mononyxxMetaPixelEnabled = metaPixelEnabled;
  if (!metaPixelEnabled) return;

  if (window.__mononyxxMetaPixelInitialized) return;
  window.__mononyxxMetaPixelInitialized = true;

  // Official Meta Pixel bootstrap: define the queue before the network script loads.
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  document.addEventListener('click', (event) => {
    const whatsappLink = event.target?.closest?.('a[href*="wa.me/"], a[href*="api.whatsapp.com/send"]');
    if (!whatsappLink || whatsappLink.dataset.metaContactHandled === 'true') return;
    const eventId = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.fbq('trackSingle', pixelId, 'Contact', {
      content_name: whatsappLink.dataset.metaContentName || 'whatsapp_cta',
      contact_method: 'WhatsApp',
      source: whatsappLink.dataset.metaSource || document.body?.dataset.page || 'site_link',
    }, { eventID: eventId });
  });
})();
