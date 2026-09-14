import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ShieldCheck, LayoutGrid, Map as MapIcon, MapPin } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProviderCard } from "@/components/ProviderCard";
import { ProvidersMap } from "@/components/ProvidersMap";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { useIsland } from "@/context/IslandContext";

export default function Directory() {
  const [params, setParams] = useSearchParams();
  const { island } = useIsland();
  const [q, setQ] = useState(params.get("q") || "");
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [category, setCategory] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [inNetwork, setInNetwork] = useState(false);
  const [sort, setSort] = useState("relevant");
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/categories", { params: { type: "category" } }).then((r) => setCategories(r.data)).catch(() => {});
    api.get("/categories", { params: { type: "specialty" } }).then((r) => setSpecialties(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = {};
    if (q) p.q = q;
    if (island && island !== "All Islands") p.island = island;
    if (category !== "all") p.category = category;
    if (specialty !== "all") p.specialty = specialty;
    if (inNetwork) p.in_network = true;
    p.sort = sort;
    const t = setTimeout(() => {
      api.get("/providers", { params: p }).then((r) => setProviders(r.data)).catch(() => setProviders([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, island, category, specialty, inNetwork, sort]);

  return (
    <Layout>
      <section className="hl-navy-gradient py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">Find Healthcare</h1>
          <p className="text-slate-300 mt-2">Browse trusted providers and services across the Caribbean.</p>
          {island !== "All Islands" && (
            <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hl-glass text-sm font-medium text-[#D4AF37]" data-testid="directory-island-note">
              <MapPin size={14} /> Showing: {island}
            </span>
          )}
          <div className="mt-6 flex items-center gap-2 p-2 rounded-2xl hl-glass max-w-2xl">
            <Search size={18} className="text-[#E89D93] ml-2" />
            <input
              data-testid="directory-search-input"
              value={q}
              onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }}
              placeholder="Search providers, specialties..."
              className="flex-1 bg-transparent text-white placeholder:text-slate-400 py-2 outline-none text-sm"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        {/* FILTERS */}
        <aside className="space-y-5" data-testid="directory-filters">
          <div className="hl-card p-5">
            <h3 className="font-display font-bold text-[#0F172A] flex items-center gap-2 mb-4">
              <SlidersHorizontal size={16} className="text-[#E89D93]" /> Filters
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="filter-category"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Specialty</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger data-testid="filter-specialty"><SelectValue placeholder="All specialties" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All specialties</SelectItem>
                    {specialties.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#FAF7F2] px-3 py-2.5">
                <Label htmlFor="innet" className="cursor-pointer text-sm flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-500" /> In-Network only</Label>
                <Switch id="innet" data-testid="filter-in-network" checked={inNetwork} onCheckedChange={setInNetwork} />
              </div>
            </div>
          </div>
        </aside>

        {/* RESULTS */}
        <div>
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground" data-testid="results-count">
              {loading ? "Searching..." : `${providers.length} provider${providers.length !== 1 ? "s" : ""} found`}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex bg-[#FAF7F2] rounded-lg p-1 border border-[#E89D93]/15">
                <button onClick={() => setView("list")} data-testid="view-list-btn" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "list" ? "bg-[#0B132B] text-white" : "text-[#0F172A]"}`}>
                  <LayoutGrid size={15} /> List
                </button>
                <button onClick={() => setView("map")} data-testid="view-map-btn" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "map" ? "bg-[#0B132B] text-white" : "text-[#0F172A]"}`}>
                  <MapIcon size={15} /> Map
                </button>
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-40" data-testid="sort-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevant">Most relevant</SelectItem>
                  <SelectItem value="rating">Highest rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {view === "map" ? (
            providers.length ? (
              <ProvidersMap providers={providers} island={island} />
            ) : !loading && (
              <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
                <MapIcon size={30} className="mx-auto text-[#E89D93]/60" />
                <p className="mt-3 text-muted-foreground">No providers to map for this selection.</p>
              </div>
            )
          ) : providers.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {providers.map((p, i) => <ProviderCard key={p.id} provider={p} index={i} />)}
            </div>
          ) : !loading && (
            <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
              <Search size={30} className="mx-auto text-[#E89D93]/60" />
              <p className="mt-3 text-muted-foreground">No providers match your search.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
