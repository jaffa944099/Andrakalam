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

The new portal uses its own SQLite database. The reference site's accounts and uploaded editions are managed separately. A static host such as GitHub Pages cannot run the publishing backend.
