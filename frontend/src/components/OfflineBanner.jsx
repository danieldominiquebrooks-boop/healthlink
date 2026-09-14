import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      data-testid="offline-banner"
      className="fixed top-0 inset-x-0 z-[80] bg-[#D4AF37] text-[#0B132B] text-xs sm:text-sm font-semibold text-center py-1.5 flex items-center justify-center gap-2"
    >
      <WifiOff size={15} /> You're offline — showing saved content
    </div>
  );
}
