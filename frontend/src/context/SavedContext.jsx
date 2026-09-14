import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const SavedContext = createContext(null);
const KEY = "hl_saved";

export function SavedProvider({ children }) {
  const [ids, setIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids]);

  const toggle = useCallback((id) => {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);

  const isSaved = useCallback((id) => ids.includes(id), [ids]);

  return (
    <SavedContext.Provider value={{ ids, toggle, isSaved, count: ids.length }}>
      {children}
    </SavedContext.Provider>
  );
}

export const useSaved = () => useContext(SavedContext);
