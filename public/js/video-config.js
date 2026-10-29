// OpenVaultDB film: the single switch for the homepage video slot.
//
// The slot stays hidden unless `enabled` is true AND the current page language
// has a YouTube video id below. Each language shows only its own film: the
// English page the English one, /ru/ the Russian one. `duration` is shown on
// the poster and in the button's accessible label.
// Posters are local files in /video/ (16:9; `width`/`height` must match the
// file so the box never shifts). Nothing is requested from YouTube until a
// visitor clicks the poster; the player then loads from youtube-nocookie.com.
// See README.md, "Film slot".
window.OVDB_VIDEO = {
  enabled: true,
  locales: {
    en: { id: "LMTcLntUWJM", poster: "/video/poster-en.webp", width: 1280, height: 720, duration: "1:35" },
    ru: { id: "G6qINgqifaQ", poster: "/video/poster-ru.webp", width: 1280, height: 720, duration: "1:45" },
  },
};
