# Production Build Checklist

Use Expo Go while iterating, but use EAS development, preview, and production builds before real users.

## App Identity

Update `app.json` before production:

- App name and slug
- URL scheme
- iOS bundle identifier
- Android package
- Final icon
- Adaptive icon
- Splash screen artwork
- Runtime version strategy

Do not ship `com.example.paws`.

## Permissions

Confirm user-facing permission text for:

- Camera
- Microphone, if video/audio recording is enabled
- Photo library
- Notifications

Camera and photo access are required for DogMoment and activity verification. Notifications require a development build or production build; do not promise push notifications in Expo Go.

## Environment Files

Use separate values for each build profile:

- `.env.development`
- `.env.preview`
- `.env.production`

Never commit real secrets. Expo public variables are visible to the app bundle, so only place anon keys and public configuration there.

## EAS Order

1. Install and authenticate EAS CLI.
2. Confirm `eas.json` profiles.
3. Build development:

```bash
eas build --profile development --platform ios
```

4. Test camera, DogMoment upload, AI video upload, anonymous auth, account linking, and notifications UI.
5. Build preview for TestFlight/internal testing.
6. Run live Supabase validation against the preview project.
7. Build production only after migrations, RLS, backend, and admin workflows are verified.

## Store Readiness

- App Store and Play Store screenshots.
- Privacy policy.
- Terms of use.
- Child/privacy review if applicable.
- Support contact.
- Data deletion path.
- Final reward terms if gold rewards are activated.
