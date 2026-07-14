export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculates the distance between two coordinates in kilometers using the Haversine formula.
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLng = deg2rad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1.lat)) *
      Math.cos(deg2rad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

/**
 * Continuously tracks the device's live position (used while a turn-by-turn
 * session is active). Returns an unsubscribe function — always call it when
 * navigation mode ends or the component unmounts, or the GPS will keep
 * polling in the background.
 */
export function watchUserPosition(
  onUpdate: (coords: Coordinates) => void,
  onError?: (error: GeolocationPositionError | Error) => void
): () => void {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation is not supported by your browser'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({ lat: position.coords.latitude, lng: position.coords.longitude });
    },
    (error) => onError?.(error),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export function getGoogleMapsDirectionsUrl(destination: Coordinates, origin?: Coordinates): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });

  if (origin) {
    params.set('origin', `${origin.lat},${origin.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openGoogleMapsDirections(destination: Coordinates, origin?: Coordinates) {
  window.open(getGoogleMapsDirectionsUrl(destination, origin), '_blank', 'noopener,noreferrer');
}

// ---------------------------------------------------------------------------
// Turn-by-turn routing (Mapbox, with an automatic OSRM fallback)
// ---------------------------------------------------------------------------

/**
 * Mapbox access token. Your bundler determines how env vars are exposed
 * (Vite uses `import.meta.env.VITE_MAPBOX_TOKEN`, Create React App uses
 * `process.env.REACT_APP_MAPBOX_TOKEN`). Rather than guess and risk a build
 * error, call this once at app startup, e.g. in your main.tsx / index.tsx:
 *
 *   import { setMapboxToken } from './lib/locationUtils';
 *   setMapboxToken(import.meta.env.VITE_MAPBOX_TOKEN); // Vite
 *   // or: setMapboxToken(process.env.REACT_APP_MAPBOX_TOKEN); // CRA
 *
 * If no token is set, routing automatically falls back to the free OSRM
 * demo server (same one you were already using) so nothing breaks — you'll
 * just be on the lower-quality/rate-limited free tier until you add a token.
 */
let MAPBOX_TOKEN = '';
export function setMapboxToken(token: string | undefined | null) {
  MAPBOX_TOKEN = token || '';
}

export type RouteProfile = 'driving' | 'walking' | 'cycling';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType?: string;
  modifier?: string;
  location: Coordinates;
}

export interface Route {
  geometry: Coordinates[];
  steps: RouteStep[];
  distanceKm: number;
  durationMinutes: number;
  source: 'mapbox' | 'osrm' | 'straight-line';
}

export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

/**
 * "4 min" for short trips, "1 hr 20 min" once you cross an hour — matches
 * how Google/Apple Maps format ETAs.
 */
export function formatDurationMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return '';
  const rounded = Math.max(1, Math.round(totalMinutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * Distance-to-maneuver thresholds (in meters, descending) at which to speak
 * a progressive countdown — "in 2 km, turn right" → "in 500 m, turn right"
 * → "turn right now". Shorter for walking since everything is closer at
 * foot-speed and a 1km warning would be meaningless.
 */
export function getAnnouncementThresholdsMeters(profile: RouteProfile): number[] {
  if (profile === 'walking') return [400, 150, 50];
  if (profile === 'cycling') return [700, 250, 80];
  return [2000, 1000, 400, 150]; // driving
}

/** Average speed used only for the last-resort straight-line fallback below. */
const PROFILE_FALLBACK_SPEED_KMH: Record<RouteProfile, number> = {
  driving: 30,
  cycling: 15,
  walking: 4.5,
};

/**
 * Fetches a route with turn-by-turn steps between two points for the given
 * travel profile. Uses Mapbox Directions when a token is configured,
 * otherwise falls back to the public OSRM demo server (driving only — OSRM's
 * free demo server doesn't reliably serve walking/cycling), and as a last
 * resort falls back to a straight line with an estimated duration so
 * navigation never fully breaks even with no network/provider available.
 */
export async function getRoute(
  origin: Coordinates,
  destination: Coordinates,
  profile: RouteProfile = 'driving'
): Promise<Route> {
  if (MAPBOX_TOKEN) {
    try {
      return await getMapboxRoute(origin, destination, profile);
    } catch (error) {
      console.error('Mapbox routing failed, falling back to OSRM:', error);
    }
  }
  try {
    return await getOsrmRoute(origin, destination, profile);
  } catch (error) {
    console.error('OSRM routing failed, falling back to a straight line:', error);
  }
  return getStraightLineRoute(origin, destination, profile);
}

async function getMapboxRoute(origin: Coordinates, destination: Coordinates, profile: RouteProfile): Promise<Route> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&steps=true&banner_instructions=true&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox Directions returned ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error('No route found');

  const geometry: Coordinates[] = (route.geometry?.coordinates || []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  const steps: RouteStep[] = (route.legs?.[0]?.steps || []).map((step: any) => ({
    instruction: step?.maneuver?.instruction || formatOsrmInstruction(step),
    distanceMeters: step.distance ?? 0,
    durationSeconds: step.duration ?? 0,
    maneuverType: step.maneuver?.type,
    modifier: step.maneuver?.modifier,
    location: {
      lat: step.maneuver?.location?.[1],
      lng: step.maneuver?.location?.[0],
    },
  }));

  return {
    geometry,
    steps,
    distanceKm: route.distance / 1000,
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    source: 'mapbox',
  };
}

async function getOsrmRoute(origin: Coordinates, destination: Coordinates, profile: RouteProfile): Promise<Route> {
  // The public OSRM demo server only reliably hosts a car ("driving") profile.
  // Walking/cycling here will still return a drivable-road route rather than
  // a proper footpath/bike route — that's the tradeoff of the free fallback.
  if (profile !== 'driving') {
    console.warn(`OSRM demo server has no ${profile} profile — using driving roads as an approximation. Add a Mapbox token for real ${profile} routing.`);
  }
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing service returned ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error('No route found');

  const geometry: Coordinates[] = (route.geometry?.coordinates || []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  const steps: RouteStep[] = (route.legs?.[0]?.steps || []).map((step: any) => ({
    instruction: formatOsrmInstruction(step),
    distanceMeters: step.distance ?? 0,
    durationSeconds: step.duration ?? 0,
    maneuverType: step.maneuver?.type,
    modifier: step.maneuver?.modifier,
    location: {
      lat: step.maneuver?.location?.[1],
      lng: step.maneuver?.location?.[0],
    },
  }));

  return {
    geometry,
    steps,
    distanceKm: route.distance / 1000,
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    source: 'osrm',
  };
}

function formatOsrmInstruction(step: any): string {
  const type = step?.maneuver?.type || '';
  const modifier = step?.maneuver?.modifier;
  const name = step?.name || '';

  if (type === 'depart') {
    return `Head ${modifier ? modifier + ' ' : ''}${name || 'onto the road'}`.trim();
  }
  if (type === 'turn' || type === 'new name') {
    return `Turn ${modifier || ''}${name ? ` onto ${name}` : ''}`.trim();
  }
  if (type === 'arrive') {
    return 'You are arriving at your destination';
  }
  if (type === 'roundabout') {
    return `Enter the roundabout${step?.maneuver?.exit ? ` and take exit ${step.maneuver.exit}` : ''}${name ? ` onto ${name}` : ''}`.trim();
  }
  return `${type ? `${type} ${modifier || ''}` : 'Continue'}${name ? ` onto ${name}` : ''}`.trim();
}

function getStraightLineRoute(origin: Coordinates, destination: Coordinates, profile: RouteProfile): Route {
  const distanceKm = calculateDistance(origin, destination);
  const speedKmh = PROFILE_FALLBACK_SPEED_KMH[profile];
  return {
    geometry: [origin, destination],
    steps: [
      {
        instruction: `Head toward your destination (${profile})`,
        distanceMeters: distanceKm * 1000,
        durationSeconds: (distanceKm / speedKmh) * 3600,
        location: origin,
      },
      {
        instruction: 'You are arriving at your destination',
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverType: 'arrive',
        location: destination,
      },
    ],
    distanceKm,
    durationMinutes: Math.max(1, Math.round((distanceKm / speedKmh) * 60)),
    source: 'straight-line',
  };
}

/**
 * Perpendicular distance in meters from a point to the nearest segment of a
 * route line. Used to detect when the user has drifted off the planned
 * route and a reroute should be triggered.
 */
export function distanceToRouteMeters(point: Coordinates, geometry: Coordinates[]): number {
  if (geometry.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const d = distanceToSegmentMeters(point, geometry[i], geometry[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

function distanceToSegmentMeters(p: Coordinates, a: Coordinates, b: Coordinates): number {
  // Equirectangular projection — accurate enough for short segments (city-scale routing).
  const latRef = deg2rad((a.lat + b.lat) / 2);
  const toXY = (c: Coordinates) => ({
    x: c.lng * Math.cos(latRef) * 111320,
    y: c.lat * 110540,
  });
  const P = toXY(p);
  const A = toXY(a);
  const B = toXY(b);
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const APx = P.x - A.x;
  const APy = P.y - A.y;
  const abLenSq = ABx * ABx + ABy * ABy;
  let t = abLenSq === 0 ? 0 : (APx * ABx + APy * ABy) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = A.x + ABx * t;
  const closestY = A.y + ABy * t;
  const dx = P.x - closestX;
  const dy = P.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Geocoding (used by the photo-location fallback: text/landmark -> coordinates)
// ---------------------------------------------------------------------------

/**
 * Resolves free text (a shop name, street name, or landmark description) to
 * coordinates using Mapbox Geocoding. Returns null if nothing is found or
 * no Mapbox token is configured — callers should treat null as "ask the
 * user for their location instead," not as an error to retry.
 */
export async function geocodeText(query: string, proximity?: Coordinates): Promise<Coordinates | null> {
  if (!MAPBOX_TOKEN) {
    console.warn('geocodeText requires a Mapbox token — call setMapboxToken() first.');
    return null;
  }
  if (!query.trim()) return null;

  const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: '1' });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.center) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch (error) {
    console.error('geocodeText failed:', error);
    return null;
  }
}