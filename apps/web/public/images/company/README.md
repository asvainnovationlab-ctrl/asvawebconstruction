# Company photos

Drop your own photos in **this folder** to replace the stock Unsplash images used
across the public website.

## How it works

Each photo below has a **slot name**. If a file with that name exists in this
folder, the site uses it. If not, the stock photo in `../` is used instead.
You can replace as many or as few as you like — there is no need to supply all 16.

Any of these extensions work: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
(`workspace.png` will override `workspace.jpg`).

> **Restart `npm run dev` after adding or removing a photo.** The list of
> available files is read once when the server starts.

## Slots

| File name to use | Where it appears |
| --- | --- |
| `workspace.jpg` | About page — wide banner under the heading |
| `team-collab.jpg` | About page — "Let's talk about your project" background |
| `team-careers.jpg` | Careers page |
| `team-review.jpg` | Home page, and services about testing / QA |
| `web-dev.jpg` | Generic web & software services |
| `website-design.jpg` | Website design services |
| `web-app-dev.jpg` | Web application services |
| `custom-software.jpg` | Custom software services |
| `mobile-app.jpg` | Mobile / app services |
| `ui-ux-design.jpg` | UI/UX design services |
| `ecommerce.jpg` | E-commerce services |
| `integration.jpg` | API & integration services |
| `cloud-network.jpg` | Cloud / DevOps / hosting services |
| `analytics.jpg` | Data, analytics & dashboard services |
| `ai.jpg` | AI, machine learning & automation services |
| `enterprise.jpg` | Enterprise, consulting & strategy services |

## Recommended sizes

- **Banners** (`workspace`, `team-collab`, `team-careers`): about **2000 x 1125 px** (16:9), landscape
- **Service photos**: about **1200 x 900 px** (4:3), landscape
- Keep each file **under ~500 KB**. Export as JPEG at ~80% quality, or use `.webp`
  for smaller files at the same quality.

## Alt text (important)

The built-in descriptions describe the *stock* photos, so they will be wrong for
yours. Screen readers and search engines use this text.

Create a file called `alt.json` in this folder describing only the photos you
replaced:

```json
{
  "workspace": "The Asva Innovation Lab office in Pokhara",
  "teamCollab": "The Asva team planning a project together",
  "teamCareers": "Asva engineers at work in the Pokhara office"
}
```

Use the **slot name** as the key (left column below), not the file name:

`workspace`, `teamCollab`, `teamCareers`, `teamReview`, `webDev`, `webDesign`,
`webApp`, `customSoftware`, `mobileApp`, `uiux`, `ecommerce`, `integration`,
`cloud`, `analytics`, `ai`, `enterprise`

## What does *not* belong here

Photos of **projects, team members, and blog posts** are uploaded through the CMS
instead — **Admin → Media library** — so they can be managed without touching code.
This folder is only for the fixed decorative photography built into the page layouts.
