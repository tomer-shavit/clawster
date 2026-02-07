/**
 * Startup Script Builder
 *
 * Extracts common Sysbox installation and startup script logic
 * for GCE, Azure, and EC2 deployment targets.
 */

/** Default Sysbox version for installation */
const DEFAULT_SYSBOX_VERSION = "0.6.4";

import type { MiddlewareAssignment } from "../interface/deployment-target";

/** Configuration options for startup scripts */
export interface StartupScriptOptions {
  /** Target platform */
  platform: "gce" | "azure" | "ec2";
  /** Sysbox version to install (default: 0.6.4) */
  sysboxVersion?: string;
  /** Data mount path (e.g., /mnt/openclaw) */
  dataMount: string;
  /** Gateway port number */
  gatewayPort: number;
  /** Optional gateway authentication token */
  gatewayToken?: string;
  /** Source for config retrieval */
  configSource: "metadata" | "secret" | "env";
  /** Container image URI */
  imageUri: string;
  /** Additional environment variables */
  additionalEnv?: Record<string, string>;
  /** Middleware assignments — when present, a proxy sidecar is deployed */
  middlewareConfig?: {
    middlewares: MiddlewareAssignment[];
  };
}

/**
 * Builds bash commands to install Sysbox runtime.
 * Checks for existing installation, downloads from versioned GitHub release,
 * and restarts Docker to pick up the new runtime.
 */
export function buildSysboxInstallScript(version: string = DEFAULT_SYSBOX_VERSION): string {
  const versionTag = version.startsWith("v") ? version : `v${version}`;
  return `# Install Sysbox runtime for secure Docker-in-Docker (sandbox mode)
# Using versioned release for stability and security
SYSBOX_VERSION="${versionTag}"
if ! docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
  echo "Installing Sysbox $SYSBOX_VERSION for secure sandbox mode..."
  SYSBOX_INSTALL_SCRIPT="/tmp/sysbox-install-$$.sh"
  curl -fsSL "https://raw.githubusercontent.com/nestybox/sysbox/$SYSBOX_VERSION/scr/install.sh" -o "$SYSBOX_INSTALL_SCRIPT"
  chmod +x "$SYSBOX_INSTALL_SCRIPT"
  "$SYSBOX_INSTALL_SCRIPT"
  rm -f "$SYSBOX_INSTALL_SCRIPT"
  systemctl restart docker
  echo "Sysbox runtime installed successfully"
else
  echo "Sysbox runtime already available"
fi`;
}

/**
 * Builds the runtime selection and container run commands.
 * When middleware is configured, creates a Docker network with proxy sidecar.
 */
function buildContainerRunScript(options: StartupScriptOptions): string {
  const enabledMiddlewares = (options.middlewareConfig?.middlewares ?? []).filter((m) => m.enabled);

  if (enabledMiddlewares.length > 0) {
    return buildContainerRunWithMiddleware(options, enabledMiddlewares);
  }

  return buildContainerRunDirect(options);
}

/**
 * Direct mode: OpenClaw exposed to host on gatewayPort.
 */
function buildContainerRunDirect(options: StartupScriptOptions): string {
  const envVars = Object.entries(options.additionalEnv ?? {})
    .map(([k, v]) => `-e ${k}="${v}"`)
    .join(" \\\n  ");

  return `# Determine runtime and run OpenClaw
DOCKER_RUNTIME=""
if docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
  DOCKER_RUNTIME="--runtime=sysbox-runc"
  echo "Using Sysbox runtime for secure Docker-in-Docker"
else
  echo "Warning: Sysbox not available, sandbox mode will be limited"
fi

docker rm -f openclaw-gateway 2>/dev/null || true

docker run -d \\
  --name openclaw-gateway \\
  --restart=always \\
  $DOCKER_RUNTIME \\
  -p ${options.gatewayPort}:${options.gatewayPort} \\
  -v "${options.dataMount}/.openclaw:/home/node/.openclaw" \\
  -e OPENCLAW_GATEWAY_PORT=${options.gatewayPort} \\
  -e OPENCLAW_GATEWAY_TOKEN="${options.gatewayToken ?? ""}"${envVars ? ` \\\n  ${envVars}` : ""} \\
  ${options.imageUri} \\
  sh -c "npx -y openclaw@latest gateway --port ${options.gatewayPort} --verbose"`;
}

