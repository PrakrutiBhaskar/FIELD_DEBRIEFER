// lib/district-centroids.ts
//
// Approximate centroid coordinates for Karnataka's 31 districts.
// Used to place map pins when a precise location lat/lng isn't available —
// visits are grouped and pinned at their district's centroid rather than
// an exact address. Good enough for a "where is activity happening"
// overview; not meant for precise navigation.
//
// Coordinates are approximate district-center points (WGS84).

export type LatLng = { lat: number; lng: number }

export const KARNATAKA_DISTRICT_CENTROIDS: Record<string, LatLng> = {
  'Bagalkot':            { lat: 16.1691, lng: 75.6636 },
  'Ballari':             { lat: 15.1394, lng: 76.9214 },
  'Bellary':             { lat: 15.1394, lng: 76.9214 }, // alias
  'Belagavi':            { lat: 15.8497, lng: 74.4977 },
  'Belgaum':             { lat: 15.8497, lng: 74.4977 }, // alias
  'Bengaluru Rural':     { lat: 13.2846, lng: 77.5881 },
  'Bengaluru Urban':     { lat: 12.9716, lng: 77.5946 },
  'Bangalore Rural':     { lat: 13.2846, lng: 77.5881 }, // alias
  'Bangalore Urban':     { lat: 12.9716, lng: 77.5946 }, // alias
  'Bangalore':           { lat: 12.9716, lng: 77.5946 }, // alias
  'Bidar':               { lat: 17.9133, lng: 77.5301 },
  'Chamarajanagar':      { lat: 11.9236, lng: 76.9456 },
  'Chikkaballapur':      { lat: 13.4355, lng: 77.7315 },
  'Chikkamagaluru':      { lat: 13.3161, lng: 75.7720 },
  'Chikmagalur':         { lat: 13.3161, lng: 75.7720 }, // alias
  'Chitradurga':         { lat: 14.2251, lng: 76.3980 },
  'Dakshina Kannada':    { lat: 12.8438, lng: 75.2479 },
  'Davanagere':          { lat: 14.4644, lng: 75.9932 },
  'Dharwad':             { lat: 15.4589, lng: 75.0078 },
  'Gadag':               { lat: 15.4297, lng: 75.6346 },
  'Hassan':              { lat: 13.0072, lng: 76.0962 },
  'Haveri':              { lat: 14.7951, lng: 75.4046 },
  'Kalaburagi':          { lat: 17.3297, lng: 76.8343 },
  'Gulbarga':            { lat: 17.3297, lng: 76.8343 }, // alias
  'Kodagu':              { lat: 12.4244, lng: 75.7382 },
  'Kolar':               { lat: 13.1367, lng: 78.1297 },
  'Koppal':              { lat: 15.3547, lng: 76.1547 },
  'Mandya':              { lat: 12.5242, lng: 76.8958 },
  'Mysuru':              { lat: 12.2958, lng: 76.6394 },
  'Mysore':              { lat: 12.2958, lng: 76.6394 }, // alias
  'Raichur':             { lat: 16.2076, lng: 77.3463 },
  'Ramanagara':          { lat: 12.7217, lng: 77.2812 },
  'Shivamogga':          { lat: 13.9299, lng: 75.5681 },
  'Shimoga':             { lat: 13.9299, lng: 75.5681 }, // alias
  'Tumakuru':            { lat: 13.3392, lng: 77.1140 },
  'Tumkur':              { lat: 13.3392, lng: 77.1140 }, // alias
  'Udupi':               { lat: 13.3409, lng: 74.7421 },
  'Uttara Kannada':      { lat: 14.7935, lng: 74.6985 },
  'Vijayapura':          { lat: 16.8302, lng: 75.7100 },
  'Bijapur':             { lat: 16.8302, lng: 75.7100 }, // alias
  'Vijayanagara':        { lat: 15.3300, lng: 76.4600 },
  'Yadgir':              { lat: 16.7700, lng: 77.1376 },
}

// Karnataka's approximate geographic center — used as a last-resort
// fallback when a district name doesn't match anything above.
export const KARNATAKA_FALLBACK_CENTROID: LatLng = { lat: 14.5204, lng: 75.7224 }

/**
 * Resolve a district name to a centroid, with light normalisation
 * (trim + case-insensitive match) since officer-entered district
 * names may vary in casing.
 */
export function getDistrictCentroid(district: string | null | undefined): LatLng {
  if (!district) return KARNATAKA_FALLBACK_CENTROID

  const trimmed = district.trim()
  if (KARNATAKA_DISTRICT_CENTROIDS[trimmed]) return KARNATAKA_DISTRICT_CENTROIDS[trimmed]

  const lower = trimmed.toLowerCase()
  const match = Object.keys(KARNATAKA_DISTRICT_CENTROIDS).find(
    key => key.toLowerCase() === lower
  )
  return match ? KARNATAKA_DISTRICT_CENTROIDS[match] : KARNATAKA_FALLBACK_CENTROID
}

/**
 * Deterministic small offset so multiple visits in the same district
 * don't render as a single overlapping pin. Spreads pins in a tight
 * radius around the centroid based on a hash of the visit id.
 */
export function jitterCentroid(centroid: LatLng, seed: string): LatLng {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180)
  const radiusDeg = 0.04 + (Math.abs(hash >> 8) % 100) / 100 * 0.06 // ~4-10km spread
  return {
    lat: centroid.lat + Math.cos(angle) * radiusDeg,
    lng: centroid.lng + Math.sin(angle) * radiusDeg,
  }
}