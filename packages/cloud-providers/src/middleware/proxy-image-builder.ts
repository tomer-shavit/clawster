/**
 * Proxy Image Builder
 *
 * Builds a single generic middleware proxy Docker image from the monorepo.
 * The image is tagged `clawster-middleware-proxy:local` and reused across
 * all bot instances. Community middleware packages are auto-installed at
 * proxy startup (Grafana GF_INSTALL_PLUGINS pattern), not baked into the image.
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const PROXY_IMAGE_TAG = "clawster-middleware-proxy:local";

/**
 * Checks if the proxy image already exists locally.
 */
function proxyImageExists(): boolean {
  try {
    execFileSync("docker", ["image", "inspect", PROXY_IMAGE_TAG, "--format", "ok"], {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the monorepo root by walking up from this file until pnpm-workspace.yaml is found.
 */
function findMonorepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find monorepo root (pnpm-workspace.yaml)");
}

/**
 * Builds the generic middleware proxy Docker image.
 * Uses a generated Dockerfile with the monorepo root as build context.
 *
 * @returns The image tag
 */
export function buildProxyImage(): string {
  if (proxyImageExists()) {
    return PROXY_IMAGE_TAG;
  }

  const root = findMonorepoRoot();

  const dockerfile = `FROM node:22-slim
WORKDIR /app
COPY packages/middleware-proxy/dist ./dist
COPY packages/middleware-proxy/package.json ./
COPY packages/middleware-sdk/dist ./node_modules/@clawster/middleware-sdk/dist
COPY packages/middleware-sdk/package.json ./node_modules/@clawster/middleware-sdk/
RUN npm install --omit=dev
CMD ["node", "dist/main.js"]
`;

  const dockerfilePath = path.join(root, ".clawster-proxy.Dockerfile");
  fs.writeFileSync(dockerfilePath, dockerfile, "utf8");

  try {
    execFileSync(
      "docker",
      ["build", "-f", dockerfilePath, "-t", PROXY_IMAGE_TAG, root],
      { stdio: "inherit", timeout: 120_000 },
    );
  } finally {
    // Clean up temp Dockerfile
    try {
      fs.unlinkSync(dockerfilePath);
    } catch {
      // ignore
    }
  }

  return PROXY_IMAGE_TAG;
}

/**
 * Ensures the proxy image exists, building it if necessary.
 * Returns the image tag.
 */
export function ensureProxyImage(): string {
  return buildProxyImage();
}

/** Returns the fixed proxy image tag */
export function getProxyImageTag(): string {
  return PROXY_IMAGE_TAG;
}
