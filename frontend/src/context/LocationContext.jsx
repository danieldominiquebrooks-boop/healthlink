import React, { createContext, useContext, useState } from "react";
import { ALL_COUNTRIES, ALL_REGIONS } from "@/lib/constants";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [country, setCountryState] = useState(ALL_COUNTRIES);
  const [region, setRegion] = useState(ALL_REGIONS);

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
