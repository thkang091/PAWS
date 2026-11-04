# PAWS on a physical iPhone (Windows)

Expo project: https://expo.dev/accounts/tminjae1124/projects/paws

iOS bundle identifier: `com.tminjae1124.paws`.
The Android package identifier is unchanged.

## Register the iPhone

Open PowerShell in the PAWS directory:

```powershell
cd C:\Users\Minjae\Desktop\PAWS
$env:EXPO_NO_DOTENV = '1'
eas device:create
```

Use the linked Expo account, sign in with the Apple Developer account in the terminal,
and complete Apple's two-factor authentication. Choose the correct paid Apple team,
then **Website** registration. Open the generated link in Safari on the iPhone and
install the registration profile in Settings. Keep passwords and verification codes
out of chat and source files.

`EXPO_NO_DOTENV` prevents local runtime configuration from being resolved into cloud
project metadata. `.easignore` excludes environment files, backend source, local
build output, and logs; all training media and package patches remain included.

## Build and install

The existing registered iPhone and ad hoc signing can be reused. After device
registration completes, in the same PowerShell window:

```powershell
eas build --platform ios --profile development --clear-cache
```

Allow EAS to create the required signing certificate and provisioning profile if
none are available. Select the registered iPhone. The build is for internal
distribution; it does not submit PAWS to the App Store.

When the build succeeds, open its Install link/QR on the iPhone. Enable Developer
Mode under Settings > Privacy & Security and restart when prompted.

The EAS `development` environment contains the intended client configuration:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`GOOGLE_MAPS_API_KEY`. These were configured with sensitive visibility after user
approval. The Maps key must be available during the native build as well as when
Metro resolves the runtime configuration. Backend and AI credentials are not
needed in the mobile build.

## Connect to this PC

Use the HTTPS tunnel for this iPhone. The previous HTTP connection was rejected
by iOS App Transport Security. Start Metro in a separate PowerShell window in the
project directory. This PC already has Expo's tunnel helper installed globally;
`NODE_PATH` lets Expo find it on this Windows setup:

```powershell
$env:NODE_PATH = (npm root -g).Trim()
npm run start:iphone -- --tunnel
```

After installing the build, scan the server's QR code with the iPhone camera and
open PAWS. The installation QR and Metro connection QR have different purposes.
The active HTTPS address for this session is
`https://v-muyxc-tminjae1124-18942.exp.direct`; use the address printed by Expo if a
later tunnel receives a different one. The iOS manifest and its bundle URL must
both use HTTPS. The PC and tunnel must remain running while testing.

Metro uses port 18942, separate from the Android development server on 18941.
For a compatible LAN setup, `npm run start:iphone` remains available; it requires
the same Wi-Fi and private-network firewall access.

JavaScript, caption, and screen changes reload from Metro. Native dependencies or
native app configuration changes require another iOS build. The cloud development
build excludes local `.env` files. The iPhone server loads only explicitly listed
public app settings from the local environment, excluding backend and AI secret keys.
It also deliberately restores only `GOOGLE_MAPS_API_KEY` for the Maps client:
`app.config.js` uses it in native configuration and runtime `extra`. The key is
client configuration, not a backend or AI credential. Restart Metro after changing
these settings.

Current Gemini consumers use the authenticated Supabase `gemini` Edge Function
through `src/services/geminiProxy.ts`; no Gemini key is bundled in the app. A new
native build does not configure or verify Edge Function deployment, provider
secrets, OAuth providers, or database migrations.

## Status

- Expo project linked and `expo-dev-client` installed.
- Development profile targets physical devices.
- Apple login, iPhone registration, and ad hoc signing are configured.
- First iOS build compiled on 2026-10-01 but crashes at launch; do not install it:
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/dab1a0d9-974c-43be-bdd5-57874a8f8b00
- Metro's iOS manifest and JavaScript bundle return HTTP 200. Device installation
  and an actual iPhone run of each replacement build still require verification.
- Build 2 succeeded and passed IPA dependency verification (20 binaries, 76
  required `@rpath` references, including embedded ExpoModulesJSI):
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/57213495-5dd2-48e8-9da7-39d1dd5d2a18
- Build 3 (2026-10-04) added native WebView for the 1-1 YouTube pilot;
  build 2 lacks `RNCWebViewModule`. The IPA passed the
  same 20-binary/76-reference check and contains native `RNCWebViewModule` and
  `RNCWebViewImpl` classes. It lacks the Print, Sharing, and WebBrowser native
  modules added by the newer main branch. Current compatibility guards allow
  routes to load on build 3, but those features require an updated binary:
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/18920e7a-59e1-4f53-ad45-a884a7e37ba4
- **Build 4: FINISHED** at `2026-11-04T03:08:39Z`, submitted 2026-11-03 with
  the latest merged Train/Care/Profile/Shop and Game source:
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/def112b2-dec6-468f-913b-62d0b0bb314c
  The downloaded IPA is 39,990,285 bytes, identifies as
  `com.tminjae1124.paws` version `1.0.0`, build `4`, and requires iOS 16.4 or
  later. Framework verification passed: 21 binaries, 82 required `@rpath`
  references, and embedded `ExpoModulesJSI`.
  Binary inspection confirmed `ExpoPrintModule`, `SharingModule`,
  `WebBrowserModule`, `RNCWebViewModule`, `RNCWebViewImpl`, `GMSMapView`, and
  `GMSServices`. The intended Maps client key is present in the native binary;
  its value is not recorded here. The signing profile includes the same one
  registered iPhone and signing certificate as build 3 and expires 2027-07-15.
  **Installation and runtime checks on the physical iPhone are still pending.**

Solo currently remains a UI demo: camera preview, preparation countdown, timed
round, review/loading, and sample result. Actual video recording, AI judging, and
result persistence are not connected. The new native build provides the modules
for implemented features; it does not complete unfinished Game or backend work.

Official guide: https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/

## Build 1 launch crash

The physical iPhone crash report identified `DYLD / Library missing` for
`@rpath/ExpoModulesJSI.framework/ExpoModulesJSI`. The IPA independently confirms
this missing dependency in PAWS and nine embedded frameworks.

The existing `expo-modules-jsi` patch included 461 generated-artifact diff blocks
from a local Mac build, including binary-file placeholders. `patch-package`
materialized zero-byte framework binaries. Expo's stub-generation script checks
for file existence (`-f`), so these prevented creation of valid dynamic stubs
before CocoaPods decided which frameworks to embed. Later compilation produced
the real JSI framework, but it was absent from the final app bundle.

The patch now preserves only its 14 original Swift source changes. Generated
`Products`, `.DerivedData`, and `.generated` entries are removed. Rebuild with a
clean EAS cache and verify the actual IPA, not just the compilation result:

```powershell
python scripts/verify-ios-frameworks.py path/to/PAWS.ipa
```

The verifier follows required Mach-O `@rpath` dependencies from the app and its
embedded frameworks. Build 1 fails this check, matching the device report.
Build 2 passes the same check. Physical-device launch remains to be confirmed
after installing the replacement build.
