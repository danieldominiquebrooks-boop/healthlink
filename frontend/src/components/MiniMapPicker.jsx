import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { pinIcon } from "@/components/ProvidersMap";

function ClickCatcher({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function Recenter({ pos }) {
  const map = useMap();
  if (pos) map.setView(pos, Math.max(map.getZoom(), 12));
  return null;
}

export function MiniMapPicker({ form, setField }) {
  const [busy, setBusy] = useState(false);
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);
  const hasPos = !Number.isNaN(lat) && !Number.isNaN(lng);
  const pos = hasPos ? [lat, lng] : null;

  const pick = (la, ln) => {
    setField("latitude", Number(la.toFixed(6)));
    setField("longitude", Number(ln.toFixed(6)));
  };

  const findFromAddress = async () => {
    const q = [form.address, form.region, form.country].filter(Boolean).join(", ");
    if (!q) return toast.error("Enter an address, country or parish first.");
    setBusy(true);
    try {
      const { data } = await api.get("/admin/geocode", { params: { q } });
      pick(data.latitude, data.longitude);
      toast.success("Location found from address");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={findFromAddress} disabled={busy} data-testid="find-from-address-btn" className="border-[#D4AF37]/50 text-[#B8912B]">
          <Search size={14} className="mr-1.5" /> {busy ? "Locating..." : "Find from address"}
        </Button>
        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {hasPos ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "click the map to set"}</span>
      </div>
      <div className="rounded-xl overflow-hidden border border-[#E89D93]/25" style={{ height: 220 }} data-testid="mini-map-picker">
        <MapContainer center={pos || [14.6, -66.5]} zoom={pos ? 12 : 5} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          <ClickCatcher onPick={pick} />
          <Recenter pos={pos} />
          {pos && <Marker position={pos} icon={pinIcon} />}
        </MapContainer>
      </div>
    </div>
  );
}
