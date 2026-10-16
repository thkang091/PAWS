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

After device registration completes, in the same PowerShell window:

```powershell
eas build --platform ios --profile development
```

Allow EAS to create the required signing certificate and provisioning profile if
none are available. Select the registered iPhone. The build is for internal
distribution; it does not submit PAWS to the App Store.

When the build succeeds, open its Install link/QR on the iPhone. Enable Developer
Mode under Settings > Privacy & Security and restart when prompted.

## Connect to this PC

Connect the iPhone and PC to the same Wi-Fi. Start Metro in a separate PowerShell
window in the project directory, or remove the temporary dotenv override first:

```powershell
npm run start:iphone
```

Scan this server's QR code to open the installed PAWS development client.
Port 18942 is separate from the existing Android development server on 18941.
Allow Node on private networks if Windows Firewall prompts. If LAN access is
unavailable, use `npm run start:iphone -- --tunnel` (requires Expo's tunnel dependency).

JavaScript, caption, and screen changes reload from Metro. Native dependencies or
native app configuration changes require another iOS build. The cloud development
build excludes local `.env` files. The iPhone server loads only explicitly listed
public app settings from the local environment, excluding backend and AI secret keys.
Direct Gemini chat/food-check features are therefore unconfigured on this server.
Build-time native API keys must be configured separately in EAS if needed.

## Status

- Expo project linked and `expo-dev-client` installed.
- Development profile targets physical devices.
- Apple login, iPhone registration, and ad hoc signing are configured.
- First iOS build compiled on 2026-10-01 but crashes at launch; do not install it:
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/dab1a0d9-974c-43be-bdd5-57874a8f8b00
- Metro's iOS manifest and JavaScript bundle return HTTP 200. Device installation
  and an actual iPhone run still require verification.
- Build 2 succeeded and passed IPA dependency verification (20 binaries, 76
  required `@rpath` references, including embedded ExpoModulesJSI):
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/57213495-5dd2-48e8-9da7-39d1dd5d2a18
- Build 3 (2026-10-04) adds native WebView for the 1-1 YouTube pilot. Use this
  build for current source; build 2 lacks `RNCWebViewModule`. The IPA passed the
  same 20-binary/76-reference check and contains native `RNCWebViewModule` and
  `RNCWebViewImpl` classes. Install on the registered iPhone, then reconnect to
  Metro and verify playback:
  https://expo.dev/accounts/tminjae1124/projects/paws/builds/18920e7a-59e1-4f53-ad45-a884a7e37ba4

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
