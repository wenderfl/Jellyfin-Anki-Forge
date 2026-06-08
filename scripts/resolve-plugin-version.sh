#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${ROOT}/Jellyfin.Plugin.JellyfinMiner/Jellyfin.Plugin.JellyfinMiner.csproj"

is_release="false"

if [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
  if [[ ! "${GITHUB_REF_NAME:-}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Release tags must use vX.Y.Z.W, for example v1.2.3.4; got: ${GITHUB_REF_NAME:-}" >&2
    exit 1
  fi

  version="${GITHUB_REF_NAME#v}"
  is_release="true"
else
  version="$(dotnet msbuild "${PROJECT}" -nologo -getProperty:Version)"
fi

if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Plugin version must be a four-part version like 1.2.3.4; got: ${version}" >&2
  exit 1
fi

asset_name="jellyfin-miner-${version}.zip"
package="artifacts/${asset_name}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "asset_name=${asset_name}"
    echo "is_release=${is_release}"
    echo "package=${package}"
    echo "version=${version}"
  } >> "${GITHUB_OUTPUT}"
else
  printf '%s\n' "${version}"
fi
