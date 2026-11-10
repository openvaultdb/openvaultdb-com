const ORIGIN = "https://openvaultdb.com";
const route = (locale) => locale === "en" ? "/about/tech-stack" : "/ru/about/tech-stack";

const copy = {
  en: {
    title: "OpenVaultDB tech stack — website, protocol, and storage",
    description: "How the OpenVaultDB website is served and how its early user-owned database protocol connects Go, TugQL, DALgo, inGitDB and SpecScore.",
    home: "Home",
    crumb: "Tech stack",
    switchLabel: "Русский",
    h1: "The technology behind OpenVaultDB",
    intro: "A tech stack is the tools used to build and run a product. OpenVaultDB is an early proposal for databases that belong to the user, with a public site that explains the protocol and its planned parts.",
    website: "This website",
    websiteText: "The public pages are static HTML and CSS, with small browser scripts for navigation and consent. A Cloudflare Worker serves those files directly, keeping the protocol explanation readable without loading an application framework.",
    product: "The product",
    productText: "The reference server and libraries are written in Go. The proposed stack puts TugQL queries above DALgo's storage adapters and can use inGitDB as a Git-backed engine. The site marks several backend integrations as planned, so this diagram describes the direction of the protocol rather than a claim that every adapter is available now.",
    tools: "Our tools used here",
    toolsText: "This repository records features and design decisions in SpecScore files. Its installation pages are generated from versioned instructions, so a person or agent can review the same steps before setting up the ovdb CLI.",
    related: "Related projects",
    relatedText: "DataTug explores databases and queries. TugQL defines the query layer, DALgo provides data access, and inGitDB explores Git-backed storage.",
    privacy: "Privacy",
    analytics: "Analytics choices",
  },
  ru: {
    title: "Технологии OpenVaultDB — сайт, протокол и хранение",
    description: "Как устроен сайт OpenVaultDB и как ранний проект пользовательских баз данных связывает Go, TugQL, DALgo, inGitDB и SpecScore.",
    home: "Главная",
    crumb: "Технологии",
    switchLabel: "English",
    h1: "Технологии OpenVaultDB",
    intro: "Технологический стек — это инструменты, на которых построен и работает продукт. OpenVaultDB — ранний проект баз данных, принадлежащих пользователю; публичный сайт объясняет протокол и его запланированные части.",
    website: "Этот сайт",
    websiteText: "Публичные страницы написаны на HTML и CSS; небольшие скрипты отвечают за навигацию и согласие на аналитику. Cloudflare Worker отдаёт готовые файлы, поэтому описание протокола читается без загрузки приложения.",
    product: "Продукт",
    productText: "Эталонный сервер и библиотеки написаны на Go. В предлагаемой архитектуре запросы TugQL работают поверх адаптеров хранения DALgo, а inGitDB может служить движком с данными в Git. Сайт относит часть интеграций к планам, поэтому схема описывает направление протокола, а не готовность всех адаптеров.",
    tools: "Наши инструменты",
    toolsText: "В этом репозитории функции и архитектурные решения записаны в файлах SpecScore. Страницы установки создаются из версионируемых инструкций: человек или агент может проверить те же шаги до установки CLI ovdb.",
    related: "Связанные проекты",
    relatedText: "DataTug помогает исследовать базы данных и запросы. TugQL задаёт язык запросов, DALgo обеспечивает доступ к данным, а inGitDB исследует хранение данных в Git.",
    privacy: "Конфиденциальность",
    analytics: "Настройки аналитики",
  },
};

