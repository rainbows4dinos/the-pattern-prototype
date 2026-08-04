#!/usr/bin/env node
/*
  Regenerates the card list in index.html from metadata in each prototype file.
  Run with `npm run proto`. Zero dependencies.

  Each prototype may carry a block near the top of the file:

    <!-- prototype
    title: Spiral
    blurb: One shape holding both beliefs, a coil that returns on itself.
    group: Your Journey
    order: 2
    -->

  Missing title falls back to the <title> tag, then the filename. Missing group
  falls back to GROUP_FALLBACK. Missing order sorts last, then by filename.

  Only the markup between <!-- prototypes:start --> and <!-- prototypes:end -->
  is touched. The thumbnail script in index.html mounts each iframe at runtime by
  reading the href off the enclosing <a>, so cards emit .thumb empty — no src and
  no data attributes. hrefs are absolute and extensionless to match the host's
  cleanUrls rewrite.
*/
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dirname;
const INDEX = join(DIR, "index.html");
const START = "<!-- prototypes:start -->";
const END = "<!-- prototypes:end -->";
const URL_BASE = "/static-prototypes/";
const GROUP_FALLBACK = "Archive";

// Section subtitles, so generated headings keep the wording they had by hand.
// The <h2> markup is otherwise identical to the template it was copied from.
const GROUP_SUBTITLES = { "Your Journey": "— Interaction Tests" };

// Groups render in this order; anything else follows, alphabetically.
const GROUP_ORDER = ["Your Journey"];

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pull the `prototype` comment block, if present, into a key/value object. */
function parseMeta(src) {
  const block = src.match(/<!--\s*prototype\s*\n([\s\S]*?)-->/);
  if (!block) return {};
  const meta = {};
  for (const line of block[1].split("\n")) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.*?)\s*$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2];
  }
  return meta;
}

function readPrototype(file) {
  const src = readFileSync(join(DIR, file), "utf8");
  const meta = parseMeta(src);
  const titleTag = src.match(/<title>([^<]*)<\/title>/);
  const order = Number.parseFloat(meta.order);
  return {
    file,
    slug: file.replace(/\.html$/, ""),
    title: meta.title || titleTag?.[1].trim() || file.replace(/\.html$/, ""),
    blurb: meta.blurb || "",
    group: meta.group || GROUP_FALLBACK,
    order: Number.isFinite(order) ? order : Infinity,
  };
}

function card(p) {
  return [
    `          <li>`,
    `            <a class="item" href="${URL_BASE}${escapeHtml(p.slug)}">`,
    `              <div class="thumb"><span class="placeholder">Preview</span></div>`,
    `              <div class="label">`,
    `                <div class="name">${escapeHtml(p.title)}</div>`,
    `                <div class="file">${escapeHtml(p.file)}</div>`,
    `              </div>`,
    `            </a>`,
    `          </li>`,
  ].join("\n");
}

function section(group, items) {
  const subtitle = GROUP_SUBTITLES[group];
  const heading = subtitle
    ? `${escapeHtml(group)} <span class="count">${escapeHtml(subtitle)}</span>`
    : escapeHtml(group);
  return [
    `      <section>`,
    `        <h2>${heading}</h2>`,
    `        <ul>`,
    ...items.map(card),
    `        </ul>`,
    `      </section>`,
  ].join("\n");
}

const prototypes = readdirSync(DIR)
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .map(readPrototype);

const groups = [...new Set(prototypes.map((p) => p.group))].sort((a, b) => {
  const ia = GROUP_ORDER.indexOf(a);
  const ib = GROUP_ORDER.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.localeCompare(b);
});

const body = groups
  .map((g) =>
    section(
      g,
      prototypes
        .filter((p) => p.group === g)
        .sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))
    )
  )
  .join("\n\n");

const src = readFileSync(INDEX, "utf8");
const region = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!region.test(src)) {
  console.error(`No ${START} / ${END} markers found in index.html — nothing written.`);
  process.exit(1);
}

const next = src.replace(region, `${START}\n${body}\n      ${END}`);
if (next === src) {
  console.log(`index.html already up to date (${prototypes.length} prototypes)`);
} else {
  writeFileSync(INDEX, next);
  console.log(`index.html updated — ${prototypes.length} prototypes in ${groups.length} group(s)`);
}
for (const g of groups) {
  console.log(`  ${g}`);
  for (const p of prototypes.filter((p) => p.group === g).sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))) {
    console.log(`    ${String(p.order === Infinity ? "-" : p.order).padStart(2)}  ${p.title.padEnd(28)} ${p.file}`);
  }
}
