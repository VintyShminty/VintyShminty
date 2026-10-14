# Going online

This guide puts Vinty's server on the internet so the app on your iPhone (or the simulator) can talk to it without your Mac. You will click through Vercel (which also hosts Neon and Upstash for you), Cloudflare and Resend.

Three rules while you do this:

- Never paste a password, key or secret into the chat with Claude. Paste them only into the website box they are meant for.
- Where a step says "the coordinator can do this", you can also hand it over. The coordinator uses the Vercel command line, but only after you have logged in yourself once in the terminal (`vercel login`). Nobody else can log in for you.
- Take your time. Nothing here can break the app on your Mac.

## What you are building

- Vercel runs the server. It starts copies of it when people use the app. Because a copy only lives while it answers, two things changed: the timers (offers expiring, orders completing) are now started by Vercel's alarm clock (called Cron), and live chat messages travel through a shared mailbox (Redis) so everyone sees them.
- Neon is the database (the notebook where all accounts, items and orders are written).
- Upstash Redis is the shared mailbox for live chat.
- Cloudflare R2 stores the photos.
- Resend sends the emails with the 6 digit codes.

## Before you start: which Vercel plan

The alarm clock matters. Vercel's free plan (Hobby) only allows an alarm that rings once a day, and a deploy fails if a faster alarm is set ([Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Vinty wants its order timer to ring every minute so offers expire and held items return on time. That needs the Pro plan. The Hobby plan also says it is for non-commercial use, and Vinty is meant to become a business.

Decided (Eden, 2026-10-13): Hobby for private testing, with one daily alarm (`/v1/jobs/all` at 03:00 UTC), so offers and held items expire up to a day late. Before real users or anything commercial, move to Pro and restore the faster list described in Part F.

## Part A: Vercel project

