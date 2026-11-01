# Optional GPT Image 2.5 generation

Generation is optional. Existing screenshots can be reconstructed locally without
a model API call. Use an available image-generation tool when the host provides
one. A skill does not enable a model that the account cannot access. Preserve the
user's requested model; do not report a generic tool's output as Image 2.5 unless
the host identifies that model.

## API helper

The helper uses the official Images API and reads `OPENAI_API_KEY` from the
environment. Never commit a key or put it in a prompt, scene, screenshot, or log.
The caller is responsible for account access and API charges. Run generation
only when the user actually requests it.

```sh
node scripts/generate_image.mjs --prompt-file prompt.txt --model gpt-image-2.5-sunburst --size 1536x864 --quality high --out build/reference.png
```

Supported explicit model choices are `gpt-image-2.5-sunburst` and
`gpt-image-2.5-flare`. The helper makes one attempt and saves a generation manifest.
Use a new output path each time; inspect the image before reconstruction. Test a
request without network access or credentials using `--dry-run`.

Use a 16:9 source image when the user requests a standard widescreen slide.
Actual output dimensions determine the reconstruction canvas. As documented on
2026-11-01, size strings such as `1536x864` are supported, with edges divisible
by 16 and bounded size/aspect constraints. Verify current official documentation
when changing the helper or diagnosing model parameter errors.

## Prompt for reconstruction-friendly scientific slides

Provide exact, user-approved text and values. Ask for a clear visual hierarchy,
legible labels, distinguishable diagram components, adequate whitespace, and
unambiguous arrows/inhibition marks. Avoid tiny text, densely overlapping protein
labels, decorative fake data, and illegible 3D annotations. Ask for no invented
citations or invented results. Preserve the generation prompt alongside the image.

Generation does not validate scientific claims. Check generated text and numbers
against the approved content before making an editable version.

## Official references

- [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- [Images generation API reference](https://developers.openai.com/api/reference/resources/images/methods/generate)

Documentation verified on 2026-11-01. This repository does not assert perpetual
availability of any model or include a model subscription.
