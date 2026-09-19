(() => {
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy command was rejected");
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-target]");
    if (!button) return;
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;
    const original = button.textContent;
    button.disabled = true;
    try {
      await copyText(target.value ?? target.textContent);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed — select the text below";
    }
    button.disabled = false;
    window.setTimeout(() => {
      button.textContent = original;
    }, 2200);
  });
})();
