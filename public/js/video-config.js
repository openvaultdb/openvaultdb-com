// OpenVaultDB film: the single switch for the homepage video slot.
//
// The slot stays hidden until `enabled` is true AND the current page language
// has a YouTube video id below. To publish the film:
//   1. set `id` for "en" and "ru" to the 11-character YouTube video ids;
//   2. replace /video/poster-en.svg and /video/poster-ru.svg with the real
//      posters (any local image works: update `poster`, `width`, `height`);
//   3. set `enabled` to true.
// Nothing is requested from YouTube until a visitor clicks the poster; the
// player then loads from youtube-nocookie.com. See README.md, "Film slot".
window.OVDB_VIDEO = {
  enabled: false,
  locales: {
    en: { id: "", poster: "/video/poster-en.svg", width: 1280, height: 720 },
    ru: { id: "", poster: "/video/poster-ru.svg", width: 1280, height: 720 },
  },
};