/**
 * Middleware mode: OpenClaw on Docker network (internal), proxy exposed to host.
 * The proxy auto-installs middleware packages at startup (Grafana pattern).
 */
function buildContainerRunWithMiddleware(
  options: StartupScriptOptions,
  middlewares: MiddlewareAssignment[],
): string {
  const envVars = Object.entries(options.additionalEnv ?? {})
    .map(([k, v]) => `-e ${k}="${v}"`)
    .join(" \\\n  ");

  const proxyConfig = JSON.stringify({
    externalPort: 18789,
    internalPort: 18789,
    internalHost: "openclaw-gateway",
    middlewares: middlewares.map((m) => ({
      package: m.package,
      enabled: m.enabled,
      config: m.config,
    })),
  });

  return `# Determine runtime
DOCKER_RUNTIME=""
if docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
  DOCKER_RUNTIME="--runtime=sysbox-runc"
  echo "Using Sysbox runtime for secure Docker-in-Docker"
else
  echo "Warning: Sysbox not available, sandbox mode will be limited"
fi

# Create Docker network for middleware proxy
docker network create clawster-mw 2>/dev/null || true

# Clean up any existing containers
docker rm -f openclaw-gateway 2>/dev/null || true
docker rm -f clawster-proxy 2>/dev/null || true

# Run OpenClaw on the network (internal only — no host port exposure)
docker run -d \\
  --name openclaw-gateway \\
  --restart=always \\
  --network clawster-mw \\
  $DOCKER_RUNTIME \\
  -v "${options.dataMount}/.openclaw:/home/node/.openclaw" \\
  -e OPENCLAW_GATEWAY_PORT=18789 \\
  -e OPENCLAW_GATEWAY_TOKEN="${options.gatewayToken ?? ""}"${envVars ? ` \\\n  ${envVars}` : ""} \\
  ${options.imageUri} \\
  sh -c "npx -y openclaw@latest gateway --port 18789 --verbose"

# Run middleware proxy on the same network, exposed to host
MW_CONFIG='${proxyConfig.replace(/'/g, "'\\''")}'
docker run -d \\
  --name clawster-proxy \\
  --restart=always \\
  --network clawster-mw \\
  -p ${options.gatewayPort}:18789 \\
  -e "CLAWSTER_MIDDLEWARE_CONFIG=$MW_CONFIG" \\
  node:22-slim \\
  sh -c "npx -y @clawster/middleware-proxy"

echo "Middleware proxy started on port ${options.gatewayPort}"`;
}

/**
 * Builds a GCE-style bash startup script.
 */
export function buildStartupScript(options: StartupScriptOptions): string {
  const sysboxScript = buildSysboxInstallScript(options.sysboxVersion);
  const containerScript = buildContainerRunScript(options);

  return `#!/bin/bash
set -e

${sysboxScript}

mkdir -p "${options.dataMount}/.openclaw"

${containerScript}`;
}

/**
 * Builds an Azure cloud-init YAML script.
 */
