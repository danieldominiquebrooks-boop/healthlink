import React, { createContext, useContext, useEffect, useState } from "react";
import { Share, Plus, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const InstallContext = createContext(null);

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function InstallProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setHelpOpen(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return null;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
    return outcome;
  };

  const openHelp = () => setHelpOpen(true);
  const ios = isIOS();

  return (
    <InstallContext.Provider value={{ installed, canPrompt: !!deferred, promptInstall, openHelp, isIOS: ios }}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md" data-testid="install-modal">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone size={20} className="text-[#E89D93]" /> Install My Healthcare Link
            </DialogTitle>
            <DialogDescription>Add the app to your home screen for quick, full-screen access — no app store needed.</DialogDescription>
          </DialogHeader>
          {ios ? (
            <ol className="space-y-3 text-sm text-[#0F172A]">
              <li className="flex items-center gap-3"><Step n={1} /><span>Tap the <Share size={15} className="inline text-[#0B132B]" /> <b>Share</b> button in Safari's toolbar.</span></li>
              <li className="flex items-center gap-3"><Step n={2} /><span>Scroll down and tap <b>Add to Home Screen</b> <Plus size={14} className="inline" />.</span></li>
              <li className="flex items-center gap-3"><Step n={3} /><span>Tap <b>Add</b> — the app appears on your home screen.</span></li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm text-[#0F172A]">
              <p>On <b>Android / Chrome</b>: open the browser menu (⋮) and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>
              <p className="text-muted-foreground">On desktop Chrome/Edge, use the install icon in the address bar.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </InstallContext.Provider>
  );
}

function Step({ n }) {
  return <span className="w-6 h-6 rounded-full bg-[#FDF0EE] text-[#d47f74] flex items-center justify-center font-bold text-xs shrink-0">{n}</span>;
}

export const useInstall = () => useContext(InstallContext);
