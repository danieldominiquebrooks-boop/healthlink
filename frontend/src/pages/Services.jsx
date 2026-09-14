import React, { useEffect, useState } from "react";
import { Activity, HeartPulse, Stethoscope, Microscope, Video, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useIsland } from "@/context/IslandContext";

const ICONS = { activity: Activity, heart: HeartPulse, stethoscope: Stethoscope, microscope: Microscope, video: Video };

export default function Services() {
  const { island } = useIsland();
  const [services, setServices] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (island && island !== "All Islands") p.island = island;
    const t = setTimeout(() => api.get("/services", { params: p }).then((r) => setServices(r.data)).catch(() => setServices([])), 200);
    return () => clearTimeout(t);
  }, [q, island]);

  return (
    <Layout>
      <PageHero title="Healthcare Services" subtitle="Explore available services and care categories across the Caribbean." testid="services-hero" note={island !== "All Islands" ? island : null} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative max-w-md mb-8">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E89D93]" />
          <Input data-testid="services-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services..." className="pl-10" />
        </div>
        {services.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => {
              const Icon = ICONS[s.icon] || Activity;
              return (
                <div key={s.id} className="hl-card p-6" data-testid={`service-card-${i}`}>
                  <span className="w-12 h-12 rounded-xl bg-[#FDF0EE] flex items-center justify-center text-[#E89D93] mb-4"><Icon size={22} /></span>
                  <h3 className="font-display font-bold text-[#0F172A]">{s.name}</h3>
                  {s.category && <span className="text-xs text-[#B8912B] font-semibold">{s.category}</span>}
                  <p className="text-sm text-muted-foreground mt-2">{s.description}</p>
                  {s.island && <p className="text-xs text-muted-foreground mt-3">{s.island}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
            <Activity size={30} className="mx-auto text-[#E89D93]/60" />
            <p className="mt-3 text-muted-foreground">No services available yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
