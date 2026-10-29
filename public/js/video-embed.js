// Click-to-load YouTube film slot. Plain script, no dependencies.
//
// Reads window.OVDB_VIDEO (public/js/video-config.js). The [data-video-slot]
// section stays hidden unless the config is enabled and has a video id for the
// page language. The poster is a local image with explicit width/height, so
// nothing shifts when it appears, and no request goes to YouTube until the
// visitor clicks; the iframe then points at youtube-nocookie.com.
(function () {
  "use strict";

  var slot = document.querySelector("[data-video-slot]");
  var cfg = window.OVDB_VIDEO;
  if (!slot || !cfg || cfg.enabled !== true) return;

  var lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  var v = cfg.locales && cfg.locales[lang];
  if (!v || !/^[A-Za-z0-9_-]{11}$/.test(v.id || "")) return;
  var frame = slot.querySelector("[data-video-frame]");
  if (!frame) return;

  var label = slot.getAttribute("data-play-label") || "Play";
  var title = slot.getAttribute("data-iframe-title") || "Video";
  var duration = v.duration || "";
  var aria = (slot.getAttribute("data-aria-label") || label).replace("{duration}", duration);

  var button = document.createElement("button");
  button.type = "button";
  button.className = "film-play";
  button.lang = lang;
  button.setAttribute("aria-label", aria + ": " + title);

  var img = document.createElement("img");
  img.className = "film-poster";
  img.src = v.poster;
  img.width = v.width;
  img.height = v.height;
  img.alt = "";
  img.decoding = "async";

  var icon = document.createElement("span");
  icon.className = "film-play-icon";
  icon.setAttribute("aria-hidden", "true");

  var text = document.createElement("span");
  text.className = "film-play-label";
  text.textContent = label;

  button.append(img, icon, text);
  if (duration) {
    var badge = document.createElement("span");
    badge.className = "film-duration";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = duration;
    button.append(badge);
  }
  frame.append(button);
  slot.hidden = false;

  button.addEventListener("click", function () {
    var iframe = document.createElement("iframe");
    iframe.src =
      "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.id) +
      "?autoplay=1&rel=0&hl=" + lang;
    iframe.title = title;
    iframe.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.className = "film-iframe";
    frame.replaceChildren(iframe);
    iframe.focus();
  });
})();
