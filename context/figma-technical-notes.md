# Figma / FigJam technical notes

Hard-won patterns for `use_figma` scripts on FigJam boards. Each of these was
learned from a silent failure. Treat as a checklist.

## Scripts

- Use flat top-level async scripts with top-level `await`. Wrapped async
  functions execute silently without persisting changes.
- Load all font weights before creating any node: Inter Regular, Medium, Semi
  Bold, Bold, via `figma.loadFontAsync`.

## Text nodes

- Creation order is strict: `fontName` -> `fontSize` -> `characters` ->
  `textAutoResize` -> `resize()`. Any other order fails silently.
- Native bullet lists: `setRangeListOptions(0, t.characters.length, { type:
  "UNORDERED" })` after characters are set.
- Bullet spacing: insert `"\n \n"` between list items, not plain `"\n"`, to fake
  extra spacing. Add a soft line break (` `) after each bullet line. Larry's
  standing instruction, confirmed correct.

## Sections

- Call `page.appendChild(section)` before adding child text nodes.
- Call `resizeWithoutConstraints()` again after all children are added.

## Layout

- Use absolute canvas coordinates. Anchor new content dynamically using `maxY`
  across all page children to avoid hardcoded Y overlap.
- `createShapeWithText` with `shapeType='SQUARE'` is preferred for grid cells.
- Ellipse markers: `e.x = cx - d/2; e.y = cy - d/2` for correct centering.

## Iterative section rebuilds

To rebuild a section without duplicating or clearing the whole board:
1. Scan `figma.currentPage.children` for the header text node by matching
   `characters`.
2. Capture the minimum Y of matching nodes.
3. Remove all nodes at or below that boundary.
4. Regenerate using the computed `maxY` of remaining content plus a fixed offset.

## Gotchas

- Node IDs use hyphens in URLs (`20-117`) but colons in the API (`20:117`). Same
  node.
- `get_figjam` may cache and not immediately reflect newly written nodes.
- `get_screenshot` is the cheap way to verify read access on an unfamiliar file.
  A timeout suggests a permissions block or transient MCP issue, not a missing
  file.
