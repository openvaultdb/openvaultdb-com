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

function header() {
  return `<header class="site-header"><div class="wrap doc-nav">
    <a class="brand" href="/" aria-label="OpenVaultDB home"><b>Open<span>Vault</span>DB</b></a>
    <nav aria-label="Main navigation"><a href="/install">Install</a><a href="/docs/">Docs</a><a href="https://github.com/openvaultdb">GitHub ↗</a></nav>
  </div></header>`;
}

function page({ title, description, body, extraClass = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(title)} · OpenVaultDB</title>
  <meta name="description" content="${escapeHTML(description)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
  return page({
    title: `${name[0].toUpperCase()}${name.slice(1)} instructions`,
    description: `Official OpenVaultDB ${name} instructions for AI agents.`,
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
    title: "Install",
    description: "Install and set up OpenVaultDB with an AI agent.",
    extraClass: "install-page",
    body: `<main class="doc-shell wrap">
      <div class="doc-kicker">AI-assisted setup</div>
      <h1>Install OpenVaultDB</h1>
      <p class="doc-lead">Copy one prompt into your coding or terminal agent. It will use deterministic <code>ovdb</code> commands and stop on errors.</p>
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

function homeInstallSection() {
  return `${homeStart}
  <section class="home-install" aria-labelledby="home-install-title">
    <div class="wrap">
      <div class="home-install-copy">
        <span class="eyebrow">Install OpenVaultDB</span>
        <h2 id="home-install-title">Ask your agent—or run one command.</h2>
        <p>The direct installers download the matching official release, verify its SHA-256 checksum, and need no Go toolchain.</p>
        <a class="btn btn-ghost" href="/install">See full install options</a>
      </div>
      <div class="home-install-options">
        <article class="home-install-option home-prompt">
          <div class="home-install-option-head"><span>AI agent</span><strong>Recommended</strong></div>
          <pre><code id="home-short-prompt">${escapeHTML(shortPrompt)}</code></pre>
          <button class="btn btn-primary" type="button" data-copy-target="home-short-prompt" aria-live="polite">Copy prompt</button>
        </article>
        <article class="home-install-option">
          <div class="home-install-option-head"><span>macOS or Linux</span><strong>Terminal</strong></div>
          <pre><code id="home-unix-install">(p=$(mktemp) &amp;&amp; trap 'rm -f "$p"' EXIT &amp;&amp; curl -fsSL https://openvaultdb.com/install.sh -o "$p" &amp;&amp; sh "$p")</code></pre>
          <button class="btn btn-ghost" type="button" data-copy-target="home-unix-install" aria-live="polite">Copy command</button>
        </article>
        <article class="home-install-option">
          <div class="home-install-option-head"><span>Windows</span><strong>PowerShell</strong></div>
          <pre><code id="home-windows-install">$p=Join-Path $env:TEMP ("ovdb-"+[guid]::NewGuid()+".ps1"); try { irm https://openvaultdb.com/install.ps1 -OutFile $p -EA Stop; &amp; $p } finally { Remove-Item $p -EA SilentlyContinue }</code></pre>
          <button class="btn btn-ghost" type="button" data-copy-target="home-windows-install" aria-live="polite">Copy command</button>
        </article>
        <p class="home-install-trust">These shortcuts trust the installer served by <code>openvaultdb.com</code>. <a href="/install.sh">Review shell source</a> · <a href="/install.ps1">Review PowerShell source</a>. Each installer verifies the downloaded release checksum before installing it. Prefer <a href="/agent-instructions/install">Homebrew through the guided install</a> when you want package-manager provenance.</p>
      </div>
    </div>
  </section>
  ${homeEnd}`;
}

function generatedHomepage() {
  const source = readFileSync(join(publicDir, "index.html"), "utf8");
  const start = source.indexOf(homeStart);
  const end = source.indexOf(homeEnd);
  if (start < 0 || end < start) {
    throw new Error("public/index.html is missing the generated AI install markers");
  }
  return source.slice(0, start) + homeInstallSection() + source.slice(end + homeEnd.length);
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

export function buildOutputs() {
  const instructions = readInstructions();
  const outputs = new Map();
  for (const name of instructionOrder) {
    outputs.set(`agent-instructions/${name}/index.html`, instructionPage(name, instructions[name]));
  }
  outputs.set("install/index.html", installPage(instructions));
  outputs.set("index.html", generatedHomepage());
  outputs.set("agent-skills/openvaultdb/SKILL.md", canonicalSkill);
  outputs.set("install.ps1", readFileSync(windowsInstallerTemplatePath, "utf8"));
  outputs.set("install-skill.sh", generatedSkillInstaller());
  outputs.set("install-skill.ps1", generatedWindowsSkillInstaller());
  for (const name of ["robots.txt", "sitemap.xml", "llms.txt"]) {
    outputs.set(name, readFileSync(join(discoveryDir, name), "utf8"));
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
