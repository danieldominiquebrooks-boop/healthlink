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

function coordsFor(p, index) {
  const lat = parseFloat(p.latitude);
  const lng = parseFloat(p.longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) return [lat, lng];
  const base = ISLAND_COORDS[p.island];
  if (!base) return null;
  const jx = ((index % 5) - 2) * 0.035;
  const jy = ((Math.floor(index / 5) % 5) - 2) * 0.035;
  return [base[0] + jy, base[1] + jx];
}

export function ProvidersMap({ providers, island }) {
  const selected = island && island !== "All Islands" && ISLAND_COORDS[island];
  const center = selected ? ISLAND_COORDS[island] : [14.6, -66.5];
  const zoom = selected ? 9 : 5;
  const points = providers.map((p, i) => ({ p, pos: coordsFor(p, i) })).filter((x) => x.pos);

  return (
    <div className="relative z-0 rounded-2xl overflow-hidden border border-[#E89D93]/20" data-testid="providers-map">
      <MapContainer key={`${island}-${providers.length}`} center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: "68vh", width: "100%" }}>
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
                <p className="text-slate-500 text-xs !m-0">{p.island}</p>
                <div className="flex flex-col gap-0.5 mt-1">
                  <Link to={`/provider/${p.id}`} className="text-[#B8912B] font-semibold text-xs underline">View profile →</Link>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${pos[0]},${pos[1]}`} target="_blank" rel="noreferrer" className="text-[#E89D93] font-semibold text-xs underline">Get directions →</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
