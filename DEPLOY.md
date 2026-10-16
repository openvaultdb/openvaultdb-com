# Deploying openvaultdb.com

The public website is a Cloudflare Workers Static Assets application. Static
files live under `public/` and are served by Cloudflare static assets with no
Worker script (`wrangler.jsonc` has no `main`), so requests are free and never
count against the Workers request quota. Security and cache headers come from
`public/_headers`.
The production Worker and custom domain are declared in `wrangler.jsonc`:

- Worker: `openvaultdb-com`
- custom domain: `openvaultdb.com`
- static assets: `public/`
- clean URL policy: drop trailing slashes

Firebase Authentication and Firestore remain in use by the browser code.
Firebase Hosting is not a production target.

## Build and verify

Use Node.js 22 or newer. From a clean checkout:

```sh
npm ci
npm run check
git diff --exit-code
```

`npm run check` regenerates the canonical AI instruction pages, runs all Node
unit tests, and executes a Wrangler deployment dry run. The tests cover the
assets-only configuration, `_headers` security/cache rules, Cloudflare configuration, and
the cold static installation routes.

To inspect a local preview, start with the example port below. The
example port may already be in use; if it is, choose another unused port:

```sh
PORT=8976
npx wrangler dev --local --port "$PORT"
```

The multi-service Playwright journey still uses Firebase's local Hosting, Auth,
and Firestore emulators. The `hosting` block in `firebase.json` and its fixed
emulator ports are local-test configuration only. Never run `firebase deploy
--only hosting`.

## Production deployment

[Build and deploy website](.github/workflows/verify-agent-instructions.yml)
runs for pull requests, main pushes, and manual dispatches. Its verify job
installs the lockfile, generates canonical static routes once with `npm run
build`, checks generated-content drift, runs all Node tests, and dry-runs
Wrangler. It archives `public/`, `wrangler.jsonc`, `package.json`, and
`package-lock.json` as `site.tar.gz` in the `site-<source SHA>` artifact. Tar
preserves dotfiles, `_headers`, and `_redirects` when present.

Automatic publication is disabled unless `CLOUDFLARE_DEPLOY_ENABLED` is `true`.
When enabled, only a main push or manual dispatch on main publishes. The
production job downloads that same run's artifact, installs the locked Wrangler dependency
with `npm ci`, and runs `npm exec --no -- wrangler deploy --config
wrangler.jsonc`. It does not regenerate or rebuild the site. In particular,
CI does not run `npm run deploy:cloudflare`, which repeats the build and tests.
The publish job verifies the recorded source SHA and archive SHA-256 before
extracting. Artifacts are retained for 14 days; production deployments are
serialized.

### CI credentials and activation

Set the GitHub `CLOUDFLARE_API_TOKEN` secret (repository or `production`
environment) to a token authorized to deploy this Worker and its declared
routes in the production Cloudflare account. `CLOUDFLARE_ACCOUNT_ID` is an
optional GitHub variable; the workflow defaults to the public account identifier
`01c8a86fc1064f063eb5dd9d101d7001`. Build jobs do not receive the token.

Automatic production publication is **disabled** until scoped credentials are
configured and the GitHub variable `CLOUDFLARE_DEPLOY_ENABLED` is set to `true`.
First-run activation is **not executed**. Build artifacts remain available
while the publish job is skipped. The landing owner can publish a verified
GitHub build artifact using an authenticated local Wrangler session instead
of copying an account credential into GitHub.

After a verified artifact is published, record the run's source SHA, archive
checksum, Wrangler version receipt, and public routes. Disable the old
Cloudflare Git production build trigger. Do not configure a Cloudflare build
command or rebuild in the publish job.

## Publish a GitHub build artifact

This procedure is **not executed** until a successful build run is available.
Choose a successful main run for the intended source SHA. Download its
`site-<source SHA>` artifact with `gh run download <run-id> --name
site-<source SHA> --dir <empty-release-directory>`, then enter that directory:

```sh
# Replace with the exact source SHA of the successful GitHub build run.
EXPECTED_SOURCE_SHA='<source-sha>'
test "$(cat source-sha.txt)" = "$EXPECTED_SOURCE_SHA"
sha256sum --check site.tar.gz.sha256
# macOS alternative: shasum -a 256 --check site.tar.gz.sha256
tar -xzf site.tar.gz
npm ci
npm exec --no -- wrangler deploy --config wrangler.jsonc
```

Use the downloaded assets and configuration together. Do not
rebuild source before publishing this artifact.

## Manual deployment

For an authorized local deployment:

```sh
npm run deploy:cloudflare
```

This local convenience command reruns the full check before deploying.
Wrangler applies the `openvaultdb.com` custom-domain declaration. If it reports
a DNS or existing-route conflict, stop and inspect the authoritative Cloudflare
DNS and Worker-route state. Remove or replace only records proven to belong to
the retired Firebase Hosting route.

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
curl -fsSIL https://openvaultdb.com/install.ps1
curl -fsSIL https://openvaultdb.com/install-skill.sh
curl -fsSIL https://openvaultdb.com/install-skill.ps1
curl -fsSIL https://openvaultdb.com/robots.txt
curl -fsSIL https://openvaultdb.com/sitemap.xml
curl -fsSIL https://openvaultdb.com/llms.txt
curl -fsSIL https://openvaultdb.com/agent-skills/openvaultdb/SKILL.md
```

For each final response, verify the expected status and these `_headers`-owned
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
