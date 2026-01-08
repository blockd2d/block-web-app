export function hashToHue(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function repColor(repId: string) {
  const h = hashToHue(repId);
  // Saturated but readable on both themes
  return `hsl(${h} 85% 55%)`;
}
