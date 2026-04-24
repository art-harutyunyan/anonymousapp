import type { NextConfig } from "next";
import { execSync } from "node:child_process";

const gitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

const builtAt = new Date().toISOString();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_BUILT_AT: builtAt,
  },
};

export default nextConfig;
