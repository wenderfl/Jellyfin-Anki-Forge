FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG DEBIAN_FRONTEND=noninteractive

# Base tooling used for plugin development and diagnostics.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        apt-transport-https \
        ca-certificates \
        curl \
        git \
        gnupg \
        jq \
        ripgrep \
        shellcheck \
        unzip \
        wget \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 for building the Vue frontend.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && npm config set fund false --global \
    && npm config set audit false --global \
    && rm -rf /var/lib/apt/lists/*

# Install .NET 9 SDK + ASP.NET runtime.
RUN wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O /tmp/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        aspnetcore-runtime-9.0 \
        dotnet-sdk-9.0 \
    && rm -rf /var/lib/apt/lists/*

# Install Jellyfin from the official apt repository so the server can be run in-container.
RUN install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://repo.jellyfin.org/jellyfin_team.gpg.key | gpg --dearmor -o /etc/apt/keyrings/jellyfin.gpg \
    && chmod a+r /etc/apt/keyrings/jellyfin.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/jellyfin.gpg] https://repo.jellyfin.org/debian bookworm main" > /etc/apt/sources.list.d/jellyfin.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends jellyfin \
    && rm -rf /var/lib/apt/lists/*
