import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content", "agent-instructions");
const publicDir = join(root, "public");
const skillSourcePath = join(root, "content", "agent-skills", "openvaultdb", "SKILL.md");
const skillInstallerTemplatePath = join(root, "scripts", "install-skill.template.sh");
const windowsInstallerTemplatePath = join(root, "scripts", "install.template.ps1");
const windowsSkillInstallerTemplatePath = join(root, "scripts", "install-skill.template.ps1");
const discoveryDir = join(root, "content", "discovery");
const homeStart = "  <!-- BEGIN GENERATED AI INSTALL -->";
const homeEnd = "  <!-- END GENERATED AI INSTALL -->";

export const shortPrompt = readFileSync(
  join(contentDir, "short-prompt.txt"),
  "utf8",
).trim();

export const instructionOrder = ["install", "onboarding", "configure"];
export const canonicalSkill = readFileSync(skillSourcePath, "utf8");

export function canonicalSkillSHA256() {
  return createHash("sha256").update(canonicalSkill).digest("hex");
}

export function readInstructions() {
  return Object.fromEntries(
    instructionOrder.map((name) => [
      name,
      readFileSync(join(contentDir, `${name}.md`), "utf8").trim(),
    ]),
  );
}

export function escapeHTML(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value) {
  return escapeHTML(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(https:\/\/openvaultdb\.com\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

export function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (code !== null) {
      if (line.startsWith("```")) {
        html.push(`<pre><code>${escapeHTML(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (line === "---") {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    const unordered = /^-\s+(.+)$/.exec(line);
    if (ordered || unordered) {
      flushParagraph();
      const wanted = ordered ? "ol" : "ul";
      if (list !== wanted) {
        closeList();
        html.push(`<${wanted}>`);
        list = wanted;
      }
      html.push(`<li>${inline((ordered || unordered)[1])}</li>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  if (code !== null) throw new Error("Unclosed Markdown code fence");
  return html.join("\n");
}

const siteOrigin = "https://openvaultdb.com";
const ogImage = `${siteOrigin}/og.png`;
const ogImageAlt = "OVDB — OpenVaultDB, user-owned application databases";

function header() {
  return `<header class="site-header"><div class="wrap doc-nav">
    <a class="brand" href="/" aria-label="OpenVaultDB home"><b>Open<span>Vault</span>DB</b></a>
    <nav aria-label="Main navigation"><a href="/install">Install</a><a href="/docs">Docs</a><a href="https://github.com/openvaultdb/ovdb">ovdb CLI ↗</a><a href="https://github.com/openvaultdb">GitHub ↗</a></nav>
  </div></header>`;
}

function socialHead({ title, description, path }) {
  const canonical = `${siteOrigin}${path}`;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: canonical,
    description,
    isPartOf: {
      "@type": "WebSite",
      name: "OpenVaultDB",
      alternateName: "OVDB",
      url: `${siteOrigin}/`,
    },
  }).replaceAll("<", "\\u003c");
  return `  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHTML(title)}">
  <meta property="og:description" content="${escapeHTML(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="OpenVaultDB">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHTML(ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHTML(title)}">
  <meta name="twitter:description" content="${escapeHTML(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:image:alt" content="${escapeHTML(ogImageAlt)}">
  <script type="application/ld+json">${structured}</script>`;
}

function page({ title, description, path, body, extraClass = "" }) {
  const fullTitle = `${title} · OpenVaultDB`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(fullTitle)}</title>
  <meta name="description" content="${escapeHTML(description)}">
${socialHead({ title: fullTitle, description, path })}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/logo.png" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/logo.png">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/agent-instructions.css">
</head>
<body class="doc-page ${extraClass}">
  ${header()}
  ${body}
  <script src="/js/copy-text.js" defer></script>
</body>
</html>
`;
}

function instructionPage(name, source) {
  const next = {
    install: '<a class="btn btn-primary" href="/agent-instructions/onboarding">Continue to onboarding</a>',
    onboarding: '<a class="btn btn-ghost" href="/agent-instructions/configure">Configure the server port</a>',
    configure: '<a class="btn btn-ghost" href="/agent-instructions/onboarding">Back to onboarding</a>',
  }[name];
  const titles = {
    install: "Install the OVDB CLI",
    onboarding: "Set up OVDB",
    configure: "Configure OVDB",
  };
  const descriptions = {
    install: "Official instructions for AI agents installing the OVDB CLI (OpenVaultDB).",
    onboarding: "Official OVDB onboarding instructions for AI agents: start the local server and create a first database.",
    configure: "Official OVDB instructions for AI agents changing and verifying local server settings.",
  };
  return page({
    title: titles[name],
    description: descriptions[name],
    path: `/agent-instructions/${name}`,
    body: `<main class="doc-shell wrap">
      <div class="doc-kicker">Official AI agent instructions</div>
      <div class="doc-actions"><button class="btn btn-primary" type="button" data-copy-target="instruction-source" aria-live="polite">Copy these instructions</button><a class="btn btn-ghost" href="/install">All install options</a></div>
      <article class="instruction-content">${renderMarkdown(source)}</article>
      <textarea id="instruction-source" class="copy-source" aria-hidden="true" tabindex="-1">${escapeHTML(source)}</textarea>
      <div class="doc-actions">${next}</div>
    </main>`,
  });
}

function installPage(instructions) {
  const full = instructionOrder.map((name) => instructions[name]).join("\n\n---\n\n");
  return page({
    title: "Install OVDB",
    description: "Install the OVDB CLI and set up OpenVaultDB with an AI agent or a checksum-verified script.",
    path: "/install",
    extraClass: "install-page",
    body: `<main class="doc-shell wrap">
      <div class="doc-kicker">AI-assisted setup</div>
      <h1>Install OVDB</h1>
      <p class="doc-lead">Copy one prompt into your coding or terminal agent to set up OpenVaultDB. It will use deterministic <code>ovdb</code> commands and stop on errors.</p>
      <section class="copy-panel" aria-labelledby="short-title">
        <div class="copy-panel-head"><div><div class="option-label">Recommended</div><h2 id="short-title">Short prompt</h2></div><button class="btn btn-primary" type="button" data-copy-target="short-prompt" aria-live="polite">Copy short prompt</button></div>
        <pre><code id="short-prompt">${escapeHTML(shortPrompt)}</code></pre>
      </section>
      <section class="copy-panel" aria-labelledby="full-title">
        <div class="copy-panel-head"><div><div class="option-label">Self-contained · no further instruction-page access</div><h2 id="full-title">Full instructions</h2></div><button class="btn btn-ghost" type="button" data-copy-target="full-instructions" aria-live="polite">Copy full instructions</button></div>
        <pre class="full-instructions"><code id="full-instructions">${escapeHTML(full)}</code></pre>
      </section>
      <section class="route-links" aria-labelledby="route-title"><h2 id="route-title">Read the instructions online</h2>
        <a href="/agent-instructions/install"><strong>Install</strong><span>Get and verify the CLI, then offer the official skill.</span></a>
        <a href="/agent-instructions/onboarding"><strong>Onboarding</strong><span>Start the server and create a useful first database.</span></a>
        <a href="/agent-instructions/configure"><strong>Configure</strong><span>Change and verify the local server port.</span></a>
      </section>
    </main>`,
  });
}

// Per-locale copy for the generated homepage install block. Commands and the
// agent prompt are identical in every locale (code stays as is); only the
// surrounding words are translated. The rest of each homepage is hand-written
// in public/index.html (en) and public/ru/index.html (ru).
const homeInstallCopy = {
  en: {
    eyebrow: "Install OpenVaultDB",
    title: "Ask your agent—or run one command.",
    lead: "The direct installers download the matching official release, verify its SHA-256 checksum, and need no Go toolchain.",
    more: "See full install options",
    agent: "AI agent",
    recommended: "Recommended",
    unix: "macOS or Linux",
    terminal: "Terminal",
    windows: "Windows",
    powershell: "PowerShell",
    copyPrompt: "Copy prompt",
    copyCommand: "Copy command",
    copied: "Copied",
    copyFailed: "Copy failed — select the text below",
    trust: `These shortcuts trust the installer served by <code>openvaultdb.com</code>. <a href="/install.sh">Review shell source</a> · <a href="/install.ps1">Review PowerShell source</a>. Each installer verifies the downloaded release checksum before installing it. Prefer <a href="/agent-instructions/install">Homebrew through the guided install</a> when you want package-manager provenance.`,
  },
  ru: {
    eyebrow: "Установка OpenVaultDB",
    title: "Попросите агента — или выполните одну команду.",
    lead: "Прямые установщики скачивают подходящий официальный релиз, проверяют его контрольную сумму SHA-256 и не требуют Go.",
    more: "Все варианты установки (на английском)",
    agent: "ИИ-агент",
    recommended: "Рекомендуется",
    unix: "macOS или Linux",
    terminal: "Терминал",
    windows: "Windows",
    powershell: "PowerShell",
    copyPrompt: "Скопировать запрос",
    copyCommand: "Скопировать команду",
    copied: "Скопировано",
    copyFailed: "Не удалось скопировать — выделите текст ниже",
    trust: `Эти команды доверяют установщику, который отдаёт <code>openvaultdb.com</code>. <a href="/install.sh">Исходник для shell</a> · <a href="/install.ps1">Исходник для PowerShell</a>. Каждый установщик проверяет контрольную сумму скачанного релиза перед установкой. Если вам важна поставка через менеджер пакетов, выбирайте <a href="/agent-instructions/install" lang="en">Homebrew через пошаговую установку</a> (на английском).`,
  },
};

export const homePages = { en: "index.html", ru: "ru/index.html" };

function homeInstallSection(locale = "en") {
  const c = homeInstallCopy[locale];
  // English is the built-in default in public/js/copy-text.js, so only other locales carry labels.
  const copied = locale === "en" ? "" : `data-copied="${escapeHTML(c.copied)}" data-copy-failed="${escapeHTML(c.copyFailed)}" `;
  const more = locale === "en" ? "" : ' lang="en"';
  return `${homeStart}
  <section class="home-install" aria-labelledby="home-install-title">
    <div class="wrap">
      <div class="home-install-copy">
        <span class="eyebrow">${c.eyebrow}</span>
        <h2 id="home-install-title">${c.title}</h2>
        <p>${c.lead}</p>
        <a class="btn btn-ghost" href="/install"${more}>${c.more}</a>
      </div>
      <div class="home-install-options">
        <article class="home-install-option home-prompt">
          <div class="home-install-option-head"><span>${c.agent}</span><strong>${c.recommended}</strong></div>
          <pre><code id="home-short-prompt">${escapeHTML(shortPrompt)}</code></pre>
          <button class="btn btn-primary" type="button" data-copy-target="home-short-prompt" ${copied}aria-live="polite">${c.copyPrompt}</button>
        </article>
        <article class="home-install-option">
          <div class="home-install-option-head"><span>${c.unix}</span><strong>${c.terminal}</strong></div>
          <pre><code id="home-unix-install">(p=$(mktemp) &amp;&amp; trap 'rm -f "$p"' EXIT &amp;&amp; curl -fsSL https://openvaultdb.com/install.sh -o "$p" &amp;&amp; sh "$p")</code></pre>
          <button class="btn btn-ghost" type="button" data-copy-target="home-unix-install" ${copied}aria-live="polite">${c.copyCommand}</button>
        </article>
        <article class="home-install-option">
          <div class="home-install-option-head"><span>${c.windows}</span><strong>${c.powershell}</strong></div>
          <pre><code id="home-windows-install">$p=Join-Path $env:TEMP ("ovdb-"+[guid]::NewGuid()+".ps1"); try { irm https://openvaultdb.com/install.ps1 -OutFile $p -EA Stop; &amp; $p } finally { Remove-Item $p -EA SilentlyContinue }</code></pre>
          <button class="btn btn-ghost" type="button" data-copy-target="home-windows-install" ${copied}aria-live="polite">${c.copyCommand}</button>
        </article>
        <p class="home-install-trust">${c.trust}</p>
      </div>
    </div>
  </section>
  ${homeEnd}`;
}

function generatedHomepage(locale = "en") {
  const file = homePages[locale];
  const source = readFileSync(join(publicDir, file), "utf8");
  const start = source.indexOf(homeStart);
  const end = source.indexOf(homeEnd);
  if (start < 0 || end < start) {
    throw new Error(`public/${file} is missing the generated AI install markers`);
  }
  return source.slice(0, start) + homeInstallSection(locale) + source.slice(end + homeEnd.length);
}

function generatedSkillInstaller() {
  return readFileSync(skillInstallerTemplatePath, "utf8").replaceAll(
    "__SKILL_SHA256__",
    canonicalSkillSHA256(),
  );
}

function generatedWindowsSkillInstaller() {
  return readFileSync(windowsSkillInstallerTemplatePath, "utf8").replaceAll(
    "__SKILL_SHA256__",
    canonicalSkillSHA256(),
  );
}

// Shared by every generated public page; account and connect pages stay isolated.
const feedbackLabel = { en: "Suggest an improvement", ru: "Предложить улучшение" };

export function addFeedback(html, locale = "en") {
  if (html.includes('id="site-feedback-widget"')) return html;
  return html.replace('</body>', `<div class="site-feedback"><button type="button" data-feedback-launcher aria-haspopup="dialog" hidden>${feedbackLabel[locale]}</button></div>
  <script id="site-feedback-widget" src="https://improveit.now/widget.js" data-space="ao58m" data-app="0e96104c8a9188fbdae1ea49369ece23" data-lang="${locale}" data-color="#0d63e9" data-launcher="hidden" defer></script>
  <script src="/js/feedback.js" defer></script>
</body>`);
}

export function buildOutputs() {
  const instructions = readInstructions();
  const outputs = new Map();
  for (const name of instructionOrder) {
    outputs.set(`agent-instructions/${name}/index.html`, instructionPage(name, instructions[name]));
  }
  outputs.set("install/index.html", installPage(instructions));
  for (const locale of Object.keys(homePages)) {
    outputs.set(homePages[locale], generatedHomepage(locale));
  }
  outputs.set("agent-skills/openvaultdb/SKILL.md", canonicalSkill);
  outputs.set("install.ps1", readFileSync(windowsInstallerTemplatePath, "utf8"));
  outputs.set("install-skill.sh", generatedSkillInstaller());
  outputs.set("install-skill.ps1", generatedWindowsSkillInstaller());
  for (const name of ["robots.txt", "sitemap.xml", "llms.txt"]) {
    outputs.set(name, readFileSync(join(discoveryDir, name), "utf8"));
  }
  for (const [path, html] of outputs) {
    if (path.endsWith(".html")) outputs.set(path, addFeedback(html, path.startsWith("ru/") ? "ru" : "en"));
  }
  return outputs;
}

export function writeOutputs(outputs = buildOutputs()) {
  for (const [relativePath, contents] of outputs) {
    const path = join(publicDir, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeOutputs();
}