export function buildCloudInitScript(options: StartupScriptOptions): string {
  const versionTag = (options.sysboxVersion ?? DEFAULT_SYSBOX_VERSION).startsWith("v")
    ? options.sysboxVersion
    : `v${options.sysboxVersion ?? DEFAULT_SYSBOX_VERSION}`;

  const envLines = Object.entries(options.additionalEnv ?? {})
    .map(([k, v]) => `      -e ${k}="${v}" \\`)
    .join("\n");

  const enabledMiddlewares = (options.middlewareConfig?.middlewares ?? []).filter((m) => m.enabled);
  const hasMiddleware = enabledMiddlewares.length > 0;

  const sysboxBlock = `    SYSBOX_VERSION="${versionTag}"
    if ! docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
      echo "Installing Sysbox $SYSBOX_VERSION for secure sandbox mode..."
      SYSBOX_INSTALL_SCRIPT="/tmp/sysbox-install-$$.sh"
      curl -fsSL "https://raw.githubusercontent.com/nestybox/sysbox/$SYSBOX_VERSION/scr/install.sh" -o "$SYSBOX_INSTALL_SCRIPT"
      chmod +x "$SYSBOX_INSTALL_SCRIPT"
      "$SYSBOX_INSTALL_SCRIPT"
      rm -f "$SYSBOX_INSTALL_SCRIPT"
      systemctl restart docker
      echo "Sysbox runtime installed successfully"
    else
      echo "Sysbox runtime already available"
    fi`;

  if (hasMiddleware) {
    const proxyConfig = JSON.stringify({
      externalPort: 18789,
      internalPort: 18789,
      internalHost: "openclaw-gateway",
      middlewares: enabledMiddlewares.map((m) => ({
        package: m.package,
        enabled: m.enabled,
        config: m.config,
      })),
    });

    return `#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - jq
  - curl

runcmd:
  - systemctl enable docker
  - systemctl start docker
  - mkdir -p ${options.dataMount}/.openclaw
  - |
${sysboxBlock}
  - docker network create clawster-mw 2>/dev/null || true
  - docker rm -f openclaw-gateway 2>/dev/null || true
  - docker rm -f clawster-proxy 2>/dev/null || true
  - |
    DOCKER_RUNTIME=""
    if docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
      DOCKER_RUNTIME="--runtime=sysbox-runc"
    fi
    docker run -d \\
      --name openclaw-gateway \\
      --restart=always \\
      --network clawster-mw \\
      $DOCKER_RUNTIME \\
      -v ${options.dataMount}/.openclaw:/home/node/.openclaw \\
      -e OPENCLAW_GATEWAY_PORT=18789 \\
      -e OPENCLAW_GATEWAY_TOKEN="${options.gatewayToken ?? ""}"${envLines ? ` \\\n${envLines}` : ""} \\
      ${options.imageUri} \\
      sh -c "npx -y openclaw@latest gateway --port 18789 --verbose"
  - |
    MW_CONFIG='${proxyConfig.replace(/'/g, "'\\''")}'
    docker run -d \\
      --name clawster-proxy \\
      --restart=always \\
      --network clawster-mw \\
      -p ${options.gatewayPort}:18789 \\
      -e "CLAWSTER_MIDDLEWARE_CONFIG=$MW_CONFIG" \\
      node:22-slim \\
      sh -c "npx -y @clawster/middleware-proxy"

final_message: "OpenClaw gateway with middleware proxy started on port ${options.gatewayPort}"
`;
  }

  return `#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - jq
  - curl

runcmd:
  - systemctl enable docker
  - systemctl start docker
  - mkdir -p ${options.dataMount}/.openclaw
  - |
${sysboxBlock}
  - docker rm -f openclaw-gateway 2>/dev/null || true
  - |
    DOCKER_RUNTIME=""
    if docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q 'sysbox-runc'; then
      DOCKER_RUNTIME="--runtime=sysbox-runc"
    fi
    docker run -d \\
      --name openclaw-gateway \\
      --restart=always \\
      $DOCKER_RUNTIME \\
      -p ${options.gatewayPort}:${options.gatewayPort} \\
      -v ${options.dataMount}/.openclaw:/home/node/.openclaw \\
      -e OPENCLAW_GATEWAY_PORT=${options.gatewayPort} \\
      -e OPENCLAW_GATEWAY_TOKEN="${options.gatewayToken ?? ""}"${envLines ? ` \\\n${envLines}` : ""} \\
      ${options.imageUri} \\
      sh -c "npx -y openclaw@latest gateway --port ${options.gatewayPort} --verbose"

final_message: "OpenClaw gateway started on port ${options.gatewayPort}"
`;
}

/**
 * Builds an EC2 user data script.
 */
export function buildUserDataScript(options: StartupScriptOptions): string {
  const sysboxScript = buildSysboxInstallScript(options.sysboxVersion);
  const containerScript = buildContainerRunScript(options);

  return `#!/bin/bash
set -e

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  yum install -y docker || apt-get update && apt-get install -y docker.io
  systemctl enable docker
  systemctl start docker
fi

${sysboxScript}

mkdir -p "${options.dataMount}/.openclaw"

${containerScript}`;
}
