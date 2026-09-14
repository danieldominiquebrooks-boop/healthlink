import React, { createContext, useContext, useState } from "react";

const IslandContext = createContext(null);

export function IslandProvider({ children }) {
  const [island, setIsland] = useState("All Islands");
  return (
    <IslandContext.Provider value={{ island, setIsland }}>
      {children}
    </IslandContext.Provider>
  );
}

export const useIsland = () => useContext(IslandContext);
