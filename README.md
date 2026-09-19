# openvaultdb-com

Source code for the [OpenVaultDB.com](https://openvaultdb.com/) website and documentation portal.

<!-- dev-approach:v1 -->
## Our approach to development

We build with our own tooling:

- **[SpecScore](https://specscore.md)** — specify requirements as `SpecScore.md` artifacts
- **[SpecStudio](https://specscore.studio)** — author & manage specs across their lifecycle
- **[inGitDB](https://ingitdb.com)** — store structured data in Git where applicable
- **[DALgo](https://dalgo.io)** — data access layer for Go
- **[cover100.dev](https://cover100.dev)** — drive toward 100% test coverage
- **[DataTug](https://datatug.io)** — query & explore data
<!-- /dev-approach -->

## About OpenVaultDB

OpenVaultDB is an open platform for user-owned application databases. It enables applications to store and access data in user-controlled storage through standard APIs, portable storage backends, and open specifications.

Learn more at https://openvaultdb.com

## Repository Structure

```text
/
├── website/        Website source code
├── docs/           Documentation and specifications
├── blog/           Blog posts and announcements
├── static/         Static assets
└── infrastructure/ Deployment and infrastructure configuration
```

## Deployment

The repository still contains a legacy Firebase deployment workflow. It is
not the target hosting architecture: the public web surface must move to the
OpenVaultDB Cloudflare landing worker before this onboarding flow is called
production-ready. This MVP does not deploy or perform that hosting cutover.

The canonical AI installation instructions live in
`content/agent-instructions`; the canonical standalone skill lives in
`content/agent-skills`. Generate the cold-static `/install`,
`/agent-instructions/*`, homepage prompt, public skill, and verified skill
installer before publishing:

```sh
npm run build
npm test
```

The read-only `Verify AI installation instructions` workflow checks this on
matching pushes and pull requests. It is not an authoritative deployment gate
and does not legitimize the legacy Firebase deployment; launch still requires
the separate Cloudflare cutover.

Release order matters: first publish an `ovdb` release whose normal help
contains the documented onboarding commands, then publish the generated web
pages. The install instructions verify that command surface and stop on an
older release.

Maintainers can run the versioned Luna clean-room procedure in
[docs/ai-installation-acceptance.md](docs/ai-installation-acceptance.md).

## Related Projects

- OpenVaultDB — Protocol and platform
- [DTQL](https://dtql.org) — Query language
- [DALgo](https://dalgo.io) — Data abstraction layer
- [inGitDB](https://ingitdb.com) — Git-backed storage engine
- [INGR.io](https://ingr.io) — Git-friendly storage format
- [DataTug](https://datatug.io) — Data explorer and administration tools

## License

See [LICENSE](LICENSE) file for details.
