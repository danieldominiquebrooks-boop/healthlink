import React, { createContext, useContext, useState, useEffect } from "react";
import { ALL_COUNTRIES, ALL_REGIONS, COUNTRIES } from "@/lib/constants";

const LocationContext = createContext(null);

// ISO country code -> our Caribbean country names (constants.js COUNTRIES keys)
const CARIB_ISO = {
  BB: "Barbados", JM: "Jamaica", TT: "Trinidad & Tobago", LC: "Saint Lucia",
  BS: "Bahamas", KY: "Cayman Islands", GD: "Grenada", AG: "Antigua & Barbuda",
  DM: "Dominica", VC: "Saint Vincent & the Grenadines", KN: "Saint Kitts & Nevis",
  GY: "Guyana",
};

// Detect the visitor's location client-side. The app server sits behind a proxy,
// so IP lookups must run from the browser to see the real visitor IP.
async function detectGeo() {
  try {
    const r = await fetch("https://ipwho.is/");
    const d = await r.json();
    if (d && d.success !== false && d.country_code) {
      return { code: d.country_code, region: d.region || "", city: d.city || "" };
    }
  } catch { /* try next */ }
  try {
    const r = await fetch("https://ipapi.co/json/");
    const d = await r.json();
    if (d && d.country_code) return { code: d.country_code, region: d.region || "", city: d.city || "" };
  } catch { /* give up */ }
  return null;
}

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

  // Default the country/parish from the visitor's geolocation.
  // Falls back to "All Countries" when not in a supported Caribbean country.
  useEffect(() => {
    let cancelled = false;
    const apply = (resolved) => {
      if (cancelled || !resolved || !resolved.country || !COUNTRIES[resolved.country]) return;
      setCountryState(resolved.country);
      setRegion(resolved.region || ALL_REGIONS);
    };

    const cached = sessionStorage.getItem("hl_geo");
    if (cached) {
      try { apply(JSON.parse(cached)); } catch { /* ignore */ }
      return;
    }

    // Optional override for testing/demo: /?geo=JM forces a country code.
    const override = new URLSearchParams(window.location.search).get("geo");
    if (override) {
      const country = CARIB_ISO[override.toUpperCase()] || "";
      const resolved = country ? { country, region: ALL_REGIONS } : { country: "", region: "" };
      sessionStorage.setItem("hl_geo", JSON.stringify(resolved));
      apply(resolved);
      return;
    }

    detectGeo().then((geo) => {
      if (cancelled) return;
      const country = geo ? CARIB_ISO[(geo.code || "").toUpperCase()] || "" : "";
      const resolved = country
        ? { country, region: matchRegion(country, geo) }
        : { country: "", region: "" };
      sessionStorage.setItem("hl_geo", JSON.stringify(resolved));
      apply(resolved);
    });

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
