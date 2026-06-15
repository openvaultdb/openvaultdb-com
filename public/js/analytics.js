// Google Analytics (GA4). Loaded on every page. Disabled on localhost so local
// development traffic is never tracked.
(function () {
  var host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "" || host.endsWith(".local")) {
    return;
  }
  var GA_ID = "G-YT9ST7FZ4D";
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);
})();
