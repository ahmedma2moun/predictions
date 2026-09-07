# Football Prediction Admin

A standalone **Swift + SwiftUI** iOS 17+ app for iPhone and iPad. No React, React Native, Expo, web views, or third-party iOS dependencies.

## Run

Open `FootballPredictionAdmin.xcodeproj` in Xcode, select the `FootballPredictionAdmin` scheme and an iPhone simulator, then Run. For a physical device, select your Apple Developer team under Signing & Capabilities.

The app uses `https://predictions-virid.vercel.app`. **Deploy the backend changes in this branch before signing in against production.** Set `ADMIN_API_BASE_URL` in the target's build settings (and `project.yml`) to use a different HTTPS deployment. There are no bundled credentials. Sign in with an existing website account whose current database role is `admin`.

`project.yml` is the reproducible XcodeGen source. After changing it, run `xcodegen generate` in this directory. The generated Xcode project is checked in, so XcodeGen is not needed just to open or build the app.

## Admin capabilities

| Website section | Native app |
| --- | --- |
| Dashboard | Counts, management navigation, calculate all-time group champions |
| Seasons | Create drafts, activate, assign matches, preview champions, end season |
| Champion bonus | Enable, choose league/teams, edit allowed teams, lock/reveal, inspect picks/points, cancel |
| Leagues | Fetch available leagues, search, activate/deactivate |
| Teams | Choose league, fetch teams, toggle participation and reminders |
| Matches | Paginated list, details, custom matches, weekly/monthly/selective fixture fetch, result fetch, bulk deletion |
| Results | Latest 100 finished matches, correct scores/penalties, recalculate through correction, prediction breakdowns |
| Users | Search, create, edit name/role/password/notification email |
| Groups | Create, rename, delete non-default groups, add/remove members |
| Scoring | Edit points/active rules, recalculate all scores |
| Notifications | Send supported push types, inspect devices, live-goal and delayed-push tests |

The website's odds feature is currently disabled, so new seasons use `oddsEnabled: false`. Player features such as making predictions and browsing the player leaderboard are not included.

## Authentication

`POST /api/mobile/admin/auth/login` validates credentials and requires `role=admin` before issuing a dedicated 12-hour JWT. Tokens have a separate audience, issuer and scope, and are stored in Keychain with `WhenUnlockedThisDeviceOnly`. Passwords are not persisted. On logout or an authorization failure, the token is cleared. App snapshots are obscured while inactive.

Admin API handlers accept either an existing web session or the dedicated token through `src/lib/admin-auth.ts`. Every request reloads the account's current role; deleting or demoting an admin immediately prevents further requests. Ordinary player mobile tokens are rejected. Existing `MOBILE_JWT_SECRET` (or `NEXTAUTH_SECRET`) is required on the backend; no new database migration is needed.

## TestFlight encryption declaration

The app declares **`ITSAppUsesNonExemptEncryption = false`** in its generated Info.plist for both Debug and Release. This app uses Apple's HTTPS/URLSession and Keychain facilities and has no custom cryptography or third-party encryption libraries. The key supplies the export compliance answer so App Store Connect does not ask the encryption questionnaire on every upload. Reassess the declaration if non-exempt cryptography is added later.

Apple reference: https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption

To upload: select your development team, use a unique build number, archive with the Release configuration, then distribute through Xcode Organizer to App Store Connect. No upload or production deployment is performed by this implementation.

## Verification

From the repository root: `npm run test:unit` and `npx tsc --noEmit`.

From this directory:

```sh
xcodebuild -project FootballPredictionAdmin.xcodeproj -scheme FootballPredictionAdmin -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -derivedDataPath build CODE_SIGNING_ALLOWED=NO test
```

Backend tests cover admin login, player rejection, token isolation, expiry, forged tokens, role revocation and website-session compatibility. Native tests cover response decoding, restricted endpoints, failed login, authorization failures and mutation errors. The UI test checks the native sign-in screen without contacting production or sending notifications.