1. Open [vercel.com](https://vercel.com) and log in. Choose **Add New**, then **Project**.
2. Under **Import Git Repository**, find the VintyShminty repository and click **Import**. If it is not listed, click **Adjust GitHub App Permissions** and allow it.
3. Before you click Deploy, find **Root Directory** and click **Edit**. Choose `apps/server`. Then make sure the switch **Include source files outside of the Root Directory in the Build Step** is on. Vinty's server needs the shared folders next to it ([Monorepos](https://vercel.com/docs/monorepos)).
4. The framework should say **Fastify** (Vercel finds it by itself, see [Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify)). Leave build and install commands empty.
5. Do not click Deploy yet. Open **Environment Variables** on the same page only if you want to add them now. The easier way is to deploy once after the storage steps below. If Vercel insists, click Deploy: the first deploy may fail because the settings are missing, and that is fine.

The coordinator can do steps 1 to 5 with `vercel link` (after you ran `vercel login`).

## Part B: Neon database

6. In your Vercel project, open the **Storage** tab, click **Create Database** (or **Browse Marketplace**) and choose **Neon**. Choose **Create New Neon Account** (billing goes through Vercel). Pick the free plan, a region close to your users (the same region as your Vercel functions is best), and name it `vinty`.
7. On the next screen, connect it to your Vercel project for **Production** (and Preview if you like). Click **Connect**. Vercel now adds `DATABASE_URL` (the pooled address the server uses) and `DATABASE_URL_UNPOOLED` (the direct address used only for creating tables) to the project by itself ([Neon on Vercel](https://neon.com/docs/guides/vercel-native-integration)).

## Part C: Upstash Redis (the live chat mailbox)

8. **Storage** tab again, **Create Database**, choose **Upstash**, then **Redis**. Free plan is fine. Connect it to the project for Production.
9. Open the project's **Settings**, **Environment Variables**. Look for the Upstash variables. We need an address that starts with `rediss://` (two s). Create a new variable named `REDIS_URL` and paste that address as the value. If you only see addresses starting with `https://` (those are the REST ones), open the database in the Upstash console from the Storage tab and copy the **TCP** connection address that starts with `rediss://`. I could not confirm from the docs which variable names Upstash adds, so check this one with your own eyes.

## Part D: Cloudflare R2 (photos)

10. Open the [Cloudflare dashboard](https://dash.cloudflare.com), go to **R2 object storage**, click **Create bucket**, name it `vinty`, location automatic.
11. Open the bucket, **Settings**, find **Public Development URL** and click **Enable**. Type `allow` and confirm. Copy the address that appears (like `https://pub-abc123.r2.dev`). This is `S3_PUBLIC_URL`. Cloudflare says this address is rate limited and only meant for development ([Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)). It is fine for now. Before real launch, connect a custom domain under **Custom Domains** in the same page.
12. Go back to R2 **Overview**. Under **Account Details**, next to **API Tokens**, click **Manage**, then **Create Account API token**. Choose permission **Object Read and Write**, limit it to the `vinty` bucket, and create it. Copy the **Access Key ID** and **Secret Access Key** right away, the secret is shown only once ([R2 tokens](https://developers.cloudflare.com/r2/api/tokens/)). Also copy your **Account ID** from the same page.

Photo uploads go straight from the phone to the bucket with a one time link made by the server. Because the app is a phone app (not a website), the bucket needs no CORS setting. If you ever upload from a website, a CORS rule would be needed. I did not verify R2's CORS screen.

## Part E: Resend (email)

13. Open [resend.com](https://resend.com), **API Keys**, **Create API Key**, permission **Sending access**, copy it once. Without a verified domain Resend only lets you send from `onboarding@resend.dev` (it is for testing) and, per Resend's rules for unverified accounts, only to the email address you signed up to Resend with. So for now only your own address receives the sign up codes. To let other people sign up, you need a domain later: add it in Resend, add the DNS records they show, then set `MAIL_FROM` to an address on that domain. Ask Claude to help at that point.

## Part F: The settings (environment variables)

14. In the Vercel project, **Settings**, **Environment Variables**, add each row below for **Production**. "Make one" means you generate a random text in your terminal with `openssl rand -base64 32` and paste the result into the Vercel box. Do not paste it anywhere else.

| Name | Where the value comes from |
|---|---|
| `NODE_ENV` | The word `production` |
| `DATABASE_URL` | Added by Neon in step 7 |
| `BETTER_AUTH_SECRET` | Make one |
| `BETTER_AUTH_URL` | Your server's address, `https://<project>.vercel.app` (you learn it after the first deploy, then set it and redeploy) |
| `CRON_SECRET` | Make one. Vercel then sends it to your alarm clock requests by itself ([Securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)) |
| `REDIS_URL` | From step 9 |
| `MAIL_TRANSPORT` | The word `resend` |
| `RESEND_API_KEY` | From step 13 |
| `S3_ENDPOINT` | `https://<Account ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | The word `auto` |
| `S3_BUCKET` | `vinty-photos` |
| `S3_ACCESS_KEY_ID` | From step 12 |
| `S3_SECRET_ACCESS_KEY` | From step 12 |
| `S3_FORCE_PATH_STYLE` | The word `true` |
| `S3_PUBLIC_URL` | From step 11, without a slash at the end |

**AI photo helper (optional).** To switch on the suggestions in the sell form online, add `ANTHROPIC_API_KEY` (your key from console.anthropic.com) to the Vercel settings and redeploy. Without it the sell form works as before, nothing is refused at start. Each listing costs a small fraction of a cent. Optional: `PHOTO_READER_MODEL` to change the model (default `claude-haiku-5-5`).

The server checks all of this when it starts. If something is missing or still points at your Mac, it refuses to start and the deploy log says which setting is wrong in plain words.

Google and Apple sign in are switched on in Part J. Real push alerts come later. Push stays on its online default, which tries to send through Expo.

`apps/server/vercel.json` holds the Hobby list (one entry, `/v1/jobs/all` daily). When moving to Pro, replace it with `/v1/jobs/orders` every minute (`* * * * *`), `/v1/jobs/feed-popularity` every 15 minutes (`*/15 * * * *`) and `/v1/jobs/feed-cleanup` daily (`0 3 * * *`).

The coordinator can add all of these with `vercel env add` if you read the values out of the websites yourself and type them in the terminal prompts. Do not hand secrets over in chat.

## Part G: Deploy and create the tables

15. In the Vercel project, open **Deployments** and click **Redeploy** on the latest one (or push to the main branch). Wait for **Ready**. Copy your address from the top (`https://<project>.vercel.app`). If this is the first time, set `BETTER_AUTH_URL` to it now and redeploy once more.
16. Check **Settings**, **Deployment Protection**. Your production address must open without a Vercel login, otherwise the app cannot reach the server. Vercel's own default leaves the production address open, but check.
17. Check **Settings**, **Functions** that **Fluid compute** is on. Live chat needs it ([WebSockets](https://vercel.com/docs/functions/websockets)). It is on by default for projects created after April 2025.
18. Create the tables. This is done once per release that changes the database, from your Mac, not by Vercel:
    1. In the Vercel project, **Storage**, open the Neon database, reveal `DATABASE_URL_UNPOOLED` (the direct address). Copy it.
    2. On your Mac, create the file `packages/db/.env.online` (it is git ignored, so it never gets committed) with one line: `DATABASE_URL=` followed by that address.
    3. In the terminal, in the project folder, run `pnpm db:migrate:online`. It builds all tables.
    4. Run `pnpm db:seed:reference:online` once. It adds the categories, brands and sizes the app needs. It only adds or updates reference data, it never adds fake people.
    5. Delete `packages/db/.env.online` afterwards if you like.

    The sample data commands (`pnpm db:seed`, `pnpm db:reset`) refuse to run on anything that is not your own Mac, so they cannot touch the online database by mistake.
    Why not run it automatically on every deploy: a half finished table change during a deploy could leave the live app broken, and Neon says to use the direct address for this ([Neon pooling](https://neon.com/docs/connect/connection-pooling)). One deliberate command is safer.

    The coordinator can do 18 with the Vercel command line: `vercel env pull` brings the values down and it runs the same two commands.

## Part H: Check that it works

19. Open `https://<project>.vercel.app/health` in a browser. You should see `{"ok":true}`.
20. Open `https://<project>.vercel.app/health/db`. You should see `"database":"up"`. If it says down, the `DATABASE_URL` setting or the migration step is wrong.
21. In Vercel, **Settings**, **Cron Jobs**: the three alarms should be listed. Click **Run** next to the first one, then **View Logs**. A line with status 200 means the secret works. Crons only run on the production deployment ([Cron Jobs](https://vercel.com/docs/cron-jobs)).

## Part I: Point the app at the online server

22. In `apps/mobile/.env` (not committed), set:
    - `EXPO_PUBLIC_API_URL=https://<project>.vercel.app`
    This is public by design, so it is safe to be in the app.
23. Restart Expo with `npx expo start -c` (the `-c` clears the saved copy of the old address). Open the simulator. Sign up with your Resend account email (the only address that receives mail for now), type the 6 digit code from your real inbox, and list an item with a photo.

Live chat on Vercel: connections are closed by Vercel when a function reaches its maximum duration (5 minutes by default, up to about 13 minutes on Pro). The app already reconnects by itself and reloads what it missed, so people only see a blink ([how it works](https://vercel.com/docs/functions/websockets)). Vercel's WebSocket support is in beta.

To go back to your Mac: put the old two lines back in `apps/mobile/.env` and restart Expo with `-c`.

## Part J: Sign in with Apple and Google

The app already has the two buttons. They stay hidden until the server has the keys below, so you can do this whenever you like. You will make a few values on Apple's and Google's websites and paste them into Vercel. Never paste them in a chat. The app ID is `com.secondhand.marketplace` and your Apple Team ID is `DTT66N8N3D`.

### J1: Apple (about 10 minutes)

The app ID is already registered with Sign In with Apple on, so the phone side is done. Vinty only needs the server to know the app ID.

1. In Vercel, open the project, **Settings**, **Environment Variables**. Add `APPLE_APP_BUNDLE_IDENTIFIER` with the value `com.secondhand.marketplace`, for **Production**. That alone turns Apple on. Redeploy (**Deployments**, the latest one, **Redeploy**).

Later, before the App Store, Apple wants a key so that when someone deletes their Vinty account the link with Apple is removed too. Make it now if you like, it takes two minutes:

2. Open [developer.apple.com/account](https://developer.apple.com/account), then **Certificates, Identifiers & Profiles**, then **Keys** in the left list. Click the **+** next to **Keys**.
3. Name it `Vinty sign in`. Tick **Sign in with Apple** and click **Configure** beside it. Under **Primary App ID** choose `com.secondhand.marketplace`, click **Save**, then **Continue**, then **Register**.
4. Click **Download**. You get a file ending in `.p8`. Apple lets you download it only once, so keep it safe (a password manager is best). On the same page copy the **Key ID** (10 letters and numbers).
5. In Vercel add three more variables for **Production**: `APPLE_TEAM_ID` = `DTT66N8N3D`, `APPLE_KEY_ID` = the Key ID, and `APPLE_PRIVATE_KEY` = the whole text of the `.p8` file (open it with TextEdit, copy everything including the BEGIN and END lines). Vercel keeps the line breaks. The server makes Apple's temporary secret from these by itself every time it starts, you never have to renew anything by hand.

You do **not** need a Services ID or a return address for Apple, those are only for websites.

### J2: Google (about 20 minutes)

You need one thing from Google: a **Web** client. (We use the browser sheet, so no iOS client is needed. If we ever switch to the Google account picker we will add an iOS client then.)

1. Open [console.cloud.google.com](https://console.cloud.google.com) and pick your project in the top bar.
2. In the left menu click **APIs & Services**, then **OAuth consent screen** (it may now be called **Google Auth Platform**, then **Branding**). Click **Get started**.
3. App name `Vinty`. User support email: your email. Click **Next**. Audience: choose **External**, **Next**. Contact email: your email, **Next**. Tick the agreement, **Continue**, **Create**.
4. Still in the same area, open **Audience**. Leave **Publishing status** as **Testing** while you try it. Under **Test users** click **Add users** and add your own Gmail (only test users can log in while it is in Testing). When you are ready for real people, click **Publish app**. Google may ask to verify the app, because we only use basic information (email and name) this is usually quick.
5. Open **Clients** (or **Credentials**, then **Create credentials**, **OAuth client ID**). Click **Create client**. **Application type**: **Web application**. Name: `Vinty server`.
6. Under **Authorized redirect URIs** click **Add URI** and paste `https://vinty-shminty.vercel.app/api/auth/callback/google` (your server address, then `/api/auth/callback/google`). Leave **Authorized JavaScript origins** empty. Click **Create**.
7. A box shows the **Client ID** and **Client secret**. Copy both now into Vercel (**Settings**, **Environment Variables**, Production): `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Redeploy.

### J3: Check it

1. Open `https://vinty-shminty.vercel.app/v1/auth/providers` in a browser. It should show `{"apple":true,"google":true}` (or only the ones you did). If it says false, the Vercel value is missing or you did not redeploy.
2. Open the app (it must be the new development build, because the app ID changed). The welcome, log in and sign up screens now show the buttons. Apple's button only shows on a real iPhone or a simulator that is signed in to an Apple ID.
3. Tap one. A new account lands on the two short questions. A returning one lands on Home.

### What goes where

| Value | Where it is made | Where it goes |
|---|---|---|
| `com.secondhand.marketplace` | already decided | Vercel `APPLE_APP_BUNDLE_IDENTIFIER` (already inside the app) |
| Apple Team ID `DTT66N8N3D` | Apple Developer, Membership | Vercel `APPLE_TEAM_ID` (optional now) |
| Apple Key ID and `.p8` file | Apple Developer, Keys | Vercel `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (optional now) |
| Google Client ID and secret | Google Cloud, web client | Vercel `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |

Nothing goes into `apps/mobile/.env` for sign in: the app asks the server which buttons to show. For a server on your own Mac, put the same values in `apps/server/.env`, and in Google's client add `http://localhost:3000/api/auth/callback/google` as a second redirect address. Apple sign in works against a local server too, because it only checks the token.

Apple's "hide my email": some people will hide their email. Apple then gives Vinty a random address ending in `privaterelay.appleid.com`. It works as their login email. Emails we send to it (codes, order news) only arrive once the sending domain is registered with Apple (Apple Developer, **Services**, **Sign in with Apple for Email Communication**). Do this when you add your own email domain.

## The website on Vercel

The website (`apps/web`) is a second Vercel project in the same GitHub repository. It talks to the server you already put online. Do this after the server works.

1. In Vercel click **Add New**, then **Project**. Pick the same GitHub repository as the server.
2. On the setup page click **Edit** next to **Root Directory** and choose `apps/web`. Vercel installs the whole workspace from the repository's top folder by itself (the setting **Include source files outside of the Root Directory** is on by default, leave it on). The packages shared with the app (`packages/design`, `packages/locales`, `packages/shared`) are found that way ([Monorepos](https://vercel.com/docs/monorepos)).
3. The framework should say **Next.js**. Leave the build and install commands empty (the build command comes from the project and uses webpack on purpose).
4. Under **Settings**, **General**, **Node.js Version**, choose 22.x, the same as the server.
5. Open **Environment Variables** and add two for **Production**, both set to the server's address (today `https://vinty-shminty.vercel.app`, no slash at the end):
   - `API_URL` (the website's own server uses it to forward login and data calls)
   - `NEXT_PUBLIC_API_URL` (the browser uses it for live chat)
6. Click **Deploy** and wait for **Ready**. Copy the website's address (`https://<name>.vercel.app`) from the top.
7. Open the **server** project (not the website), **Settings**, **Environment Variables**, add `WEB_ORIGINS` for **Production** with the website address you just copied (no slash at the end), then **Deployments**, the latest one, **Redeploy**. Without this the server refuses the website's login.
8. In the website project check **Settings**, **Deployment Protection**: the production address must open without a Vercel login.
9. Open `https://<website address>/en` and `/he`. You should see the Vinty bar and "Welcome in". The hidden `/en/dev/connection` page does not exist online (that is on purpose).

After this, every merge into `main` deploys the website by itself, the same as the server.

## Putting a change online

Vercel is connected to GitHub. Every push to a branch builds a private preview copy, and a merge into `main` goes live by itself. To try a branch on the live address before Eden merges, deploy it by hand from a clean copy (the main folder holds too many local build files for Vercel's upload limit):

1. `git -C VintyShminty-copies/deploy fetch origin && git -C VintyShminty-copies/deploy checkout --detach origin/<branch>`
2. In that folder: `vercel deploy --prod --yes --scope vinty1` (the copy is linked to the project once with `vercel link`).
3. Check `https://vinty-shminty.vercel.app/health/db`. Only deploy after `pnpm typecheck`, `pnpm lint` and `pnpm test` passed, chained with `&&`.

The upload only includes files git tracks, so git-ignored `.env` files never leave the Mac. The next merge into `main` replaces a hand deploy, so merge soon after.

## If something goes wrong

- Deploy fails with "Invalid environment": read the list, it names the exact setting.
- Build fails on Hobby with a cron message: you picked a faster alarm than Hobby allows, see the plan decision above.
- Photos upload but do not show: `S3_PUBLIC_URL` is wrong or the public development URL was not enabled in step 11.
- No email arrives: only your Resend account address can receive mail until a domain is verified.
