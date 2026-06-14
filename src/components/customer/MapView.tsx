import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapPin,
  Store,
  Phone,
  Mail,
  Navigation,
  ExternalLink,
  ShoppingBag,
  ChevronRight,
  RefreshCw,
  X,
} from 'lucide-react';

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const PopupAny = Popup as any;
const CircleAny = Circle as any;
const PolylineAny = Polyline as any;
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';
import { calculateDistance, Coordinates, openGoogleMapsDirections } from '../../lib/locationUtils';

// Fix for default marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom trader icon
const traderIcon = L.divIcon({
  html: `<div class="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-2xl border-[3px] border-white ring-[6px] ring-orange-500/30 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 active:scale-95 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-store"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"/></svg>
        </div>`,
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// User location icon
const userIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/20">
          <div class="w-2 h-2 bg-white rounded-full animate-ping"></div>
        </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapRecenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom || map.getZoom());
    }
  }, [center]);
  return null;
}

function MapSizeKeeper() {
  const map = useMap();
  useEffect(() => {
    const refresh = () => map.invalidateSize();
    const container = map.getContainer();
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    const timer = window.setTimeout(refresh, 250);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
}

function MapBounds({
  points,
  fallbackCenter,
}: {
  points: Array<[number, number]>;
  fallbackCenter: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => {
      map.invalidateSize();
      if (points.length > 1) {
        map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
      } else if (points.length === 1) {
        map.flyTo(points[0], 15);
      } else {
        map.flyTo(fallbackCenter, 13);
      }
    }, 150);
  }, [fallbackCenter, map, points]);
  return null;
}

function getTraderCoordinates(trader: any): Coordinates | null {
  const lat = Number(trader?.coordinates?.lat ?? trader?.latitude ?? trader?.lat);
  const lng = Number(trader?.coordinates?.lng ?? trader?.longitude ?? trader?.lng);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }
  return null;
}

function hasValidCoordinates(trader: any) {
  return Boolean(getTraderCoordinates(trader));
}

interface MapViewProps {
  traders: any[];
  userLocation: { lat: number; lng: number } | null;
  radius?: number; // in km
  onTraderClick: (trader: any) => void;
  searchQuery?: string;
  allProducts?: any[];
}

