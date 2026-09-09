# Auvora Professional Brand Kit (branch staging)

Place official brand assets here on `feat/auvora-branding-release-safety`.

Rules:

- Do not merge branding to `main` until recovery Admin step-up acceptance completes.
- Do not change Android `applicationId` when swapping icons/logos.
- Next customer Android build after branding must use `versionCode` **> 30**.
- Keep QA/staging package IDs separate; never publish them as the customer app.

Expected layout (fill when assets are supplied):

```
assets/brand/
  logo-primary.svg|png
  logo-mark.svg|png
  app-icon-1024.png
  README.md  (this file)
```

Until official files land, keep launcher icons under `android/app/src/main/res/mipmap-*`
and iOS `AppIcon.appiconset` as the production identity surfaces.
