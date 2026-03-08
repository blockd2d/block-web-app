# Labor app – development build

This app is in a **pnpm monorepo**. Use **pnpm** for all installs. Do **not** run `npx expo install` or `npm install` in this app; that can trigger `expo-module: command not found` during postinstall.

## One-time setup

1. **Install dependencies (from repo root):**
   ```bash
   cd /path/to/block-web-app
   pnpm install
   ```

2. **Add packages if needed:** edit `apps/labor-mobile/package.json`, then from repo root:
   ```bash
   pnpm install
   ```
   Or from the app dir: `pnpm add <package>` (no `expo install`).

3. **Log in to EAS:** `eas login` (from `apps/labor-mobile`).

## Create a development build

From the labor app directory:

```bash
cd apps/labor-mobile
eas build --profile development --platform ios
```

For Android: `--platform android`. For both: `--platform all`.

After the build finishes, install the app from the EAS link, then start the dev server:

```bash
cd apps/labor-mobile
npx expo start --dev-client
```
