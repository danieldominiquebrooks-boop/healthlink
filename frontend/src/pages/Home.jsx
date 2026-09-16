import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Stethoscope, Activity, HeartPulse, Microscope,
  Video, Users, Calendar, MapPin, Sparkles, ShieldCheck, BookOpen,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProviderCard } from "@/components/ProviderCard";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useIsland } from "@/context/IslandContext";
import { StarRating } from "@/components/StarRating";

const HERO_BG = "https://images.unsplash.com/photo-1541417904950-b855846fe074?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

const CATEGORIES = [
  { icon: Stethoscope, label: "Doctors", q: "" },
  { icon: HeartPulse, label: "Cardiology", q: "cardiology" },
  { icon: Activity, label: "Wellness", q: "wellness" },
  { icon: Microscope, label: "Diagnostics", q: "diagnostics" },
  { icon: Video, label: "Telehealth", q: "telehealth" },
  { icon: Users, label: "All Categories", q: "" },
];

export default function Home() {
  const navigate = useNavigate();
  const { island } = useIsland();
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [events, setEvents] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ providers: 0, islands_covered: 12, articles: 0, events: 0 });

  useEffect(() => {
    const p = island && island !== "All Islands" ? { island } : {};
    api.get("/providers", { params: { featured: true, ...p, limit: 6 } }).then((r) => setProviders(r.data)).catch(() => {});
    api.get("/articles", { params: { ...p, limit: 3 } }).then((r) => setArticles(r.data)).catch(() => {});
    api.get("/events", { params: { ...p, limit: 3 } }).then((r) => setEvents(r.data)).catch(() => {});
    api.get("/reviews", { params: { limit: 6 } }).then((r) => setReviews(r.data)).catch(() => {});
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, [island]);

  const doSearch = (e) => {
    e?.preventDefault();
    navigate(`/directory?q=${encodeURIComponent(query)}`);
  };

  return (
    <Layout>
      {/* HERO */}
      <section className="relative hl-navy-gradient overflow-hidden">
        <div className="absolute inset-0 opacity-60">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#0B132B]/25" />
        </div>
        {/* readability scrim: darker on the left where the text sits */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B132B]/90 via-[#0B132B]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B132B]/85 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl">
            <LogoMark size={112} className="mb-8 hl-float" />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full hl-glass text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              <Sparkles size={13} /> Quality care, brighter tomorrows
            </span>
            <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
              Find trusted <span className="hl-gold-text">healthcare</span> <br className="hidden sm:block" />
              across the <span className="hl-blush-text">Caribbean</span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">
              Discover doctors, services, health information and events — closer to you, island by island.
            </p>

            <form onSubmit={doSearch} className="mt-8 max-w-2xl">
              <div className="flex items-center gap-2 p-2 rounded-2xl hl-glass">
                <div className="flex items-center gap-2 flex-1 px-3">
                  <Search size={19} className="text-[#E89D93]" />
                  <input
                    data-testid="hero-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search doctors, services or conditions..."
                    className="w-full bg-transparent text-white placeholder:text-slate-400 py-2.5 outline-none text-sm"
                  />
                </div>
                <Button type="submit" data-testid="hero-search-submit" className="rounded-xl bg-[#E89D93] hover:bg-[#e08b80] text-white px-5">
                  Search
                </Button>
              </div>
            </form>

            <div className="mt-10 flex flex-wrap gap-8">
              {[
                { n: `${stats.providers}+`, l: "Verified Providers" },
                { n: `${stats.islands_covered}`, l: "Islands Covered" },
                { n: `${stats.articles}+`, l: "Health Articles" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-3xl font-bold text-white">{s.n}</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CATEGORY QUICK LINKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.label}
              data-testid={`category-${c.label.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => navigate(`/directory?q=${encodeURIComponent(c.q)}`)}
              className="hl-card p-4 flex flex-col items-center gap-2 text-center"
            >
              <span className="w-11 h-11 rounded-xl bg-[#FDF0EE] flex items-center justify-center text-[#E89D93]">
                <c.icon size={20} />
              </span>
              <span className="text-xs font-semibold text-[#0F172A]">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* FEATURED PROVIDERS */}
      <Section title="Featured Providers" subtitle="Hand-picked trusted professionals" to="/directory" testid="featured-providers">
        {providers.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((p, i) => <ProviderCard key={p.id} provider={p} index={i} />)}
          </div>
        ) : <Empty icon={ShieldCheck} text="Providers will appear here once added by the admin." />}
      </Section>

      {/* HEALTH BLOG */}
      <Section title="Health & Wellness" subtitle="Articles and educational material" to="/blog" testid="home-articles" cream>
        {articles.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {articles.map((a) => (
              <Link key={a.id} to={`/blog/${a.slug}`} className="hl-card overflow-hidden group">
                <div className="h-40 bg-slate-100 overflow-hidden">
                  <img src={a.image_url || "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80"} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#D4AF37]">{a.category || "Article"}</span>
                  <h3 className="font-display font-bold text-[#0F172A] mt-1.5 leading-snug">{a.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty icon={BookOpen} text="Health articles will appear here once published." />}
      </Section>

      {/* EVENTS */}
      <Section title="Upcoming Events" subtitle="Health fairs, workshops & screenings" to="/events" testid="home-events">
        {events.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {events.map((ev) => (
              <Link key={ev.id} to={`/events/${ev.id}`} className="hl-card overflow-hidden group flex">
                <div className="w-24 shrink-0 bg-[#0B132B] text-white flex flex-col items-center justify-center py-4">
                  <Calendar size={18} className="text-[#D4AF37]" />
                  <span className="text-xs mt-2 text-center px-1">{ev.date}</span>
                </div>
                <div className="p-4 flex-1">
                  <h3 className="font-display font-bold text-[#0F172A] leading-snug">{ev.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><MapPin size={12} /> {ev.location || ev.island}</p>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ev.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty icon={Calendar} text="Upcoming events will appear here once added." />}
      </Section>

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <Section title="What patients say" subtitle="Real feedback from the community" to="/reviews" testid="home-reviews" cream>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="hl-card p-5">
                <StarRating value={r.rating} size={15} />
                {r.title && <h4 className="font-display font-bold text-[#0F172A] mt-3">{r.title}</h4>}
                <p className="text-sm text-muted-foreground mt-2 line-clamp-4">"{r.comment}"</p>
                <div className="mt-4 pt-3 border-t border-slate-100 text-sm">
                  <span className="font-semibold text-[#0F172A]">{r.author_name}</span>
                  {r.provider_name && <span className="text-muted-foreground"> · {r.provider_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* EXPANSION BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="hl-navy-gradient rounded-3xl px-8 py-14 lg:px-16 text-center relative overflow-hidden">
          <div className="relative">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-white">Better healthcare today. <span className="hl-gold-text">A brighter Caribbean tomorrow.</span></h2>
            <p className="mt-4 text-slate-300 max-w-2xl mx-auto">Growing across islands and territories to bring quality care closer to every community.</p>
            <Button onClick={() => navigate("/directory")} className="mt-7 rounded-full bg-[#E89D93] hover:bg-[#e08b80] text-white px-7 h-12">
              Explore the directory <ArrowRight size={17} className="ml-1.5" />
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function Section({ title, subtitle, to, children, testid, cream }) {
  return (
    <section className={cream ? "bg-white/60 py-16 mt-4" : "py-16"} data-testid={testid}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A]">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          </div>
          {to && (
            <Link to={to} className="text-sm font-semibold text-[#E89D93] hover:text-[#d47f74] flex items-center gap-1 shrink-0">
              See all <ArrowRight size={15} />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-14 text-center">
      <Icon size={30} className="mx-auto text-[#E89D93]/60" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
