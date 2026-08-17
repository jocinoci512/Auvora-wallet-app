# Reown Cloud — owner actions (production project)

Do not paste or screenshot the Project ID. The production public Project ID already exists in local gitignored config.

Reown Cloud currently allowlists **Android package name (App ID)** and **web origins / domains**. It does **not** currently require an Android signing-certificate SHA-256 on the App ID form. If the dashboard later shows a certificate fingerprint field, add it only after the real local `upload-keystore.jks` exists.

## Steps

1. Open [https://cloud.reown.com](https://cloud.reown.com) and sign in as the project owner.
2. Open the **production Auvora** project (the same Project ID compiled into Android as `WC_PROJECT_ID` and into web as `NEXT_PUBLIC_WC_PROJECT_ID`).
3. Open the project **Configuration** page (Allowlist / Domain / App ID).
4. Under **App ID**, add Android:
   - Platform: Android
   - App ID / package name: `com.auvora.auvora_wallet`
5. Under **Domain** / origin allowlist, add only the web origins that use this Project ID:
   - `https://auvorawallet.com`
   - `https://www.auvorawallet.com`
6. Save. Allowlist updates can take about 15 minutes.
7. Certificate SHA-256: **skip for now**. Generate the real upload key locally later, then add the production cert SHA-256 only if Reown shows that field.

## Do not add

- localhost / 127.0.0.1 (Reown already permits localhost)
- Railway private hostnames
- `*.up.railway.app`
- Vercel preview URLs
- Debug or throwaway signing fingerprints
