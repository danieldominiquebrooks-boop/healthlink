import React, { useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function InstallButton({ variant = "desktop", onNavigate }) {
  const [deferred, setDeferred] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setShowModal(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (onNavigate) onNavigate();
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } else {
      setShowModal(true);
    }
  };

  const ios = isIOS();

  return (
    <>
      {variant === "mobile" ? (
        <button
          onClick={handleClick}
          data-testid="install-app-mobile"
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#E89D93] text-white text-sm font-semibold"
        >
          <Download size={15} /> Download the app
        </button>
      ) : (
        <button
          onClick={handleClick}
          data-testid="install-app-btn"
          className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E89D93] text-white text-sm font-semibold hover:bg-[#e08b80] transition-colors"
        >
          <Download size={15} /> Get the app
        </button>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md" data-testid="install-modal">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone size={20} className="text-[#E89D93]" /> Install My Healthcare Link
            </DialogTitle>
            <DialogDescription>Add the app to your home screen for quick, full-screen access — no app store needed.</DialogDescription>
          </DialogHeader>

          {ios ? (
            <ol className="space-y-3 text-sm text-[#0F172A]">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FDF0EE] text-[#d47f74] flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <span>Tap the <Share size={15} className="inline text-[#0B132B]" /> <b>Share</b> button in Safari's toolbar.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FDF0EE] text-[#d47f74] flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <span>Scroll down and tap <b>Add to Home Screen</b> <Plus size={14} className="inline" />.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FDF0EE] text-[#d47f74] flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <span>Tap <b>Add</b> — the app appears on your home screen.</span>
              </li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm text-[#0F172A]">
              <p>On <b>Android / Chrome</b>: open the browser menu (⋮) and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>
              <p className="text-muted-foreground">If you see an install prompt, just tap it. On desktop Chrome, use the install icon in the address bar.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
