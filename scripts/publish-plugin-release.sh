#!/usr/bin/env bash
set -euo pipefail

: "${ASSET_NAME:?ASSET_NAME is required}"
: "${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
: "${PACKAGE:?PACKAGE is required}"
: "${PLUGIN_VERSION:?PLUGIN_VERSION is required}"
: "${TARGET_ABI:?TARGET_ABI is required}"

notes_file="$(mktemp)"
cat > "${notes_file}" <<EOF
## Jellyfin Miner ${PLUGIN_VERSION}

- Plugin version: ${PLUGIN_VERSION}
- Target Jellyfin ABI: ${TARGET_ABI}

Install: download \`${ASSET_NAME}\`, extract the \`Jellyfin Miner/\` folder into your Jellyfin plugins directory, then restart Jellyfin.
EOF

gh release create "${GITHUB_REF_NAME}" "${PACKAGE}" \
  --title "Jellyfin Miner ${PLUGIN_VERSION}" \
  --notes-file "${notes_file}" \
  --latest \
  --verify-tag
