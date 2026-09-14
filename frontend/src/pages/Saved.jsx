import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { ProviderCard } from "@/components/ProviderCard";
import { Button } from "@/components/ui/button";
import { useSaved } from "@/context/SavedContext";
import api from "@/lib/api";

export default function Saved() {
  const { ids } = useSaved();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!ids.length) { setProviders([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(
      ids.map((id) => api.get(`/providers/${id}`).then((r) => r.data).catch(() => null))
    ).then((list) => {
      if (active) { setProviders(list.filter(Boolean)); setLoading(false); }
    });
    return () => { active = false; };
  }, [ids]);

  return (
    <Layout>
      <PageHero title="Saved Providers" subtitle="Your shortlisted healthcare providers, saved on this device for easy access." testid="saved-hero" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <p className="text-muted-foreground py-10 text-center">Loading...</p>
        ) : providers.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="saved-grid">
            {providers.map((p, i) => <ProviderCard key={p.id} provider={p} index={i} />)}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
            <Heart size={30} className="mx-auto text-[#E89D93]/60" />
            <p className="mt-3 text-muted-foreground">You haven't saved any providers yet.</p>
            <Link to="/directory">
              <Button className="mt-5 bg-[#E89D93] hover:bg-[#e08b80] text-white">Browse the directory</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
