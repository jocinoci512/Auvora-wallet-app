# Release Guide — Version 1.0 Alpha

## Preconditions

- Flutter stable on PATH
- Android SDK + accepted licenses
- JDK 17 (`JAVA_HOME`)
- Prefer ≥20 GB free on the drive holding Gradle caches (use `GRADLE_USER_HOME` on a large volume if C: is tight)
- macOS + Xcode for iOS IPA

## Mobile release commands

```bat
cd apps\mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --release
flutter build appbundle --release
```

### Optional: single-ABI sideload APK (smaller)

```bat
flutter build apk --release --target-platform android-arm64
```

### Upload signing

1. Create keystore offline; back up securely
2. Copy `android/key.properties.example` → `android/key.properties`
3. Fill passwords / alias / `storeFile`
4. Rebuild AAB — never commit `key.properties` or `*.jks`

## Web release

```bat
pnpm --filter @auvora/web test
pnpm --filter @auvora/web typecheck
pnpm --filter @auvora/web lint
pnpm --filter @auvora/web build
```

Deploy `.next` / hosting artifact per your platform (Vercel / container).

## iOS release (macOS)

```bash
cd apps/mobile
flutter build ipa --release
```

Or Archive from `ios/Runner.xcworkspace` in Xcode. Upload to TestFlight.

## Version bumps

| File                                                  | Field                               |
| ----------------------------------------------------- | ----------------------------------- |
| `apps/mobile/pubspec.yaml`                            | `version: x.y.z+build`              |
| `apps/mobile/lib/release/release_config.dart`         | marketing / channel / kill switches |
| `apps/web/package.json` + `src/lib/release/config.ts` | mirror                              |
| Root `package.json`                                   | monorepo label                      |

## Post-build checklist

- [ ] APK installs on a physical Android device
- [ ] Kill switches still false (funding + broadcast)
- [ ] About links open
- [ ] No secrets in diagnostics export
- [ ] Tag `v1.0.0-alpha.1` when distributing

See [`TESTING_GUIDE_ALPHA_1.0.md`](TESTING_GUIDE_ALPHA_1.0.md) and [`STORE_READINESS_ALPHA_1.0.md`](STORE_READINESS_ALPHA_1.0.md).
