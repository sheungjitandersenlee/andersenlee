# andersenlee.ca

Static rebuild of the WordPress/Elementor site in [Astro](https://astro.build). Same URLs; one template for every project page, with all spacing in one CSS file.

## First run

You need Node 18 or newer.

```bash
npm install
npm run fetch-images   # pulls all 150 images and videos from the live WordPress site into public/images/
npm run dev            # http://localhost:4321
```

Run `fetch-images` while the WordPress site is still up. It skips files you already have, so it's safe to re-run.

## Where things live

```
src/styles/global.css          every color, font, and spacing value (tokens at the top)
src/data/site.json             home page text, about page, portfolio grid, SEO meta
src/data/pages/*.json          one file per project / experience page (hand.json, neuralink.json, ...)
src/pages/[slug].astro         renders every file in src/data/pages/ with the template below
src/components/Project.astro   the one template for project and experience pages
public/images/                 images and videos as first downloaded
public/images/full/            full-size originals from the old site (scripts/fetch-originals.mjs)
public/images/web/             the resized copies the pages actually show (scripts/prepare-images.mjs)
CLAUDE.md                      the design rules
```

## Changing spacing

Edit the variables at the top of `src/styles/global.css`. The project-page values are in the `.project` block:

- `--row-h` is the height of every image row (300px)
- `--section-gap` is the space between sections (100px)
- `--header-h` is where the page content starts (180px from the top)

Page files contain no spacing values at all, so every project page is spaced the same way.

## Project page format

Every page in `src/data/pages/` is: a header, an intro (hero image with the summary text beside it, plus optional photos under it), then sections. Each section has an optional grey label, its text, then its images:

```json
{
  "title": "Lysis Pipette", "theme": "light", "heading": "lysis pipette",
  "date": "oct 2025 – nov 2025", "back": "/projects/",
  "intro": {
    "img": "/images/web/hero.webp", "source": "/images/full/hero.png", "ar": 1,
    "html": "<p>summary...</p>",
    "rows": [[ { "img": "...", "ar": 0.75 }, { "img": "...", "ar": 0.75 } ]]
  },
  "sections": [
    { "label": "week 5", "html": "<p>&gt; ...</p>", "rows": [[ {...}, {...} ]] }
  ]
}
```

- `rows` is a list of image rows, at most 3 images each. Images in a row share one height; stacked rows share one width.
- `ar` (width / height) is written by `scripts/aspect.mjs` from the real file. Don't type it by hand.
- Optional per image: `"crop": { "ar": 1, "focus": [0.5, 0.45] }` crops the web copy to that shape around the focus point; `"box": 1.8` gives a white-background image a differently shaped space, centred.
- Videos: `{ "video": "/images/clip.mp4", "ar": 0.56, "auto": true }` (`auto` autoplays muted on loop; leave it out for controls).
- `"theme": "light"` for a white project page, `"purple"` for an experience page (also white now).

## Adding images or a project

1. Put the image in `public/images/` (or `public/images/full/` for a full-size original).
2. Add it to a page's `rows` with `"img": "/images/your-file.jpg"`. To start a new project, copy an existing file in `src/data/pages/`, rename it to the URL you want (`new-thing.json` becomes `/new-thing/`), and edit it.
3. Run:
   ```bash
   node scripts/prepare-images.mjs your-page   # web copy: resized, white margins evened, crops applied
   node scripts/aspect.mjs your-page           # real aspect ratios
   node scripts/shot.mjs your-page             # screenshots in screenshots/ + layout checks
   npm run build
   ```
4. For a new project, add a card in `src/data/site.json` under `portfolio.items`.

`shot.mjs` prints a line for any stretched image, a row whose images differ in height, or stacked rows of different widths. No output means the page passes.

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, click Add New, then Project, and import the repo. It detects Astro on its own; keep the defaults and deploy.
3. Check the `*.vercel.app` preview link.
4. In the project's Settings, open Domains and add `andersenlee.ca` and `www.andersenlee.ca`. Vercel shows the DNS records to set. Add them wherever the domain's DNS is managed now (your registrar or your WordPress host), and copy over any existing MX or TXT records first so email and verifications keep working.
5. Once the domain shows as valid in Vercel and the site loads, cancel the WordPress hosting.

After that, every `git push` redeploys automatically.
