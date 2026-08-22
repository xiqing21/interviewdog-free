# Mac Signing and Notarization

## What You Need

GitHub cannot issue Apple signing certificates. For a macOS app distributed outside the Mac App Store, you need an Apple Developer Program membership and a `Developer ID Application` certificate from Apple.

## Create the Certificate

1. Join the Apple Developer Program.
2. Open Apple Developer `Certificates, Identifiers & Profiles`.
3. Create a `Developer ID Application` certificate.
4. Download the certificate and install it into the macOS login keychain.
5. Confirm the identity is visible:

```bash
security find-identity -v -p codesigning
```

Expected output includes a line like:

```text
Developer ID Application: Your Name or Company (TEAMID1234)
```

## Configure Notarization

1. In App Store Connect, create an App Store Connect API key.
2. Download the `.p8` key file and keep it outside the repo.
3. Copy the example env file:

```bash
cp electron-builder.env.example electron-builder.env
```

4. Fill in:

```bash
APPLE_API_KEY=/absolute/path/AuthKey_XXXXXXXXXX.p8
APPLE_API_KEY_ID=XXXXXXXXXX
APPLE_API_ISSUER=00000000-0000-0000-0000-000000000000
```

`electron-builder.env` is ignored by git.

## Build

Unsigned local build:

```bash
pnpm desktop:dist
```

Signed and notarized build after the certificate and API key are ready:

```bash
pnpm desktop:dist:signed
```

The final DMG is written to `release/`.
