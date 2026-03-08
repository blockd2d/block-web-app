/**
 * Entry point. Load React and React Native first, then defer the rest to the next
 * tick so Hermes has fully initialized base classes before any code uses "extends"
 * or accesses .prototype (avoids "Cannot read property 'prototype' of undefined").
 */
require("react");
require("react-native");

function initApp() {
  require("react-native-gesture-handler");
  const registerRootComponent = require("expo/src/launch/registerRootComponent").default;
  const AppModule = require("./App");
  const App = AppModule?.default;
  if (!App) {
    throw new Error("App module failed to load (missing default export). Check for import errors in App.tsx or its dependencies.");
  }
  registerRootComponent(App);
}

if (typeof setImmediate === "function") {
  setImmediate(initApp);
} else {
  setTimeout(initApp, 0);
}
