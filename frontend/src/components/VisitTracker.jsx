import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api, { API } from "@/lib/api";

// Records a pageview per route change and the time spent on each page.
export function VisitTracker() {
  const location = useLocation();
  const current = useRef(null); // { id, start }

  const flush = () => {
    const c = current.current;
    if (c && c.id) {
      const duration = Math.round((Date.now() - c.start) / 1000);
      try {
        const blob = new Blob([JSON.stringify({ visit_id: c.id, duration })], { type: "application/json" });
        navigator.sendBeacon(`${API}/track/duration`, blob);
      } catch (e) { /* ignore */ }
      current.current = null;
    }
  };

  useEffect(() => {
    let sid = localStorage.getItem("hl_sid");
    if (!sid) {
      sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("hl_sid", sid);
    }
    flush(); // finalize the previous page's duration
    api.post("/track", { session_id: sid, path: location.pathname + location.search, referrer: document.referrer })
      .then((r) => { current.current = { id: r.data.visit_id, start: Date.now() }; })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
