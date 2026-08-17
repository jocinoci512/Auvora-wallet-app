# Auvora Wallet — Google Play listing assets

Local, non-secret store pack for Play Console. Do not put keystores, passwords, or `WC_PROJECT_ID` here.

| Path                                           | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `icon/play-icon-512.png`                       | Play listing icon (512×512, 32-bit PNG)                                      |
| `feature-graphic/feature-graphic-1024x500.jpg` | Feature graphic (1024×500, JPEG, no alpha)                                   |
| `screenshots/`                                 | Phone screenshots (1080×1920, 9:16) from current Flutter UI                  |
| `listing/`                                     | Store copy, Data safety draft, financial-features draft, Reown owner actions |

Regenerate UI screenshots and brand graphics from `apps/mobile` (writes goldens under this folder):

```
cd apps/mobile
$env:AUVORA_PLAY_CAPTURE='1'
flutter test test/play_store_screenshots_test.dart
```

Play Console should upload `feature-graphic/feature-graphic-1024x500.jpg` (JPEG, no alpha). The PNG next to it is the capture source and may contain alpha.

Do not generate `upload-keystore.jks` or build a signed AAB from this folder.
