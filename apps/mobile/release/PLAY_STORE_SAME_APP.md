# Google Play — same-app update checklist

- Application ID: `com.auvora.auvora_wallet`
- Listing title: **Auvora Wallet**
- Upload key SHA-256: see `production-identity.json`
- Every Play upload: `versionCode` strictly greater than last released code
- Never create a second Play application for the customer app
- Never publish `.qa` / `.staging` application IDs to the production listing
- Production API for builds: `https://api.auvorawallet.com`
- Mainnet broadcast remains OFF until explicit owner approval
