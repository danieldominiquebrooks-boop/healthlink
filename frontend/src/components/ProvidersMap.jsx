import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";

export const ISLAND_COORDS = {
  "Barbados": [13.19, -59.54],
  "Jamaica": [18.11, -77.30],
  "Trinidad & Tobago": [10.69, -61.22],
  "Saint Lucia": [13.91, -60.98],
  "Bahamas": [25.03, -77.40],
  "Cayman Islands": [19.31, -81.25],
  "Grenada": [12.12, -61.68],
  "Antigua & Barbuda": [17.06, -61.80],
  "Dominica": [15.41, -61.37],
  "Saint Vincent & the Grenadines": [13.25, -61.20],
  "Saint Kitts & Nevis": [17.36, -62.78],
  "Guyana": [6.80, -58.16],
};

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#E89D93,#D4AF37);box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(45deg);color:#0B132B;font-weight:800;font-size:14px;line-height:1;">+</div>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});

function coordsFor(p) {
  const lat = parseFloat(p.latitude);
  const lng = parseFloat(p.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function directionsHref(p) {
  const lat = parseFloat(p.latitude);
  const lng = parseFloat(p.longitude);
  let dest;
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    dest = `${lat},${lng}`;
  } else {
    const addr = [p.name, p.address, p.region, p.country].filter(Boolean).join(", ");
    dest = encodeURIComponent(addr || p.country || "");
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function ProvidersMap({ providers, country }) {
  const points = providers.map((p) => ({ p, pos: coordsFor(p) })).filter((x) => x.pos);
  const unmapped = providers.length - points.length;

  // Center/zoom on the actual mapped pins so tags sit at their real addresses.
  let center;
  let zoom;
  if (points.length > 0) {
    const lats = points.map((x) => x.pos[0]);
    const lngs = points.map((x) => x.pos[1]);
    center = [lats.reduce((a, b) => a + b, 0) / lats.length, lngs.reduce((a, b) => a + b, 0) / lngs.length];
    const spread = Math.max(...lats) - Math.min(...lats), spreadLng = Math.max(...lngs) - Math.min(...lngs);
    const span = Math.max(spread, spreadLng);
    zoom = span > 8 ? 4 : span > 3 ? 6 : span > 1 ? 8 : span > 0.1 ? 11 : 13;
  } else {
    center = ISLAND_COORDS[country] || [14.6, -66.5];
    zoom = ISLAND_COORDS[country] ? 9 : 5;
  }

  return (
    <div className="relative z-0 rounded-2xl overflow-hidden border border-[#E89D93]/20" data-testid="providers-map">
      {unmapped > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full bg-[#0B132B]/90 text-white text-xs font-medium shadow-lg" data-testid="map-unmapped-note">
          {points.length} mapped · {unmapped} need coordinates
        </div>
      )}
      {points.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
          <div className="px-4 py-2 rounded-xl bg-white/95 text-[#0B132B] text-sm font-medium shadow" data-testid="map-empty-note">
            No providers have map coordinates yet. Add latitude &amp; longitude in the admin dashboard to place them accurately.
          </div>
        </div>
      )}
      <MapContainer key={`${country}-${points.length}-${center[0].toFixed(2)}-${center[1].toFixed(2)}`} center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: "68vh", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {points.map(({ p, pos }) => (
          <Marker key={p.id} position={pos} icon={pinIcon}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-bold text-[#0F172A] !m-0">{p.name}</p>
                <p className="text-[#E89D93] font-semibold !mt-0.5 !mb-1 text-xs">{p.specialty}</p>
                <p className="text-slate-500 text-xs !m-0">{[p.address, p.region, p.country].filter(Boolean).join(", ")}</p>
                <div className="flex flex-col gap-0.5 mt-1">
                  <Link to={`/provider/${p.id}`} className="text-[#B8912B] font-semibold text-xs underline">View profile →</Link>
                  <a href={directionsHref(p)} target="_blank" rel="noreferrer" className="text-[#E89D93] font-semibold text-xs underline">Get directions →</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
