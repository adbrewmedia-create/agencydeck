# Agency offer deck (static site)

- `/` is the scrolling deck, one slide per scroll.
- `/page` is the same offer as one long page.
- No build step. On Vercel, set Framework Preset to "Other" with no build command and the project root as the output folder,
  or run `vercel deploy` from this folder.
- `vercel.json` sends `X-Robots-Tag: noindex`, on top of the page's own noindex tag.

Before you send the link: the agency and five of the six creators are sample data (see the agency-data block near the top of
index.html and page.html). Replace them, and check the earnings assumptions with commercial.
