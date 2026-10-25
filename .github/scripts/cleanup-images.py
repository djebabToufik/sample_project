"""Deletes old image versions from GitHub Container Registry.

A version (one digest, with any number of tags) is kept when:
  - one of its tags is main, latest or a version (1.0.3, 1.0), or
  - it is younger than KEEP_DAYS (open pull requests still use their images), or
  - a kept version points to it (a multi-manifest index needs the images it lists).
Every other version is deleted: old tree-* and sha-* images and untagged leftovers.

Environment: GITHUB_TOKEN, OWNER, PACKAGES (space separated), KEEP_DAYS, DRY_RUN (true/false).
"""

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta

API = 'https://api.github.com'
KEEP_TAG = re.compile(r'^(main|latest|\d+\.\d+(\.\d+)?)$')
INDEX_TYPES = {
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
}
ACCEPT_MANIFESTS = ', '.join(
    [
        *INDEX_TYPES,
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.docker.distribution.manifest.v2+json',
    ]
)

TOKEN = os.environ['GITHUB_TOKEN']
OWNER = os.environ['OWNER']
PACKAGES = os.environ['PACKAGES'].split()
KEEP_DAYS = int(os.environ.get('KEEP_DAYS', '14'))
DRY_RUN = os.environ.get('DRY_RUN', 'true') == 'true'


def request(url, method='GET', headers=None):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else None, response.headers


def github(path, method='GET'):
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    return request(f'{API}{path}', method, headers)


def versions(package):
    page, result = 1, []
    while True:
        batch, _ = github(f'/users/{OWNER}/packages/container/{package}/versions?per_page=100&page={page}')
        result += batch
        if len(batch) < 100:
            return result
        page += 1


def child_digests(package, digest):
    """Digests listed by an index (empty for a plain image manifest)."""
    basic = base64.b64encode(f'{OWNER}:{TOKEN}'.encode()).decode()
    scope = f'repository:{OWNER.lower()}/{package}:pull'
    auth, _ = request(f'https://ghcr.io/token?scope={scope}', headers={'Authorization': f'Basic {basic}'})
    try:
        manifest, headers = request(
            f'https://ghcr.io/v2/{OWNER.lower()}/{package}/manifests/{digest}',
            headers={'Authorization': f'Bearer {auth["token"]}', 'Accept': ACCEPT_MANIFESTS},
        )
    except urllib.error.HTTPError as error:
        if error.code == 404:  # deleted meanwhile: lists nothing
            return set()
        raise
    if headers.get('Content-Type', '').split(';')[0] not in INDEX_TYPES:
        return set()
    return {entry['digest'] for entry in manifest.get('manifests', [])}


def created(version):
    return datetime.fromisoformat(version['created_at'].replace('Z', '+00:00'))


def plan(package):
    """(kept, deleted) lists of (version, reason)."""
    cutoff = datetime.now(UTC) - timedelta(days=KEEP_DAYS)
    all_versions = versions(package)
    kept, reasons = {}, {}
    for version in all_versions:
        tags = version['metadata']['container']['tags']
        if any(KEEP_TAG.match(tag) for tag in tags):
            kept[version['name']], reasons[version['name']] = version, 'release or main tag'
        elif created(version) > cutoff:
            kept[version['name']], reasons[version['name']] = version, f'younger than {KEEP_DAYS} days'
    for digest in list(kept):
        for child in child_digests(package, digest):
            reasons.setdefault(child, 'listed by a kept image')
            kept.setdefault(child, None)
    deleted = [v for v in all_versions if v['name'] not in kept]
    return [(v, reasons[v['name']]) for v in all_versions if v['name'] in kept], deleted


def describe(version):
    tags = ', '.join(version['metadata']['container']['tags']) or '(untagged)'
    return f'{version["name"][:19]}  {version["created_at"][:10]}  {tags}'


def main():
    summary = [f'### Image cleanup{" (dry run: nothing deleted)" if DRY_RUN else ""}', '']
    for package in PACKAGES:
        kept, deleted = plan(package)
        print(f'== {package}: keep {len(kept)}, delete {len(deleted)}')
        for version, reason in kept:
            print(f'   keep    {describe(version)}  [{reason}]')
        for version in deleted:
            print(f'   delete  {describe(version)}')
            if not DRY_RUN:
                github(f'/users/{OWNER}/packages/container/{package}/versions/{version["id"]}', method='DELETE')
        summary.append(f'- `{package}`: kept {len(kept)}, {"would delete" if DRY_RUN else "deleted"} {len(deleted)}')
    with open(os.environ.get('GITHUB_STEP_SUMMARY', os.devnull), 'a', encoding='utf-8') as file:
        file.write('\n'.join(summary) + '\n')


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        sys.exit(f'GitHub API error {error.code} on {error.url}: {error.read().decode()[:300]}')
