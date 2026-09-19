# Deploying openvaultdb.com

The public website is a Cloudflare Workers Static Assets application. Static
files live under `public/`; `worker/index.mjs` runs before every request, fetches
the matching asset through the `ASSETS` binding, and applies response headers.
The production Worker and custom domain are declared in `wrangler.jsonc`:

- Worker: `openvaultdb-com`
- custom domain: `openvaultdb.com`
- static assets: `public/`
- clean URL policy: drop trailing slashes

Firebase Authentication and Firestore remain in use by the browser code.
Firebase Hosting is not a production target.

## Build and verify

Use Node.js 20 or newer. From a clean checkout:

```sh
npm ci
npm run check
git diff --exit-code
```

`npm run check` regenerates the canonical AI instruction pages, runs all Node
unit tests, and executes a Wrangler deployment dry run. The tests cover the
Worker-to-`ASSETS` route, security/cache headers, Cloudflare configuration, and
the cold static installation routes.

To inspect a local Worker preview, choose an unused port and pass it explicitly;
do not assume the default port is free:

```sh
npx wrangler dev --local --port "$PORT"
```

The multi-service Playwright journey still uses Firebase's local Hosting, Auth,
and Firestore emulators. The `hosting` block in `firebase.json` and its fixed
emulator ports are local-test configuration only. Never run `firebase deploy
--only hosting`.

## Production deployment

There is intentionally no GitHub Actions deployment for Cloudflare. Deploying a
custom-domain Worker from CI would require a broad Cloudflare account token that
this repository does not have. The landing owner uses the already-authenticated
local Wrangler session:

```sh
npx wrangler whoami
npm run deploy:cloudflare
```

`npm run deploy:cloudflare` reruns the full check before `wrangler deploy`.
Wrangler applies the `openvaultdb.com` custom-domain declaration. If it reports
a DNS or existing-route conflict, stop and inspect the authoritative Cloudflare
DNS and Worker-route state. Remove or replace only records proven to belong to
the retired Firebase Hosting route; do not guess or broadly delete DNS.

Before changing traffic, confirm `openvaultdb.com` remains listed under Firebase
Authentication's authorized domains. The hosting cutover does not change the
browser's Firebase project or authentication providers.

The compatible `ovdb` CLI release must be public before publishing the AI
installation pages that depend on it.

## Post-deploy verification

Record the deployed Worker version:

```sh
npx wrangler versions list
```

Verify the apex and cold routes, following canonical clean-URL redirects:

```sh
curl -fsSIL https://openvaultdb.com/
curl -fsSIL https://openvaultdb.com/install
curl -fsSIL https://openvaultdb.com/agent-instructions/install
curl -fsSIL https://openvaultdb.com/agent-instructions/onboarding
curl -fsSIL https://openvaultdb.com/agent-instructions/configure
curl -fsSIL https://openvaultdb.com/install.sh
curl -fsSIL https://openvaultdb.com/install-skill.sh
curl -fsSIL https://openvaultdb.com/agent-skills/openvaultdb/SKILL.md
```

For each final response, verify the expected status and these Worker-owned
headers:

```text
Cache-Control: public, max-age=0, must-revalidate
Permissions-Policy: camera=(), geolocation=(), microphone=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

Finally, open the homepage, sign in with a Firebase test account, and verify a
Firestore-backed vault list. This confirms the hosting cutover did not remove
Firebase Auth or Firestore client behavior.

If the Worker release is faulty, use Wrangler's version history and roll back
to the last verified Worker version:

```sh
npx wrangler rollback
```

Do not fall back to Firebase Hosting implicitly.

## Firestore rules

`.github/workflows/firebase-deploy.yml` is intentionally limited to Firestore
rules and uses the existing keyless Google Workload Identity Federation setup.
It runs only when the rules or Firebase deployment configuration changes.

For an authorized manual rules deployment:

```sh
npx --yes firebase-tools@latest deploy --only firestore:rules --project openvaultdb --non-interactive
```

The Firebase web configuration in `public/js/firebase-init.js` is public client
configuration, not a server credential. Access remains governed by Firebase
Authentication and `firestore.rules`.