export default function MapView({
  traders,
  userLocation,
  radius,
  onTraderClick,
  searchQuery,
  allProducts = [],
}: MapViewProps) {
  const { t } = useLanguage();
  const kigaliCenter: [number, number] = [-1.9441, 30.0619];
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : kigaliCenter;
  const mappedTraders = useMemo(() => {
    const mapped = traders.filter(hasValidCoordinates);
    if (!userLocation) return mapped;
    return [...mapped].sort((a, b) => {
      const aCoordinates = getTraderCoordinates(a);
      const bCoordinates = getTraderCoordinates(b);
      if (!aCoordinates && !bCoordinates) return 0;
      if (!aCoordinates) return 1;
      if (!bCoordinates) return -1;
      return (
        calculateDistance(userLocation, aCoordinates) -
        calculateDistance(userLocation, bCoordinates)
      );
    });
  }, [traders, userLocation]);
  const [selectedTrader, setSelectedTrader] = useState<any>(mappedTraders[0] || null);
  const [tileError, setTileError] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const mapPoints = useMemo<Array<[number, number]>>(() => {
    const traderPoints = mappedTraders
      .map(getTraderCoordinates)
      .filter(Boolean)
      .map((coordinates) => [coordinates!.lat, coordinates!.lng]) as Array<[number, number]>;
    return userLocation ? [[userLocation.lat, userLocation.lng], ...traderPoints] : traderPoints;
  }, [mappedTraders, userLocation]);

  useEffect(() => {
    if (
      !selectedTrader ||
      !mappedTraders.some(
        (trader) => (trader.id || trader.uid) === (selectedTrader.id || selectedTrader.uid)
      )
    ) {
      setSelectedTrader(mappedTraders[0] || null);
    }
  }, [mappedTraders, selectedTrader]);

  const selectedCoordinates = selectedTrader ? getTraderCoordinates(selectedTrader) : null;

  const getMatchedProducts = (traderId: string) => {
    if (!searchQuery || !allProducts.length) return [];
    const query = searchQuery.toLowerCase();
    return allProducts
      .filter(
        (p) =>
          p.traderId === traderId &&
          (p.name?.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query))
      )
      .slice(0, 2); // Show top 2 matching
  };

  return (
    <div className="h-[min(78vh,760px)] min-h-[560px] w-full rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-orange-500/20 shadow-2xl shadow-black/60 relative z-0 bg-[#111827]">
      <MapContainerAny
        center={center}
        zoom={13}
        className="h-full w-full marketplace-leaflet-map"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayerAny
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            load: () => setTilesLoaded(true),
            tileerror: () => setTileError(true),
          }}
        />

        {userLocation && (
          <>
            <MarkerAny position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <PopupAny className="custom-popup">
                <div className="p-2 font-black text-blue-500 uppercase tracking-widest text-[10px]">
                  You are here
                </div>
              </PopupAny>
            </MarkerAny>
            {radius && (
              <CircleAny
                center={[userLocation.lat, userLocation.lng]}
                radius={radius * 1000}
                pathOptions={{
                  fillColor: '#3b82f6',
                  fillOpacity: 0.1,
                  color: '#3b82f6',
                  weight: 1,
                  dashArray: '5, 10',
                }}
              />
            )}
          </>
        )}

        {mappedTraders.map((trader) => {
          const matched = getMatchedProducts(trader.id || trader.uid);
          const coordinates = getTraderCoordinates(trader);
          if (!coordinates) return null;

          return (
            <MarkerAny
              key={trader.id || trader.uid}
              position={[coordinates.lat, coordinates.lng]}
              icon={traderIcon}
              eventHandlers={{
                click: () => setSelectedTrader(trader),
              }}
            >
              <PopupAny className="custom-popup min-w-[220px]">
                <div className="p-3 space-y-3 bg-[#0a0a0a] rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/10">
                      <Store size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-orange-500/60 uppercase tracking-widest leading-none mb-1">
                        {trader.businessCategory || 'Trader'}
                      </p>
                      <h4 className="text-sm font-black text-white leading-tight truncate">
                        {trader.businessName || trader.name}
                      </h4>
                    </div>
                  </div>

                  {matched.length > 0 && (
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <ShoppingBag size={8} /> Matching Results
                      </p>
                      <div className="space-y-1">
                        {matched.map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-neutral-400 truncate mr-2">
                              {p.name}
                            </span>
                            <span className="font-black text-orange-500 shrink-0">
                              {p.price.toLocaleString()} RWF
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-bold">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">
                        {trader.businessAddress || trader.address || 'Kigali, Rwanda'}
                      </span>
                    </div>
                    {(trader.phone || trader.phoneNumber) && (
                      <a
                        href={`tel:${trader.phone || trader.phoneNumber}`}
                        className="flex items-center gap-2 text-[10px] text-orange-500 font-bold hover:underline"
                      >
                        <Phone size={12} className="shrink-0 text-neutral-600" />
                        <span>{trader.phone || trader.phoneNumber}</span>
                      </a>
                    )}
                    {coordinates && (
                      <button
                        type="button"
                        onClick={() =>
                          openGoogleMapsDirections(coordinates, userLocation || undefined)
                        }
                        className="flex items-center gap-2 text-[10px] text-blue-500 font-bold hover:underline"
                      >
                        <ExternalLink size={12} className="shrink-0 text-neutral-600" />
                        <span>Get Directions</span>
                      </button>
                    )}
                    {trader.email && (
                      <a
                        href={`mailto:${trader.email}`}
                        className="flex items-center gap-2 text-[10px] text-orange-500 font-bold hover:underline"
                      >
                        <Mail size={12} className="shrink-0 text-neutral-600" />
                        <span className="truncate">{trader.email}</span>
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTrader(trader);
                      onTraderClick(trader);
                    }}
                    className="w-full py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-900/40 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                  >
                    View Details <ChevronRight size={10} />
                  </button>
                </div>
              </PopupAny>
            </MarkerAny>
          );
        })}

        {userLocation && selectedCoordinates && (
          <PolylineAny
            positions={[
              [userLocation.lat, userLocation.lng],
              [selectedCoordinates.lat, selectedCoordinates.lng],
            ]}
            pathOptions={{
              color: '#2563eb',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 12',
            }}
          />
        )}

        <MapBounds points={mapPoints} fallbackCenter={center} />
        <MapRecenter center={center} />
        <MapSizeKeeper />
      </MapContainerAny>

      {!tilesLoaded && !tileError && (
        <div className="absolute inset-0 z-[900] pointer-events-none flex items-center justify-center bg-[#050505]/50">
          <div className="rounded-2xl bg-black/80 border border-white/10 px-5 py-4 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
            <RefreshCw className="animate-spin text-orange-500" size={16} />
            Loading map
          </div>
        </div>
      )}

      {tileError && (
        <div className="absolute inset-x-6 top-6 z-[1000] rounded-2xl bg-red-950/95 backdrop-blur p-4 border border-red-500/30 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-300 mb-1">
            Map tiles could not load
          </p>
          <p className="text-xs font-bold text-red-100/80">
            Check internet access or tile service availability. Trader locations still remain in the
            list view.
          </p>
        </div>
      )}

      {mappedTraders.length === 0 && (
        <div className="absolute left-4 right-4 top-4 z-[1000] max-w-xl rounded-2xl bg-[#0a0a0a]/90 backdrop-blur p-4 border border-white/10 shadow-2xl md:left-6 md:right-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">
            Map needs shop locations
          </p>
          <p className="text-xs font-bold text-neutral-400">
            No mapped traders match this filter yet. Use the list, QR, or merchant code while
            sellers add their precise location.
          </p>
        </div>
      )}

      {/* Map Legend/Overlay */}
      <div className="absolute right-4 top-4 z-[1000] bg-[#0a0a0a]/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3 min-w-[170px] md:right-6 md:top-6">
        <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
          {mappedTraders.length} mapped shops
        </div>
        <div className="text-[10px] font-bold text-neutral-400">
          {userLocation ? 'Centered from your location' : 'Centered on Kigali'}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a0a0a]/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3 md:bottom-6 md:left-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-orange-600 rounded-lg shadow-lg shadow-orange-600/20"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
            Traders
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-600 rounded-full shadow-lg shadow-blue-600/20"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
            Your Location
          </span>
        </div>
      </div>

      {selectedTrader &&
        (() => {
          const coordinates = getTraderCoordinates(selectedTrader);
          const distance =
            userLocation && coordinates ? calculateDistance(userLocation, coordinates) : null;
          return (
            <div className="absolute inset-x-4 bottom-4 z-[1100] md:left-auto md:right-6 md:bottom-6 md:w-[360px] rounded-3xl border border-white/10 bg-[#0a0a0a]/95 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                    Selected trader
                  </p>
                  <h3 className="mt-1 truncate text-xl font-black text-white">
                    {selectedTrader.businessName || selectedTrader.name || 'Trader'}
                  </h3>
                  <p className="mt-1 truncate text-xs font-bold text-neutral-500">
                    {selectedTrader.businessAddress ||
                      selectedTrader.address ||
                      selectedTrader.location ||
                      'Business location'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTrader(null)}
                  className="rounded-xl bg-white/5 p-2 text-neutral-500 hover:text-white"
                  aria-label="Clear selected trader"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {distance !== null && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      Distance
                    </p>
                    <p className="text-lg font-black text-white">{distance.toFixed(1)} km</p>
                  </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                    Category
                  </p>
                  <p className="truncate text-sm font-black text-white">
                    {selectedTrader.businessCategory || selectedTrader.category || 'Shop'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    coordinates && openGoogleMapsDirections(coordinates, userLocation || undefined)
                  }
                  disabled={!coordinates}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Navigation size={16} />
                  Navigate
                </button>
                {(selectedTrader.phone || selectedTrader.phoneNumber) && (
                  <a
                    href={`tel:${selectedTrader.phone || selectedTrader.phoneNumber}`}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <Phone size={16} />
                    Call
                  </a>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
