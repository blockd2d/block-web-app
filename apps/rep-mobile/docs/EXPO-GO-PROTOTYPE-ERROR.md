# Expo Go Prototype Error - Issues Document

## 1. Error Summary

- **Error:** `TypeError: Cannot read property 'prototype' of undefined` on iOS when running in Expo Go
- **When:** Occurs during Metro module load, before the app renders
- **Stack trace:** Shows only Metro/Hermes internals (`metroRequire`, `loadModuleImplementation`, `guardedLoadModule`); no user-file line numbers
- **Result:** "App entry not found" — `registerRootComponent` never runs because an uncaught error is thrown earlier

## 2. Root Cause

- `**react-native-screens`** (used by `@react-navigation/native-stack` and `@react-navigation/bottom-tabs`) triggers the error in Expo Go's prebuilt binary
- Expo Go ships a fixed set of native modules; a version mismatch or compatibility issue causes `.prototype` access on `undefined` during initialization
- **Confirmed via binary search:**
  - Minimal app (no navigation) — works
  - Adding `NavigationContainer` only — works
  - Adding `createNativeStackNavigator` + `Stack.Screen` — **error**
  - Custom `RootNavigatorSimple` (no react-native-screens) — works

## 3. Attempts Tried


| Attempt                                                                    | Result                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Import `react-native-gesture-handler` first in entry point                 | No change                                              |
| Call `enableScreens(false)` before other imports                           | No change                                              |
| Replace native stack with `@react-navigation/stack`                        | Install failed (pnpm 401)                              |
| Custom `RootNavigatorSimple` (conditional rendering, no native stack/tabs) | Works in Expo Go                                       |
| Remove `@react-navigation/`* and `react-native-screens` entirely           | Error persists (other dependency or cached bundle)     |
| `expo install --fix`                                                       | Failed: npm vs pnpm, EPERM on Windows, `bob` not found |


## 4. Current Workaround

- Use `RootNavigatorSimple` — no native stack or bottom tabs
- App runs in Expo Go but lacks stack animations and native tab bar

## 5. Recommended Path

**Use a development build instead of Expo Go.**

- Run `npx expo run:ios` to build a custom native app
- Development builds include your exact native dependencies and avoid Expo Go's prebuilt constraints
- **Requires:** Mac, Xcode, Apple ID (free tier works for simulator)
- Full navigation, Mapbox, and native modules will work in the dev build

