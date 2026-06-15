# Deploying openvaultdb.com to Firebase Hosting

This site is a static, build-less collection of pages under `public/`
(`index.html`, the `docs/` pages, the `account/` page, `styles.css`, `js/`,
`favicon.svg`). It deploys to **Firebase Hosting** (project `openvaultdb`).

There is no build step — `public/` is served as-is.

## Files

```
openvaultdb-com/
├── public/                     ← everything served to the browser
│   ├── index.html
│   ├── styles.css
│   ├── favicon.svg
│   ├── js/                     ← Firebase init + auth UI (ES modules, CDN SDK)
│   ├── docs/ …
│   └── account/index.html      ← signed-in user page (My Vaults / My Apps)
├── firebase.json               ← Hosting config (public dir, clean URLs)
├── .firebaserc                 ← default project: openvaultdb
└── .github/workflows/firebase-deploy.yml
```

## One-time setup

1. Install the Firebase CLI and sign in:
   ```sh
   npm install -g firebase-tools
   firebase login
   ```

2. CI auth is **keyless**, via Workload Identity Federation (the org policy
   `iam.disableServiceAccountKeyCreation` forbids long-lived SA keys). The
   workflow uses `google-github-actions/auth@v2` against a WIF provider. The
   one-time GCP setup (already applied) was:
   ```sh
   # service account + Firebase Hosting Admin
   gcloud iam service-accounts create github-deploy --project=openvaultdb
   gcloud projects add-iam-policy-binding openvaultdb \
     --member="serviceAccount:github-deploy@openvaultdb.iam.gserviceaccount.com" \
     --role="roles/firebasehosting.admin" --condition=None
   # WIF pool + GitHub OIDC provider (restricted to the openvaultdb org)
   gcloud iam workload-identity-pools create github --project=openvaultdb --location=global
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --project=openvaultdb --location=global --workload-identity-pool=github \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
     --attribute-condition="assertion.repository_owner=='openvaultdb'"
   # let this repo impersonate the SA
   gcloud iam service-accounts add-iam-policy-binding github-deploy@openvaultdb.iam.gserviceaccount.com \
     --project=openvaultdb --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/323159488879/locations/global/workloadIdentityPools/github/attribute.repository/openvaultdb/openvaultdb-com"
   ```
   No GitHub secrets are required.

## Preview locally

```sh
firebase emulators:start --only hosting
# or:
firebase serve --only hosting
```
Serves `public/` at `http://localhost:5000`.

## Deploy

Automatic: every push to `main` runs
`.github/workflows/firebase-deploy.yml`, which deploys `public/` to the **live**
channel via `FirebaseExtended/action-hosting-deploy`.

Manual:
```sh
firebase deploy --only hosting
```

## Attach the custom domain (openvaultdb.com)

DNS currently points at Cloudflare and must be moved to Firebase Hosting:

1. Firebase console → **Hosting** → **Add custom domain** → `openvaultdb.com`
   (and `www.openvaultdb.com` if wanted).
2. Firebase shows the DNS records to set (a `TXT` for verification, then `A`
   records — or the provided records). Apply them at your DNS provider.
3. Firebase provisions the TLS certificate automatically once DNS propagates.

## Auth notes

- Sign-in uses Firebase Authentication (GitHub, Google, email/password). Enable
  each provider in the Firebase console: **Authentication → Sign-in method**.
- `openvaultdb.firebaseapp.com`, `openvaultdb.web.app`, and `localhost` are
  authorized redirect domains by default. Add `openvaultdb.com` under
  **Authentication → Settings → Authorized domains** once the custom domain is
  live.
- The web `apiKey` in `public/js/firebase-init.js` is not a secret; it is safe to
  commit (Firebase access is governed by Auth + security rules, not the key).
