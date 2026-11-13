# ఆంధ్రకలం · Andhara Kalam ePaper

A Telugu-first newspaper portal based on the [existing Andhara Kalam ePaper](https://andhrakalam-app-963468464051.us-central1.run.app/). Readers can switch to English, select a district, search by headline or date, open all pages of a PDF in one scrolling reader, download issues, and bookmark or share them. Reading is public. Bookmarks and language preference are stored in the reader's browser.

## Run locally

Requires Node.js 24 or later.

```sh
npm ci --omit=optional
npm start
```

Open <http://localhost:8080>. Run `npm run check` to check the JavaScript syntax.

## Publish an edition

Set `EDITOR_USER` and `EDITOR_PASSWORD` as server environment variables. Use a unique, strong password of at least 12 characters. `npm start` also reads a local, Git-ignored `.env` file if one exists.

1. Select **Upload PDF** and sign in as the editor.
2. Enter the Telugu headline, district and publication date, then choose an unlocked PDF up to 30 MB and 200 pages. English text is optional.
3. Select **Publish edition**. The PDF appears under Today or Archive according to its date in India Standard Time. Tomorrow's issue is also shown under Today. The editorial menu lets the editor remove published issues.

The archive keeps issues dated up to seven days before today. Expired issues are removed from the database on startup and hourly. Keep separate editorial copies of original PDFs if needed beyond this window. The initial catalog shows the reference's Amaravati sample when no published issues are available. The source displays the masthead for this sample's pages. Set `SHOW_SAMPLE=0` to hide it.

## Host the website

Run `npm ci --omit=optional` and `npm start` on a Node.js host with persistent storage. The process binds to `PORT` (default `8080`). Set `DATA_DIR` to a persistent mounted directory, use a single application instance with that SQLite database, and set `NODE_ENV=production` behind HTTPS so the login cookie is secure. Keep editor credentials in the host's secret settings.

The new portal uses its own SQLite database. The reference site's accounts and uploaded editions are managed separately. See the next section for the Cloudflare Pages setup.

## Deploy on Cloudflare Pages

In **Workers & Pages → your Pages project → Settings → Build & deployments**, set the production branch to `main`, select **None** as the framework preset, and use the following settings.

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build` |
| Build output directory | `dist` |

The repository builds the website and the PDF reader assets into `dist`. Cloudflare compiles the Pages Functions in `functions/` for the same deployment. After saving the settings, retry the latest deployment or push a new commit to `main`. The project’s **Deployments** tab shows its exact URL.

The public portal and labeled sample work as soon as the build succeeds. Enable editor uploads with these production settings:

1. Create a **D1 database** and run the statements from [schema.sql](./schema.sql) in its D1 console. You can also run `npx wrangler d1 execute YOUR_DATABASE_NAME --remote --file=schema.sql` with Cloudflare CLI access.
2. Create an **R2 bucket** for edition PDFs and leave its public access disabled. If Cloudflare asks you to activate R2, complete that in your account.
3. Under **Settings → Bindings**, add the D1 database as `DB` and the R2 bucket as `PDFS`.
4. Under **Settings → Variables and Secrets**, set `EDITOR_USER` and `EDITOR_PASSWORD` as secrets. Use a strong password of at least 12 characters.
5. Redeploy so the production deployment receives the new bindings and secrets.

Pages stores edition metadata in D1 and PDFs in R2. Editions outside the seven-day archive are immediately hidden from readers and cleaned up after successful uploads. The standalone Node server and its SQLite database remain available through the instructions above.
