import React, { createContext, useContext, useState, useEffect } from "react";
import { ALL_COUNTRIES, ALL_REGIONS, COUNTRIES } from "@/lib/constants";
import api from "@/lib/api";

const LocationContext = createContext(null);

function matchRegion(countryName, geo) {
  const regions = COUNTRIES[countryName] || [];
  const gr = (geo.region || "").toLowerCase().trim();
  const gc = (geo.city || "").toLowerCase().trim();
  const hit = regions.find((r) => {
    const rl = r.toLowerCase();
    if (gr && (rl === gr || rl.includes(gr) || gr.includes(rl))) return true;
    if (gc && (rl === gc || rl.includes(gc) || gc.includes(rl))) return true;
    return false;
  });
  return hit || ALL_REGIONS;
}

export function LocationProvider({ children }) {
  const [country, setCountryState] = useState(ALL_COUNTRIES);
  const [region, setRegion] = useState(ALL_REGIONS);

  // Default the country/parish from the visitor's geolocation (via backend IP lookup).
  // Falls back to "All Countries" when the visitor is not in a supported Caribbean country.
  useEffect(() => {
    let cancelled = false;
    const applyGeo = (g) => {
      if (cancelled || !g || !g.country || !COUNTRIES[g.country]) return;
      setCountryState(g.country);
      setRegion(matchRegion(g.country, g));
    };
    const cached = sessionStorage.getItem("hl_geo");
    if (cached) {
      try { applyGeo(JSON.parse(cached)); } catch { /* ignore */ }
      return;
    }
    api.get("/geo/detect")
      .then((r) => {
        sessionStorage.setItem("hl_geo", JSON.stringify(r.data || {}));
        applyGeo(r.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Changing country resets the parish/island selection.
  const setCountry = (c) => {
    setCountryState(c);
    setRegion(ALL_REGIONS);
  };

  return (
    <LocationContext.Provider value={{ country, setCountry, region, setRegion }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => useContext(LocationContext);
