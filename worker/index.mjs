export const CACHE_CONTROL = "public, max-age=0, must-revalidate";
export const NO_STORE = "no-store";

export const SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

function responseHeaders(request, response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  const cacheableMethod = request.method === "GET" || request.method === "HEAD";
  const successful = response.status >= 200 && response.status < 400;
  headers.set("Cache-Control", cacheableMethod && successful ? CACHE_CONTROL : NO_STORE);
  return headers;
}

export async function fetch(request, env) {
  const response = await env.ASSETS.fetch(request);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(request, response),
  });
}

export default { fetch };
