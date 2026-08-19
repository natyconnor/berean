#!/usr/bin/env node
// Idempotently configure the environment variables that @convex-dev/auth needs
// on the local (anonymous) Convex deployment used for Cloud Agent development.
//
// It generates an RS256 key pair in the exact format @convex-dev/auth expects
// (see node_modules/@convex-dev/auth/dist/bin.cjs -> generateKeys) and sets
// JWT_PRIVATE_KEY / JWKS / SITE_URL via the Convex CLI, skipping any variable
// that is already present so it is safe to run repeatedly.

import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:5173";

function convex(args, { capture = false } = {}) {
  return execFileSync("npx", ["convex", ...args], {
    stdio: capture ? ["ignore", "pipe", "ignore"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
  });
}

function envGet(name) {
  try {
    return convex(["env", "get", name], { capture: true }).trim();
  } catch {
    return "";
  }
}

function envSet(name, value) {
  convex(["env", "set", "--", name, value]);
}

function generateAuthKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwk = publicKey.export({ format: "jwk" });
  return {
    JWT_PRIVATE_KEY: pkcs8.trimEnd().replace(/\n/g, " "),
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...jwk }] }),
  };
}

if (envGet("JWT_PRIVATE_KEY")) {
  console.log("Convex Auth keys already configured; skipping key generation.");
} else {
  console.log("Generating Convex Auth keys (JWT_PRIVATE_KEY, JWKS)...");
  const { JWT_PRIVATE_KEY, JWKS } = generateAuthKeys();
  envSet("JWT_PRIVATE_KEY", JWT_PRIVATE_KEY);
  envSet("JWKS", JWKS);
}

if (envGet("SITE_URL")) {
  console.log("SITE_URL already configured; leaving it untouched.");
} else {
  console.log(`Setting SITE_URL=${SITE_URL}`);
  envSet("SITE_URL", SITE_URL);
}

if (process.env.ESV_API_KEY) {
  console.log("Setting ESV_API_KEY from the environment...");
  envSet("ESV_API_KEY", process.env.ESV_API_KEY);
} else {
  console.log(
    "ESV_API_KEY not present in the environment; skipping. Scripture text " +
      "fetching will be disabled until it is configured.",
  );
}

console.log("Convex Auth environment setup complete.");
