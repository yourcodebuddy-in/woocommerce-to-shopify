export function identifyCourierViaTrackingNumber(trackingNumber: string): string | null {
  const prefix = trackingNumber.slice(0, 2).toUpperCase();
  const firstChar = prefix[0];

  const singleCharPrefixes: Record<string, string> = {
    H: "dtdc",
    D: "dtdc",
    C: "india-post",
  };

  const twoCharPrefixes: Record<string, string> = {
    "19": "shree-anjani-courier",
    "16": "amazon-india",
    "34": "amazon-india",
    "36": "amazon-india",
    "35": "shree-tirupati-courier",
    "24": "shree-maruti-courier",
    "25": "shree-maruti-courier",
    "43": "shree-mahavir-courier",
    SF: "shadowfax",
  };

  if (singleCharPrefixes[firstChar]) {
    return singleCharPrefixes[firstChar];
  }

  if (twoCharPrefixes[prefix]) {
    return twoCharPrefixes[prefix];
  }

  return null;
}