export function renderTechStackPage(locale) {
  const c = copy[locale];
  if (!c) throw new Error(`unsupported tech stack locale: ${locale}`);
  const canonical = ORIGIN + route(locale);
  const home = locale === "en" ? "/" : "/ru";
  const alternate = locale === "en" ? "/ru/about/tech-stack" : "/about/tech-stack";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "AboutPage", url: canonical, name: c.title, description: c.description, inLanguage: locale },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: c.home, item: ORIGIN + home },
        { "@type": "ListItem", position: 2, name: c.crumb, item: canonical },
      ] },
    ],
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${c.title}</title>
  <meta name="description" content="${c.description}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${ORIGIN + route("en")}" />
  <link rel="alternate" hreflang="ru" href="${ORIGIN + route("ru")}" />
  <link rel="alternate" hreflang="x-default" href="${ORIGIN + route("en")}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/logo.png" type="image/png" sizes="512x512" />
  <link rel="apple-touch-icon" href="/logo.png" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${c.title}" />
  <meta property="og:description" content="${c.description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="${locale === "en" ? "en_US" : "ru_RU"}" />
  <meta property="og:image" content="${ORIGIN}/${locale === "en" ? "og.png" : "og-ru.png"}" />
  <link rel="stylesheet" href="/styles.css" />
  <script src="/js/analytics.js"></script>
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    .tech-head { padding: clamp(40px, 7vh, 80px) 0 10px; }
    .tech-head h1 { font-family: var(--font-display); font-size: clamp(32px, 5vw, 54px); line-height: 1.05; color: var(--navy); margin: 16px 0 0; }
    .tech-head p, .tech-body p { max-width: 68ch; color: var(--text-soft); font-size: 17px; }
    .tech-body { padding: 20px 0 72px; }
    .tech-body h2 { font-family: var(--font-display); font-size: clamp(22px, 3vw, 30px); color: var(--navy); margin: 42px 0 10px; }
    .tech-body a { color: var(--brass-deep); text-decoration: underline; }
    .tech-crumb { font-size: 14px; }
  </style>
</head>
<body>
  <header class="site-header"><div class="wrap">
    <a class="brand" href="${home}" aria-label="OpenVaultDB"><b>Open<span>Vault</span>DB</b></a>
    <nav class="nav" id="nav"><a href="${home}">${c.home}</a><a href="/docs">Docs</a><a href="/install">Install</a><a href="https://github.com/openvaultdb">GitHub ↗</a></nav>
    <a class="lang-switch" href="${alternate}" hreflang="${locale === "en" ? "ru" : "en"}" lang="${locale === "en" ? "ru" : "en"}">${c.switchLabel}</a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">☰</button>
  </div></header>
  <main id="main">
    <section class="tech-head"><div class="wrap" style="max-width:820px">
      <nav class="tech-crumb" aria-label="Breadcrumb"><a href="${home}">${c.home}</a> / ${c.crumb}</nav>
      <h1>${c.h1}</h1><p>${c.intro}</p>
    </div></section>
    <section class="tech-body"><div class="wrap" style="max-width:820px">
      <h2>${c.website}</h2><p>${c.websiteText}</p>
      <h2>${c.product}</h2><p>${c.productText} <a href="https://github.com/openvaultdb/openvaultdb-go">openvaultdb-go</a> · <a href="https://tugql.org/">TugQL</a> · <a href="https://dalgo.io/">DALgo</a> · <a href="https://ingitdb.com/">inGitDB</a>.</p>
      <h2>${c.tools}</h2><p>${c.toolsText} <a href="https://specscore.md/">SpecScore</a> · <a href="/agent-instructions/install">ovdb</a>.</p>
      <h2>${c.related}</h2><p>${c.relatedText} <a href="https://datatug.app/">DataTug</a> · <a href="https://tugql.org/">TugQL</a> · <a href="https://dalgo.io/">DALgo</a> · <a href="https://ingitdb.com/">inGitDB</a>.</p>
    </div></section>
  </main>
  <footer class="site-footer"><div class="wrap"><p>OpenVaultDB</p><p><a href="${home}">${c.home}</a> · <a href="${route(locale)}">${c.crumb}</a> · <a href="${locale === "en" ? "/privacy" : "/ru/privacy"}">${c.privacy}</a> · <button type="button" class="linklike" data-analytics-choices hidden>${c.analytics}</button> · <a href="https://github.com/openvaultdb">GitHub</a></p></div></footer>
  <script>var t=document.getElementById('navToggle'),n=document.getElementById('nav');t.addEventListener('click',function(){var open=n.classList.toggle('open');t.setAttribute('aria-expanded',String(open));});</script>
</body>
</html>
`;
}
