# Privacy Policy

**Effective date:** September 16, 2026

**Operator:** Nathan Connor (“we,” “us,” or “our”) operates **Berean** at [https://berean.nathanconnor.dev](https://berean.nathanconnor.dev) (the “Service”).

This policy describes how we collect, use, and share information when you use the Service.

## Summary

- You sign in with **Google**. We store your study data (notes, tags, verse links, highlights, settings) in **Convex**.
- Scripture text is fetched from the **ESV API** (Crossway) and shown in the app with required attribution.
- We do **not** use third-party analytics cookies as part of this codebase.
- You can **delete your account and all associated data** at any time from **Settings** (see “Your choices and rights” below).

## Information we collect

### Account and authentication

- When you choose **Sign in with Google**, **Google** shares profile details with our authentication provider according to your Google account settings. We typically receive identifiers such as **email address**, **name**, and **profile image URL**, and we associate them with your Convex Auth user record.
- **Convex** (Convex Auth) issues and validates sessions and stores auth-related tables required for login.

### Content and activity you provide

We store the following categories of data to provide verse-by-verse notes and search:

- **Notes:** text content, optional structured note bodies, tags, and creation/update timestamps.
- **Tags:** custom and starter tags, display labels, whether a tag is starter or custom, optional category color preferences, and usage timestamps.
- **Settings:** onboarding and tutorial completion timestamps, starter tag category colors, and related preferences.
- **Verse references and relationships:** Bible book, chapter, and verse ranges you link to notes; links between notes and verses; cross-verse links you create.
- **Highlights:** book, chapter, verse, character offsets within displayed passage text, highlight color, and timestamps.
- **Import:** if you import notes from a workbook (`.xlsx` / `.zip`), your browser parses the file and sends **structured note rows** to our backend; that content is stored like other notes.

### Automatically collected technical data

- **Hosting:** our frontend is served from **Vercel**. Vercel may process standard HTTP metadata (such as IP address, user agent, and request logs) according to [Vercel’s privacy policy](https://vercel.com/legal/privacy-policy).
- **Backend:** **Convex** processes queries, mutations, and actions when you use the app, including full-text search over your note content.

### Local storage on your device

- The app may use **session storage** for short-lived UI state (for example, an in-progress guided tour). That data stays in your browser unless you clear it.

### Scripture text (ESV)

- Passage text is retrieved from the **ESV API** via our server environment. Display of ESV text is subject to **Crossway’s ESV API terms** and uses the copyright and permission notices provided with the API response and shown in the app.

## How we use information

We use the information above to:

- Authenticate you and keep your account secure.
- Store, display, sync, and let you search your notes and related study data.
- Run full-text search and verse linking features you request.
- Improve reliability and fix bugs.

We **do not sell your personal information**.

## Sharing with service providers

We rely on processors that help us run the Service:

| Provider           | Role                                               |
| ------------------ | -------------------------------------------------- |
| **Convex**         | Database, authentication backend, server functions |
| **Vercel**         | Hosting and deployment of the web app              |
| **Google**         | OAuth sign-in                                      |
| **Crossway / ESV** | Scripture text via the ESV API                     |
| **Groq**           | Optional verse dictation (Whisper speech-to-text)  |

Optional verse dictation (the microphone on recall cards) records in your browser and sends short audio clips through our Convex backend to **Groq** Whisper to turn speech into text. Typing still works without a microphone. You can edit the transcript before Check. We do not use the expected verse as a transcription hint.

Each provider processes data under its own terms and privacy policy.

## Retention

We retain your account and study data until you delete your account or we delete it as described in this policy. After you complete **Delete account** in the Service, we remove your records from our Convex database without undue delay as part of that action.

## Your choices and rights

- You may disconnect or revoke Google access from your Google account settings (your Berean data remains until you delete your account in Berean or contact us).

- **Self-serve account and data deletion:** while signed in, open **Settings** and use **Delete my account**. You will be asked to confirm in a dialog. When you confirm, we **permanently delete**:
  - your **user profile** and **Google OAuth–linked auth records** (sessions, accounts, and related auth tables used by Convex Auth);
  - all **notes**, **tags**, **user settings**, **verse references**, **links between notes and verses** (including inline links), **cross-verse links**, and **highlights** stored under your account.

  You are **signed out** afterward. This action **cannot be undone**.

- **If you cannot access your account** (for example, you lost Google access) but need help, email **nathan.d.connor@gmail.com** and we will try to verify your request and assist where we reasonably can.

## Children

The Service is **not directed at children under 13**, and we do not knowingly collect personal information from children under that age. If you believe we have collected such information, contact nathan.d.connor@gmail.com so we can delete it.

## Contact

Questions or requests regarding this policy: **nathan.d.connor@gmail.com**
