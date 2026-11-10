# Design rules

## Type
- One text style for everything: 14px, line-height 20px, letter-spacing 0.1em, weight 400.
- No other sizes, weights, or headings. Hierarchy comes from position and color only.
- Font is Geist (Google Fonts, weights 400 and 600), set once on body in global.css: "Geist", system-ui, sans-serif. Never copy font files from other websites.
- Keep everything lowercase.

## Color
- Primary text: --text. Secondary text (dates, labels, credits): --text-muted (#636363 on light, #a1a1a1 on dark).
- Keep the existing page themes (white project pages, white experience pages with black text, black home/portfolio).
- No borders, shadows, rounded corners.

## Spacing
- Only use the scale: --s-xs 5px, --s-s 15px, --s-m 30px, --s-l 60px, --s-xl 120px, --s-2xl 170px.
- Every page's title sits exactly where "andersen lee" sits on home (--gutter-left: 53px desktop, 13px mobile; --header-top derived from --home-top). All left-aligned text and images start at that margin. Right margin is 30px on project pages.
- Header area: content starts 180px from the top on desktop.
- 100px between sections on a page (--section-gap; the one value off the scale, chosen deliberately; 60px on mobile). 120px between the intro (hero + text) and the photos under it. 30px between a section's text and its images. 15px between images in a gallery. 5px between paragraphs. 5px between an image and its caption. Experience pages (theme "purple"): 15px between bullet points, 60px between the text and the images, text 10 columns wide, and image rows 350px tall. A section with "close": true sits 30px under the section above (a follow-on, not a new section). Pages with "spacing": "even" (e.g. hand) use 60px for all of the section, intro and text-to-image gaps instead.
- No one-off pixel or percent values in JSON or components.

## Grid and images
- 12-column grid inside the 30px page margins, 15px gap.
- NEVER crop images. No object-fit: cover on project images. CAD renders, sketches, and screenshots must show in full.
- Image rows are "justified": every image in a row has the same height, and each image's width comes from its own aspect ratio. Implement with flexbox: each item gets `flex: <aspect ratio> 1 0` and `aspect-ratio: <aspect ratio>`.
- Aspect ratios come from the real image files, not hardcoded guesses.
- Max 3 images per row. Every image row is 300px tall on desktop (--row-h; 360px on pages with "size": "large", e.g. hand) so image sizes stay consistent; rows stacked in one section share one width (the wider row comes out a little shorter).
- Project intro: hero image 2 columns, summary text 6 columns right beside it (30px gap).
- Paragraph text is max 6 columns wide (about 550px).

## Mobile (under 768px)
- 15px page margin. Everything stacks to one column. Image rows become full width, keeping their aspect ratio.

## Process
- After layout changes, run `npm run build` and fix errors.