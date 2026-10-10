# App Store submission

What to put into App Store Connect for Packmates, and how the app meets
Apple's App Review Guidelines. Never put the demo account's password in
this file: the repository is public.

## App information

| Field | Value |
| --- | --- |
| Name | Packmates |
| Subtitle | Meet people like you |
| Category | Social Networking (secondary: Lifestyle) |
| Price | Free |
| Support URL | https://packmates.live/info#contact |
| Privacy Policy URL | https://packmates.live/privacy |
| Marketing URL | https://packmates.live |
| Contact email | hello@packmates.live |

**Description**

> A free map of meetups near you: walks, runs, painting, sketching, board
> games, coffee, a pint. Pick one, tap "I'm in", turn up. No messages, no
> adverts, no fuss. Everyone has a real photo so you know who to look for,
> and three reports from people you've met means banned for life.

**Keywords:** meetup,friends,walk,run,social,club,group,local,art,sketch,hobby

## Age rating

Answer the questionnaire honestly; with user-generated content and meeting
people in person, choose **18+**. The app asks every new member to confirm
they're 18 or over.

## App Privacy ("nutrition label")

Tracking: **No**. Data is never used to track people or for adverts.

| Data type | Collected | Linked to the person | Used for |
| --- | --- | --- | --- |
| Contact info: email address | Yes | Yes | App functionality |
| Contact info: name (first name) | Yes | Yes | App functionality |
| User content: photos (one profile photo) | Yes | Yes | App functionality |
| User content: other (meetups, reports) | Yes | Yes | App functionality |
| Identifiers: user ID | Yes | Yes | App functionality |
| Location | **No** (Near me stays on the phone) | | |
| Diagnostics, usage data, purchases | No | | |

## Notes for App Review

Paste this into **App Review Information → Notes**, and put the demo account's
email and password in the sign-in fields (not here).

> Packmates is a free map of in-person meetups (walks, runs, painting,
> sketching, board games, coffee). Members tap a meetup, tap "I'm in" and
> turn up. There is no messaging between members.
>
> The demo account already has a profile photo, which is required to join
> a meetup so the group knows who to look for, and can post meetups.
>
> Safety (guideline 1.2):
> - Sign up requires ticking "I'm 18 or over and agree to the Terms and
>   Privacy policy". The Terms (packmates.live/terms) have zero tolerance
>   for objectionable content and abusive users.
> - Names and all meetup text are filtered for offensive words, links,
>   emails and phone numbers.
> - Every person on a meetup has "Report or block" under their name, and
>   every meetup has "Report this meetup". Reports reach our moderators,
>   and three reports from people met at meetups ban an account
>   automatically, with no moderator needed.
> - Blocking hides both people's meetups from each other. Unblock on Me.
> - Contact: hello@packmates.live (Info → Contact us).
>
> Account deletion (5.1.1(v)): Me → Delete my account.
> Location (5.1.5): only for "Near me" on the map; it stays on the device.

## Building and sending the app (no Mac needed)

GitHub builds it on its own Macs: `.github/workflows/ios.yml`. Until the
four App Store Connect secrets are added it only checks the app builds;
with them, each run signs the app and sends it to App Store Connect.

1. App Store Connect → **Users and Access** → **Integrations** → **App Store
   Connect API** → generate a key with the **Admin** role. Note its **Key
   ID** and the **Issuer ID**, and download the `.p8` file (only once).
2. developer.apple.com → **Account** → **Membership details**: the **Team ID**.
3. GitHub → the repo → **Settings** → **Secrets and variables** → **Actions**:
   add `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY` (the whole
   `.p8` file, BEGIN and END lines included).
4. App Store Connect → **Apps** → **+** → New App: iOS, name Packmates,
   bundle ID `live.packmates.app`, SKU `packmates`.
5. GitHub → **Actions** → **iPhone app** → **Run workflow**. A few minutes
   later the build is in App Store Connect under **TestFlight**; add it to
   the version and **Submit for Review**.

## Demo account (set up once, before submitting)

1. Sign up on packmates.live with an email you control, name "App Review".
2. Add a face photo (Me → tap the photo).
3. On /admin, mark it as verified so it can post meetups straight away.
4. Make sure at least one upcoming meetup is on the map for them to join.

## Guidelines checklist

| Guideline | How Packmates meets it |
| --- | --- |
| 1.2 User-generated content: filter | `looksOffensive` and `looksLikeAdvert` in `src/lib/bots.ts` on names and all meetup text |
| 1.2 Report | "Report or block" under every person, "Report this meetup"; reports on /admin with a link to the meetup |
| 1.2 Block | `src/lib/blocks.ts`; Blocked list with Unblock on Me |
| 1.2 / 1.5 Contact | hello@packmates.live on Info, Terms, Privacy and Me |
| 1.1.4 / random chat | No messaging; not a dating or hookup app (in the Terms) |
| 2.1 Demo account | See above |
| 4.2 Minimum functionality | The app (mobile/) uses the phone's own location for Near me, share sheet, camera for the profile photo and haptics, has its own launch screen and offline screen, and leaves out website-only bits |
| 4.8 Login services | Email and password; Google sign in only ever shows alongside Sign in with Apple |
| 5.1.1(i) Privacy policy | /privacy, linked at sign up, Info and Me |
| 5.1.1(ii) Consent | The sign up tick box; withdrawn by deleting the account |
| 5.1.1(v) Account deletion | Me → Delete my account |
| 5.1.2 No tracking | No adverts, analytics or tracking |
| 5.1.5 Location | Near me only, on the device, with the purpose explained |
