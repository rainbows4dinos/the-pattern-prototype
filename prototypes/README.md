# Prototypes

One folder per prototype, each with an `index.html`. Each prototype is a
standalone single HTML file so it renders on the Claude mobile app and survives
host dark-mode overrides.

Convention:
- Inline the `:root` token block from `design-system/tokens.css` at the top, with
  a sync comment. See design-system/tokens.md for why and how.
- Inline styles over classes where a class would be at risk of host dark-mode
  cascade.
- Icons as Unicode glyphs, no CDN dependency.
- Pull recurring centerpiece objects from `design-system/components/` rather than
  rebuilding them.

Versioning: one clean current version per prototype, in place. Use git history,
not `v1` / `v2` filename suffixes.

`wireframe-starter/` is a structural skeleton that proves the token system is
wired up. It is not a design. It is intentionally brand-neutral and low fidelity.
