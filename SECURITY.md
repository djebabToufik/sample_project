# Security

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/djebabToufik/sample_project/security/advisories/new),
not in a public issue. You will get an answer within a few days.

Only the latest release is supported; the [public demo](https://demo.opensourceoeesoftware.com)
always runs it.

## In place

- Dependencies and base images are updated weekly by Dependabot; CodeQL analyzes the code on
  every pull request and weekly.
- Images are scanned with Trivy before they are published, and nightly afterwards.
- GitHub Actions are pinned to commit SHAs; deploys use short-lived OIDC credentials.
