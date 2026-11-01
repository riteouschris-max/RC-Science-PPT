# Portable scene format

Coordinates, dimensions, line widths, radii, and font sizes are **image pixels**.
The renderer converts geometry at 96 px/in and text at 0.75 pt/px. Keep the
reference's actual width/height rather than blindly replacing it with 16:9.

```json
{
  "width": 1600,
  "height": 900,
  "font": "Microsoft YaHei",
  "title": "Scientific slide",
  "slides": [{
    "background": "FFFFFF",
    "notes": "Source image and any uncertainties.",
    "elements": [
      {"id":"title","type":"text","x":40,"y":40,"w":1500,"h":80,
       "text":"铁死亡的分子调控","fontSize":48,"bold":true,"color":"082E68"},
      {"id":"protein","type":"shape","geometry":"ellipse","x":250,"y":250,"w":120,"h":60,
       "fill":{"gradient":[{"offset":0,"color":"D9F6FF"},{"offset":1,"color":"71C3EB"}],"angle":90},
       "line":{"color":"088FCB","width":1.2}}
    ]
  }]
}
```

Each element must have a unique semantic `id` on its slide. Order is back to
front. `x`, `y`, `w`, `h` are required. Use multiple slides in the `slides` array.
All pages of one PPTX share the declared canvas; preserve individual image
ratios with appropriate layout or separate decks when ratios differ.

## Text

`type:"text"` supports `text`, `fontSize`, `font`, `bold`, `color`, `align`
(`left/center/right`), `valign` (`top/mid/bottom`), `wrap`, and `rotation`.
Text boxes have zero internal margins. Avoid ambiguous tight text boxes.

For one paragraph with mixed emphasis, use `runs` instead of `text`:

```json
"runs": [{"text":"铁死亡","color":"BD0000","bold":true},
         {"text":"基础研究持续活跃","color":"082E68"}]
```

## Native shapes and fills

`type:"shape"` supports standard PowerPoint preset `geometry`, including
`rect`, `roundRect`, `ellipse`, `downArrow`, and `rightArrow`. `radius` is in pixels
for rounded rectangles. Use `rotation` in degrees.

`fill` is a six-digit RGB color, `"none"`, `{color,opacity}`, or
`{gradient:[{offset,color,opacity?},...],angle}`. Gradient stop offsets are 0..1.
Native gradient fills remain editable in PowerPoint. `line` supports `color`,
`width` in pixels, `style` (`solid/dashed/dotted`), `beginArrow` and `endArrow`.

## Paths and lines

`type:"path"` uses local pixel coordinates within its bounding box. Commands:

- `["M",x,y]` move, `["L",x,y]` line.
- `["C",x1,y1,x2,y2,x,y]` cubic Bézier.
- `["Q",x1,y1,x,y]` quadratic Bézier.
- `["Z"]` close subpath.

Multiple move commands create multiple subpaths in one native freeform shape.
Use this for repeated membrane head groups, protein contours, and small details.
Keep biologically distinct labels as separate text boxes.

`type:"line"` uses a bounding box and optional `flipH`/`flipV`; zero height or
zero width is valid. `Canvas.arrow()` and `Canvas.inhibit()` handle common
relationships. Arrow endpoints and inhibition bars must remain unambiguous.

## Charts

```json
{"id":"funding","type":"chart","x":1100,"y":500,"w":450,"h":280,
 "chartType":"bar","categories":["2018","2019","2020"],
 "series":[{"name":"Projects","values":[34,68,137]}],
 "colors":["E53935"],"showValue":true,"min":0,"max":200,"majorUnit":50}
```

`labelSize` is pixels. `direction` is `col` or `bar`. `numberFormat` optionally
overrides numeric label formatting. Each series must have one **finite number**
per category. The renderer deliberately rejects null/NaN; use only known
categories in the chart and separate editable shapes for unlabeled source bars.
Do not substitute zero for unknown observations. PptxGenJS embeds the editable
workbook directly.

## Retained artwork

`type:"image"` requires `src`, `reason`, and optionally `alt`. Paths resolve
relative to the scene JSON. Keep image files local and scoped to the working
project. Images remain image objects, so explicitly disclose the retained
regions. Do not use this type to disguise a whole-page bitmap reconstruction.

## Programmatic authoring

Import `Canvas`, `gradient`, `membrane`, `protein`, `cluster`, and `mitochondrion`
from `scripts/primitives.mjs`. Use `scripts/build_demo.mjs` as a runnable example
of building a native scientific diagram. The primitives are optional starting
points; customize them to the actual reference rather than forcing every slide
to share a layout.
