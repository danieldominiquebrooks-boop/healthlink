import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, MapPin } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { NewsletterModal } from "@/components/NewsletterModal";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";

const FALLBACK = "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80";

export default function Blog() {
  const { country, region } = useLocation();
  const [articles, setArticles] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState("all");

  useEffect(() => {
    const p = {};
    if (country && country !== "All Countries") p.country = country;
    if (region && region !== "All Parishes/Islands") p.region = region;
    api.get("/articles/categories", { params: p }).then((r) => setCats(r.data)).catch(() => setCats([]));
    setCat("all");
  }, [country, region]);

  useEffect(() => {
    const p = {};
    if (country && country !== "All Countries") p.country = country;
    if (region && region !== "All Parishes/Islands") p.region = region;
    if (cat !== "all") p.category = cat;
    api.get("/articles", { params: p }).then((r) => setArticles(r.data)).catch(() => setArticles([]));
  }, [country, region, cat]);

  const chip = (active) => `px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${active ? "bg-[#0B132B] text-white border-[#0B132B]" : "bg-white text-[#0F172A] border-[#E89D93]/30 hover:border-[#E89D93]"}`;

  return (
    <Layout>
      <NewsletterModal context="articles" />
      <PageHero title="Health Blog" subtitle="Articles, educational material and announcements to help you live healthier." testid="blog-hero" note={country !== "All Countries" ? (region !== "All Parishes/Islands" ? `${region}, ${country}` : country) : null} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6" data-testid="blog-category-filter">
            <button onClick={() => setCat("all")} data-testid="blog-cat-all" className={chip(cat === "all")}>All topics</button>
            {cats.map((c) => (
              <button key={c.name} onClick={() => setCat(c.name)} data-testid={`blog-cat-${c.name.toLowerCase().replace(/\s+/g, "-")}`} className={chip(cat === c.name)}>
                {c.name} <span className="opacity-60">({c.count})</span>
              </button>
            ))}
          </div>
        )}
        {articles.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a, i) => (
              <Link key={a.id} to={`/blog/${a.slug}`} data-testid={`article-card-${i}`} className="hl-card overflow-hidden group">
                <div className="h-48 bg-slate-100 overflow-hidden">
                  <img src={a.image_url || FALLBACK} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#D4AF37]">{a.category || "Article"}</span>
                    {a.featured && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#D4AF37] text-[#0B132B]" data-testid={`article-featured-${i}`}>★ Featured</span>}
                    {a.country && <span className="text-[11px] text-muted-foreground flex items-center gap-1" data-testid={`article-location-${i}`}><MapPin size={10} /> {a.region ? `${a.region}, ${a.country}` : `Country-wide · ${a.country}`}</span>}
                  </div>
                  <h3 className="font-display font-bold text-[#0F172A] mt-2 leading-snug">{a.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{a.excerpt}</p>
                  <p className="text-xs text-muted-foreground mt-3">By {a.author}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
            <BookOpen size={30} className="mx-auto text-[#E89D93]/60" />
            <p className="mt-3 text-muted-foreground">{cat !== "all" ? `No articles in "${cat}" yet.` : "No articles published yet."}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
