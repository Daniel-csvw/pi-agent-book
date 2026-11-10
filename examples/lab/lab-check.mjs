#!/usr/bin/env node
/**
 * 实验副本自检（读者版）：E04 第一步。
 *
 * 用法：node lab-check.mjs [副本目录]      # 目录默认当前目录
 *
 * 四道闸：Node 版本 / 副本版本 / 依赖可解析 / CLI 能起。
 * 凭据只报告，不拦截：离线实验不需要它。
 *
 * 副本怎么来（E04 §一 给了同样的三条命令）：
 *   git clone --depth 1 --branch v1.4.0 \
 *     https://github.com/earendil-works/pi.git pi-lab
 *   cd pi-lab && npm install
 *   node lab-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const EXPECT_VERSION = "1.4.0";
const EXPECT_NODE = "22.19.0";
const CLI = path.join("packages", "coding-agent", "src", "cli.ts");
const RESOLVER = path.join(
  "packages",
  "coding-agent",
  "src",
  "experimental",
  "source-resolver.ts",
);

const dir = path.resolve(process.argv[2] ?? ".");
const rows = [];
const pass = (name, detail) => rows.push({ name, ok: true, detail });
const fail = (name, detail) => rows.push({ name, ok: false, detail });

/* 1. Node 版本：Pi 的 engines 要求 >=22.19.0（类型擦除要 22.6+，glob 要 22.19） */
function compareVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}
if (compareVersion(process.versions.node, EXPECT_NODE) >= 0) {
  pass("node", process.versions.node);
} else {
  fail("node", `${process.versions.node} < ${EXPECT_NODE}`);
}

/* 2. 副本在不在、版本对不对 */
function readVersion() {
  try {
    const pkg = path.join(dir, "packages", "coding-agent", "package.json");
    return JSON.parse(fs.readFileSync(pkg, "utf8")).version;
  } catch {
    return null;
  }
}
const version = readVersion();
if (!fs.existsSync(path.join(dir, CLI))) {
  fail("副本", `${dir} 里没有 ${CLI}，先按 E04 §一 建副本`);
} else if (version !== EXPECT_VERSION) {
  fail("副本版本", `${version} != ${EXPECT_VERSION}（书对着 v1.4.0 写）`);
} else {
  pass("副本版本", `${version}（与书中 tag 一致）`);
}

/* 3. 依赖：能不能真的解析到一个第三方包，比"目录存在"更可信 */
let depError = "";
try {
  createRequire(path.join(dir, "package.json")).resolve("cross-spawn");
} catch (error) {
  depError = error instanceof Error ? error.message.split("\n")[0] : String(error);
}
if (!fs.existsSync(path.join(dir, "node_modules"))) {
  fail("依赖", "缺 node_modules：cd 进副本目录后 npm install");
} else if (depError) {
  fail("依赖", `装了一半：${depError}`);
} else {
  pass("依赖", "node_modules 可解析（cross-spawn）");
}

/* 4. 真跑一次 --version；只在前面都过时跑，省时间
   --import 收的是模块说明符：裸相对路径会被当成包名，必须给 file URL */
if (!rows.some((row) => !row.ok)) {
  const run = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(path.join(dir, RESOLVER)).href, CLI, "--version"],
    { cwd: dir, encoding: "utf8", timeout: 120000 },
  );
  const out = (run.stdout || "").trim().split(/\r?\n/)[0] || "";
  const err =
    (run.stderr || "")
      .split(/\r?\n/)
      .find((line) => /^\s*Error\b/.test(line))
      ?.trim() || "";
  if (run.status === 0 && out.includes(EXPECT_VERSION)) {
    pass("可启动", out);
  } else {
    fail("可启动", err || `exit ${run.status}`);
  }
}

/* 凭据：有就报告，没有只说一句 */
const keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENAI_BASE_URL"];
const found = keys.filter((key) => process.env[key]);

for (const row of rows) {
  console.log(`[${row.ok ? "PASS" : "FAIL"}] ${row.name.padEnd(8)} ${row.detail}`);
}
console.log(
  found.length
    ? `[INFO] 已发现凭据：${found.join(", ")}`
    : "[INFO] 未发现模型凭据；离线实验不需要，接真模型时再配",
);

if (rows.some((row) => !row.ok)) {
  console.log("\n重建副本（三条命令，位置随意）：");
  console.log("  git clone --depth 1 --branch v1.4.0 \\");
  console.log("    https://github.com/earendil-works/pi.git pi-lab");
  console.log("  cd pi-lab && npm install");
  console.log("  node lab-check.mjs");
  process.exitCode = 1;
}
