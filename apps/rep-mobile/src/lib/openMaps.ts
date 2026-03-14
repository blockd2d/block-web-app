import { Platform } from "react-native";
import * as Linking from "expo-linking";

export async function openDriveToLatLng(lat: number, lng: number, label?: string) {
  const name = label ? encodeURIComponent(label) : "";

  if (Platform.OS === "ios") {
    // Apple Maps
    const url = `http://maps.apple.com/?daddr=${lat},${lng}${name ? `&q=${name}` : ""}`;
    await Linking.openURL(url);
    return;
  }

  // Android - prefer Google Maps
  const url = `google.navigation:q=${lat},${lng}`;
  await Linking.openURL(url);
}

export async function openStopAddress(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.OS === "ios" ? `http://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
  await Linking.openURL(url);
}
