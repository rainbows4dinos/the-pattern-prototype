#!/usr/bin/env node
/*
  Regenerates the card list in index.html from metadata in each prototype file.
  Run with `npm run proto`. Zero dependencies.

  Each prototype may carry a block near the top of the file:

    <!-- prototype
    title: Spiral
    blurb: One shape holding both beliefs, a coil that returns on itself.
    group: Your Journey
    round: RD1 Explorations: Finding the Shape
    order: 2
    -->

  Missing title falls back to the <title> tag, then the filename. Missing group
  falls back to GROUP_FALLBACK. Missing order sorts last, then by filename.

  `group` is the <h2> section. `round` is the <details> subsection inside it —
  each round renders as a collapsible group, newest first, with the newest one
  open. Ordering comes from the leading number in the label, so "RD5 …" sorts
  ahead of "RD4 …". A prototype with no round renders in a bare list directly
  under the <h2>, which is what Archive does.

  `round` is the one repeatable field: list it twice and the prototype appears
  in both rounds. Each line may carry its own order and title after pipes —
  `round: <label> | <order> | <title>` — since a file cross-listed into two
  rounds usually wants a different name and position in each. Both are
  optional and fall back to the top-level `order` and `title`.

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

/** Missing or unparseable orders sort last rather than to the front. */
const toOrder = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : Infinity;
};

/**
 * Pull the `prototype` comment block, if present, into a key/value object.
 * `round` collects into an array; every other key takes its last value.
 */
function parseMeta(src) {
  const meta = { rounds: [] };
  const block = src.match(/<!--\s*prototype\s*\n([\s\S]*?)-->/);
  if (!block) return meta;
  for (const line of block[1].split("\n")) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.*?)\s*$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    if (key === "round") meta.rounds.push(kv[2]);
    else meta[key] = kv[2];
  }
  return meta;
}

/** One prototype yields one entry per round it is listed in — usually just one. */
function readPrototype(file) {
  const src = readFileSync(join(DIR, file), "utf8");
  const meta = parseMeta(src);
  const titleTag = src.match(/<title>([^<]*)<\/title>/);
  const base = {
    file,
    slug: file.replace(/\.html$/, ""),
    title: meta.title || titleTag?.[1].trim() || file.replace(/\.html$/, ""),
    blurb: meta.blurb || "",
    group: meta.group || GROUP_FALLBACK,
    order: toOrder(meta.order),
  };
  // An empty label means no round: rendered in a bare list under the <h2>.
  const specs = meta.rounds.length ? meta.rounds : [""];
  return specs.map((spec) => {
    const [round, order, title] = spec.split("|").map((s) => s.trim());
    return { ...base, round, order: order ? toOrder(order) : base.order, title: title || base.title };
  });
}

/*
  Rounds render newest-first off the leading number in the label, so "RD5 …"
  precedes "RD4 …" with no extra bookkeeping per file. Round-less entries sort
  above every round; an unnumbered label sorts below them, alphabetically.
*/
function roundRank(label) {
  if (!label) return -Infinity;
  const n = label.match(/^\D*(\d+)/);
  return n ? -Number(n[1]) : Infinity;
}

const byOrder = (a, b) => a.order - b.order || a.file.localeCompare(b.file);

function card(p, pad) {
  return [
    `${pad}<li>`,
    `${pad}  <a class="item" href="${URL_BASE}${escapeHtml(p.slug)}">`,
    `${pad}    <div class="thumb"><span class="placeholder">Preview</span></div>`,
    `${pad}    <div class="label">`,
    `${pad}      <div class="name">${escapeHtml(p.title)}</div>`,
    `${pad}      <div class="file">${escapeHtml(p.file)}</div>`,
    `${pad}    </div>`,
    `${pad}  </a>`,
    `${pad}</li>`,
  ].join("\n");
}

function section(group, items) {
  const subtitle = GROUP_SUBTITLES[group];
  const heading = subtitle
    ? `${escapeHtml(group)} <span class="count">${escapeHtml(subtitle)}</span>`
    : escapeHtml(group);
  // Sections collapse too, so Archive and finished families fold to one line.
  const out = [
    `      <details class="section" open>`,
    `        <summary><h2>${heading}</h2></summary>`,
  ];

  const rounds = [...new Set(items.map((i) => i.round))].sort(
    (a, b) => roundRank(a) - roundRank(b) || a.localeCompare(b)
  );

  let opened = false;
  for (const round of rounds) {
    const list = items.filter((i) => i.round === round).sort(byOrder);
    if (!round) {
      out.push(`        <ul>`, ...list.map((p) => card(p, "          ")), `        </ul>`);
      continue;
    }
    // Newest round open, older ones collapsed: the page lands short, and only
    // the current round's thumbnails pay for an iframe on load. index.html
    // remembers whatever the reader toggles from here.
    const open = opened ? "" : " open";
    opened = true;
    out.push(
      `        <details class="group"${open}>`,
      `          <summary><h3>${escapeHtml(round)}</h3></summary>`,
      `          <ul>`,
      ...list.map((p) => card(p, "            ")),
      `          </ul>`,
      `        </details>`
    );
  }

  out.push(`      </details>`);
  return out.join("\n");
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".html") && f !== "index.html");
// Cross-listed prototypes contribute one entry per round, so entries >= files.
const prototypes = files.flatMap(readPrototype);

const groups = [...new Set(prototypes.map((p) => p.group))].sort((a, b) => {
  const ia = GROUP_ORDER.indexOf(a);
  const ib = GROUP_ORDER.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.localeCompare(b);
});

const body = groups.map((g) => section(g, prototypes.filter((p) => p.group === g))).join("\n\n");

const src = readFileSync(INDEX, "utf8");
const region = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!region.test(src)) {
  console.error(`No ${START} / ${END} markers found in index.html — nothing written.`);
  process.exit(1);
}

const next = src.replace(region, `${START}\n${body}\n      ${END}`);
if (next === src) {
  console.log(`index.html already up to date (${files.length} prototypes)`);
} else {
  writeFileSync(INDEX, next);
  console.log(`index.html updated — ${files.length} prototypes in ${groups.length} group(s)`);
}

for (const g of groups) {
  console.log(`  ${g}`);
  const items = prototypes.filter((p) => p.group === g);
  const rounds = [...new Set(items.map((i) => i.round))].sort(
    (a, b) => roundRank(a) - roundRank(b) || a.localeCompare(b)
  );
  for (const round of rounds) {
    if (round) console.log(`    ${round}`);
    for (const p of items.filter((i) => i.round === round).sort(byOrder)) {
      const order = String(p.order === Infinity ? "-" : p.order).padStart(2);
      console.log(`      ${order}  ${p.title.padEnd(52)} ${p.file}`);
    }
  }
}
