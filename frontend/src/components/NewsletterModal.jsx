import React, { useEffect, useState } from "react";
import { Mail, BellRing } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

// Shown on Blog / Events every visit until the visitor subscribes.
export function NewsletterModal({ context = "updates" }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("hl_subscribed")) return;
    let timer;
    // Quiz popup takes priority: if an active quiz exists and isn't completed, skip the newsletter popup.
    api.get("/quiz/active").then((r) => {
      const q = r.data;
      if (q && q.id && !localStorage.getItem(`hl_quiz_done_${q.id}`) && !sessionStorage.getItem("hl_quiz_dismissed")) return;
      timer = setTimeout(() => setOpen(true), 1400);
    }).catch(() => {
      timer = setTimeout(() => setOpen(true), 1400);
    });
    return () => timer && clearTimeout(timer);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/subscribe", { email: email.trim().toLowerCase() });
      localStorage.setItem("hl_subscribed", "1");
      toast.success(data.message || "You're subscribed!");
      setOpen(false);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" data-testid="newsletter-modal">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <span className="w-12 h-12 rounded-2xl bg-[#FDF0EE] flex items-center justify-center text-[#E89D93]"><BellRing size={24} /></span>
          </div>
          <DialogTitle className="font-display text-center text-xl">Stay in the loop</DialogTitle>
          <DialogDescription className="text-center">
            Join our mailing list and get notified whenever we publish a new {context === "events" ? "event" : context === "articles" ? "health article" : "article or event"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-1">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E89D93]" />
            <Input data-testid="newsletter-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-11" />
          </div>
          <Button type="submit" disabled={loading} data-testid="newsletter-subscribe-btn" className="w-full bg-[#0B132B] hover:bg-[#1C2541] text-white h-11">
            {loading ? "Subscribing..." : "Notify me"}
          </Button>
          <DialogFooter className="sm:justify-center">
            <button type="button" onClick={() => setOpen(false)} data-testid="newsletter-dismiss-btn" className="text-xs text-muted-foreground hover:text-[#0F172A]">No thanks, maybe later</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
