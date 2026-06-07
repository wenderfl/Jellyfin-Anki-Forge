#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${ROOT}/Jellyfin.Plugin.JellyfinMiner/Jellyfin.Plugin.JellyfinMiner.csproj"
FRONTEND="${ROOT}/frontend"
ARTIFACTS="${ROOT}/artifacts"
RUNTIME="${JELLYFIN_RUNTIME_ROOT:-${ROOT}/.devcontainer/jellyfin}"
PLUGIN_DIR="${RUNTIME}/data/plugins/Jellyfin Miner"

usage() {
  cat <<'EOF'
Usage: scripts/jellyfin.sh <command>

Commands:
  sync      Build Debug plugin/frontend and copy them into the local Jellyfin runtime.
  run       Start Jellyfin on the local dev runtime.
  start     Sync the plugin, then start Jellyfin.
  package   Build the installable Release plugin zip under artifacts/.
  build     Alias for package.
  clean     Remove the local Jellyfin dev runtime.

Environment:
  JELLYFIN_RUNTIME_ROOT             Override the local Jellyfin runtime path.
  JELLYFIN_MINER_BUILD_FRONTEND=0   Skip frontend build during sync.
  CONFIGURATION=Release            Override package publish configuration.
  TARGET_ABI=10.11.9.0             Override package meta target ABI.
EOF
}

main() {
  local command="${1:-}"
  case "${command}" in
    sync)
      sync_plugin
      ;;
    run)
      run_jellyfin
      ;;
    start)
      sync_plugin
      run_jellyfin
      ;;
    package | build)
      package_plugin
      ;;
    clean)
      clean_runtime
      ;;
    -h | --help | help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

sync_plugin() {
  local build_frontend="${JELLYFIN_MINER_BUILD_FRONTEND:-1}"

  dotnet build "${PROJECT}" -c Debug
  if [[ "${build_frontend}" == "1" ]]; then
    npm run build --prefix "${FRONTEND}"
  fi

  rm -rf "${PLUGIN_DIR}"
  mkdir -p "${PLUGIN_DIR}/wwwroot"
  cp "${ROOT}/Jellyfin.Plugin.JellyfinMiner/bin/Debug/net9.0/Jellyfin.Plugin.JellyfinMiner.dll" "${PLUGIN_DIR}/"
  if [[ -d "${FRONTEND}/dist" ]]; then
    cp -R "${FRONTEND}/dist/." "${PLUGIN_DIR}/wwwroot/"
  fi

  echo "Plugin synced to ${PLUGIN_DIR}"
}

run_jellyfin() {
  mkdir -p "${RUNTIME}"/{data,cache,config,log}
  exec jellyfin \
    --datadir "${RUNTIME}/data" \
    --cachedir "${RUNTIME}/cache" \
    --configdir "${RUNTIME}/config" \
    --logdir "${RUNTIME}/log" \
    --webdir /usr/share/jellyfin/web \
    --ffmpeg /usr/lib/jellyfin-ffmpeg/ffmpeg
}

package_plugin() {
  local staging="${ARTIFACTS}/Jellyfin Miner"
  local configuration="${CONFIGURATION:-Release}"
  local target_abi="${TARGET_ABI:-10.11.9.0}"
  local version
  local zip

  version="$(dotnet msbuild "${PROJECT}" -nologo -getProperty:Version)"
  zip="${ARTIFACTS}/jellyfin-miner-${version}.zip"

  rm -rf "${staging}" "${zip}"
  mkdir -p "${staging}/wwwroot" "${ARTIFACTS}"

  npm ci --prefix "${FRONTEND}"
  npm run build --prefix "${FRONTEND}"
  dotnet publish "${PROJECT}" -c "${configuration}" -o "${ARTIFACTS}/publish" --no-self-contained

  cp "${ARTIFACTS}/publish/Jellyfin.Plugin.JellyfinMiner.dll" "${staging}/"
  find "${ARTIFACTS}/publish" -maxdepth 1 -name 'Jellyfin.Plugin.JellyfinMiner.pdb' -exec cp {} "${staging}/" \;
  cp -R "${FRONTEND}/dist/." "${staging}/wwwroot/"

  cat > "${staging}/meta.json" <<EOF
{
  "category": "General",
  "changelog": "Self-contained Jellyfin Miner plugin with Vue frontend and Anki mining support.",
  "description": "Follow Jellyfin subtitles and mine selected cues to Anki with screenshots and audio.",
  "guid": "8e947a62-b5e1-4d6a-a70c-486996db901f",
  "name": "Jellyfin Miner",
  "overview": "Subtitle follower and Anki mining tool for Jellyfin playback sessions.",
  "owner": "friedrich-de",
  "targetAbi": "${target_abi}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.0000000Z")",
  "version": "${version}",
  "status": "Active",
  "autoUpdate": false,
  "assemblies": []
}
EOF

  (
    cd "${ARTIFACTS}"
    zip -qr "$(basename "${zip}")" "Jellyfin Miner"
  )

  echo "Built plugin package: ${zip}"
}

clean_runtime() {
  rm -rf "${RUNTIME}"
  echo "Removed Jellyfin runtime: ${RUNTIME}"
}

main "$@"
