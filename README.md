# Berean

Berean is a scripture notes app focused on verse by verse note taking, emphasizing careful and intentional notes based on the text. Inspired by Acts 17:11 where the Bereans are described as eagerly examining the scriptures, this app invites Christians to do the same, methodically studying God's word verse by verse, and recording down the insights God grants.

**Features**
- Passage reader with chapter navigation and tabbed workspaces
- Compose and read modes for verse-linked notes, including multi-verse ranges
- Tag notes for later search and categorization, as well as link notes to other verses.
- Full-text note search with tag filters and scripture context
- Tag catalog with starter tags, custom tags, and category colors
- Import notes from `.xlsx` or `.zip` workbooks (export UI is present but currently disabled)
- Guided tutorial tours for the main workflow and advanced search

**Integrations And Keys**
- Convex (database, serverless functions, auth): requires a Convex deployment and the frontend `VITE_CONVEX_URL`
- Convex Auth + Google OAuth: requires a Google OAuth Client ID and Client Secret configured in the Convex environment
- ESV API (scripture text): requires `ESV_API_KEY` in the Convex environment
- Vercel (optional deploy): uses `npx convex deploy` during build via `vercel.json`

**Local Setup**
1. Install dependencies.
   ```bash
   pnpm install
   ```
1. Create or attach a Convex deployment.
   ```bash
   npx convex dev
   ```
1. Configure frontend environment variables.
   Create `.env.local` with:
   ```env
   VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
   ```
1. Configure Convex environment variables (Dashboard or CLI).
   Set `ESV_API_KEY` (from api.esv.org), `CONVEX_SITE_URL` (your app base URL; use `http://localhost:5173` in dev), and your Google OAuth Client ID/Secret (for Convex Auth).
1. Run the app.
   ```bash
   pnpm dev
   ```

**Testing**
- `pnpm test`

**Notes On Import Format**
- One Bible book per file, one chapter per sheet, one verse per row.
