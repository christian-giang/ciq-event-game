# Quest images

Images referenced by `src/content/quest-template.ts`. Because they live in the
repo, they show identically in local dev and on Vercel — no uploading.

Drop the actual image files here with **these exact names**, then commit + push:

| File | Used by | Where it shows |
| --- | --- | --- |
| `mclaren.jpg` | quiz "Who is this?" (McLaren) | question image |
| `schmidhuber.jpg` | quiz "Who is this?" (Schmidhuber) | question image |
| `founding-meeting.jpg` | quiz "The beginning" | result image |

Notes:
- Names must match the paths in the template (`/quest-images/<name>`). If your
  file is a `.png`/`.webp`, either rename it to `.jpg` or update the path in
  `quest-template.ts`.
- Keep them reasonably sized (e.g. ≤ 1600px, a few hundred KB) — they're served
  to phones.
- To add an image to another quest: set its `imageUrl` / `resultImageUrl` in
  `quest-template.ts` to `/quest-images/<yourfile>` and drop the file here.
- After changing the template, **Remove template → Load template** in /admin so
  the DB picks up the new image URLs (Load won't overwrite already-loaded quests).
