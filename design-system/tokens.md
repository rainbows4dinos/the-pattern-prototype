# Tokens

## Why these are neutral

Brand and visual direction are not settled. A grayscale wireframe kit keeps early
prototypes honest about their fidelity and prevents premature lock-in. The value
of tokens here is not "the palette." It is having one place where fidelity and
brand live. Wireframe now, reskin later, one file to change.

The accent is a placeholder slate. It marks interactive and action elements so a
wireframe is legible, without standing in for a real brand color. When brand
lands, change the values in tokens.css and everything reskins.

## The standalone constraint and how we sync

Prototypes are delivered as standalone single HTML files. This is deliberate:
Claude's inline visualizer does not render on the Claude mobile app, and inline
styles survive host dark-mode overrides that a linked stylesheet does not. So
prototypes cannot simply `<link>` this file.

Current approach: tokens.css is the canonical definition. Each prototype inlines
a copy of the `:root` block at the top of its file, with a comment noting it is
synced from here. When you change a token, update tokens.css, then update the
inlined block in each prototype.

When that manual sync becomes painful (roughly, more than two or three live
prototypes), add a small concat/inline build step that reads tokens.css and
writes the `:root` block into each prototype. Not before. It is not worth a build
step to save editing two files.
