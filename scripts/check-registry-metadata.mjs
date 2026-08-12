#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const server = JSON.parse(await readFile(new URL("../server.json", import.meta.url), "utf8"));

const errors = [];
const npmPackages = Array.isArray(server.packages)
  ? server.packages.filter((entry) => entry?.registryType === "npm")
  : [];
const npmPackage = npmPackages[0];

if (!pkg.mcpName) errors.push("package.json is missing mcpName");
if (pkg.mcpName !== server.name) {
  errors.push(`package mcpName (${pkg.mcpName}) does not match server name (${server.name})`);
}
if (server.repository?.url !== "https://github.com/xyun1996/ocular") {
  errors.push(`server repository URL is unexpected: ${server.repository?.url}`);
}
if (server.repository?.source !== "github") {
  errors.push(`server repository source must be github, got ${server.repository?.source}`);
}
if (server.version !== pkg.version) {
  errors.push(`server version (${server.version}) does not match package version (${pkg.version})`);
}
if (npmPackages.length !== 1) {
  errors.push(`expected exactly one npm package in server.json, found ${npmPackages.length}`);
}
if (npmPackage?.identifier !== pkg.name) {
  errors.push(`registry package identifier (${npmPackage?.identifier}) does not match package name (${pkg.name})`);
}
if (npmPackage?.version !== pkg.version) {
  errors.push(`registry package version (${npmPackage?.version}) does not match package version (${pkg.version})`);
}
if (npmPackage?.transport?.type !== "stdio") {
  errors.push(`registry package transport must be stdio, got ${npmPackage?.transport?.type}`);
}

const env = new Map((npmPackage?.environmentVariables ?? []).map((entry) => [entry.name, entry]));
for (const name of ["OCULAR_BASE_URL", "OCULAR_API_KEY", "OCULAR_MODEL"]) {
  if (!env.has(name)) errors.push(`server.json is missing required environment variable metadata: ${name}`);
}
if (env.get("OCULAR_API_KEY")?.isSecret !== true) {
  errors.push("OCULAR_API_KEY must be marked as secret in server.json");
}

if (errors.length) {
  console.error("MCP Registry metadata validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`MCP Registry metadata is consistent: ${server.name}@${server.version} -> npm:${npmPackage.identifier}@${npmPackage.version}`);
