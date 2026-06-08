#!/usr/bin/env python3
import hashlib
import json
import os
import re
import shutil
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


PLUGIN = {
    "guid": "8e947a62-b5e1-4d6a-a70c-486996db901f",
    "name": "Jellyfin Miner",
    "description": "Follow Jellyfin subtitles and mine selected cues to Anki with screenshots and audio.",
    "overview": "Subtitle follower and Anki mining tool for Jellyfin playback sessions.",
    "owner": "friedrich-de",
    "category": "General",
}


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def version_key(version):
    return tuple(int(part) for part in version.split("."))


def timestamp(value):
    if not value:
        return "1970-01-01T00:00:00.0000000Z"
    if value.endswith("Z") and "." not in value:
        return f"{value[:-1]}.0000000Z"
    return value


def github_json(url, token):
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/vnd.github+json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")

    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def github_asset_md5(asset_url, token):
    request = urllib.request.Request(asset_url)
    request.add_header("Accept", "application/octet-stream")
    if token:
        request.add_header("Authorization", f"Bearer {token}")

    digest = hashlib.md5()
    with urllib.request.urlopen(request) as response:
        for chunk in iter(lambda: response.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_md5(path):
    digest = hashlib.md5()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_icon(package, output_dir):
    icon_path = output_dir / "icons" / "icon-512.png"
    icon_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(package) as archive:
        icon_path.write_bytes(archive.read("Jellyfin Miner/wwwroot/icons/icon-512.png"))


def release_versions(repository, target_abi, token):
    releases_url = f"https://api.github.com/repos/{repository}/releases?per_page=100"
    tag_pattern = re.compile(r"^v(\d+\.\d+\.\d+\.\d+)$")
    versions = []
    seen = set()

    for release in github_json(releases_url, token):
        if release.get("draft") or release.get("prerelease"):
            continue

        match = tag_pattern.fullmatch(release.get("tag_name", ""))
        if not match:
            continue

        version = match.group(1)
        if version in seen:
            continue

        asset_name = f"jellyfin-miner-{version}.zip"
        asset = next((item for item in release.get("assets", []) if item.get("name") == asset_name), None)
        if not asset:
            continue

        versions.append(
            {
                "version": version,
                "changelog": release.get("body") or "Jellyfin Miner release.",
                "targetAbi": target_abi,
                "sourceUrl": asset["browser_download_url"],
                "checksum": github_asset_md5(asset["url"], token),
                "timestamp": timestamp(release.get("published_at") or release.get("created_at")),
            }
        )
        seen.add(version)

    return sorted(versions, key=lambda item: version_key(item["version"]), reverse=True)


def current_release_version(repository, current_version, target_abi, package):
    tag = os.environ.get("GITHUB_REF_NAME") or f"v{current_version}"
    asset_name = f"jellyfin-miner-{current_version}.zip"

    return {
        "version": current_version,
        "changelog": "Jellyfin Miner release.",
        "targetAbi": target_abi,
        "sourceUrl": f"https://github.com/{repository}/releases/download/{tag}/{asset_name}",
        "checksum": file_md5(package),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.0000000Z"),
    }


def main():
    package = Path(require_env("PACKAGE"))
    repository = require_env("GITHUB_REPOSITORY")
    owner = require_env("GITHUB_REPOSITORY_OWNER")
    current_version = require_env("CURRENT_VERSION")
    target_abi = os.environ.get("TARGET_ABI", "10.11.9.0")
    token = os.environ.get("GITHUB_TOKEN", "")
    output_dir = Path(os.environ.get("PLUGIN_REPOSITORY_DIR", "artifacts/plugin-repository"))
    base_url = f"https://{owner}.github.io/{repository.split('/', 1)[1]}"

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    copy_icon(package, output_dir)
    versions = release_versions(repository, target_abi, token)

    if current_version not in {item["version"] for item in versions}:
        versions.append(current_release_version(repository, current_version, target_abi, package))
        versions.sort(key=lambda item: version_key(item["version"]), reverse=True)

    manifest = [dict(PLUGIN, imageUrl=f"{base_url}/icons/icon-512.png", versions=versions)]
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
