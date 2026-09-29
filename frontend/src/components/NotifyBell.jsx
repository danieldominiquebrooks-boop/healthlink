import React, { useEffect, useState } from "react";
import { Bell, BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { pushSupported, getPushState, enablePush, disablePush } from "@/lib/push";

export function NotifyBell({ dark, variant = "desktop" }) {
  const [state, setState] = useState("unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    getPushState().then(setState);
  }, []);

  if (state === "unsupported") return null;

  const toggle = async () => {
    if (busy) return;
    if (state === "denied") {
      toast.error("Notifications are blocked. Enable them in your browser settings for this site.");
      return;
    }
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        toast.success("Notifications turned off.");
      } else {
        await enablePush();
        setState("on");
        toast.success("You'll be notified about new articles and events.");
      }
    } catch (e) {
      if (e.message === "denied") {
        setState("denied");
        toast.error("Notifications are blocked. Enable them in your browser settings.");
      } else {
        toast.error("Couldn't update notifications. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  const Icon = state === "denied" ? BellOff : on ? BellRing : Bell;

  if (variant === "mobile") {
    const navInactive = dark
      ? "text-slate-200 hover:text-white hover:bg-white/5"
      : "text-slate-600 hover:text-[#0F172A] hover:bg-black/[0.04]";
    return (
      <button
        onClick={toggle}
        disabled={busy}
        data-testid="notify-bell-mobile"
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${navInactive}`}
      >
        <Icon size={15} className={on ? "text-[#D4AF37]" : ""} />
        {on ? "Notifications on" : "Enable notifications"}
      </button>
    );
  }

  const iconBtn = dark
    ? "bg-white/8 border-white/10 text-slate-100 hover:border-[#D4AF37]/50"
    : "bg-black/[0.04] border-black/10 text-[#0F172A] hover:border-[#D4AF37]/60";
  return (
    <button
      onClick={toggle}
      disabled={busy}
      data-testid="notify-bell"
      title={on ? "Notifications on — tap to turn off" : "Enable notifications for new articles & events"}
      aria-label="Toggle notifications"
      className={`hidden sm:flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${iconBtn} ${on ? "!border-[#D4AF37]/60" : ""}`}
    >
      <Icon size={17} className={on ? "text-[#D4AF37]" : ""} />
    </button>
  );
}
