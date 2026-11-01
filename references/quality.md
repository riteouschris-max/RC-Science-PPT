# Reconstruction quality

## Inspect before delivery

Compare reference and rendered output at full size. For dense mechanism diagrams,
also inspect crops containing labels, pathway junctions, chart axes, and small
chemical symbols. Check:

- Missing/altered text, superscripts, subscripts, symbols, and gene/protein names.
- Text clipping, accidental wrapping, font substitution, and incorrect emphasis.
- Activation arrows versus inhibition ends; both endpoints and all branches.
- Panel alignment, membrane boundaries, line widths, and native gradient appearance.
- Chart labels against the workbook; unknown data remain unassigned.
- Retained raster regions and whether their use was disclosed.

Do not use an object-count target as proof of fidelity. Count important semantic
components and check that they are editable. Dense details may share one native
path when that makes editing practical, while labels stay separate.

## Automated checks

```sh
python scripts/audit_pptx.py output.pptx --scene scene.json --min-text 1
```

Add `--max-pictures 0` when the reference is fully reproducible as native objects.
The audit checks XML readability, internal relationships, native object counts,
basic canvas bounds, expected text presence, and chart cache/workbook consistency.
It deliberately does not infer biological correctness, font availability, text
fit, or visual equivalence. For strict scientific content verification, consult
the user's supplied evidence rather than accepting the image as validated science.

Run `npm test` after renderer changes. Tests are offline and use no model key.
The optional image request is checked with a mock transport; this is not a live
model availability or generation-quality test.

## Render

Prefer the host's available presentation renderer. In a Codex environment with
presentation authoring tools, use its documented import and PNG export workflow.
Do not copy private runtime packages or absolute paths into a shared repository.

If LibreOffice and Poppler are available, a command-line alternative is:

```sh
soffice --headless --convert-to pdf --outdir build/render build/output.pptx
pdftoppm -png -scale-to 1800 build/render/output.pdf build/render/slide
```

LibreOffice output can have different font metrics from PowerPoint. A renderer
preview alone is not proof that the deck was opened in PowerPoint. If no renderer
is available, state that visual validation remains incomplete; do not invent a
successful preview.

Rebuild from the scene after repairs. Keep intermediate screenshots and reports
private unless requested. Deliver the requested PPTX, with a brief note on any
remaining approximation that materially affects use.
