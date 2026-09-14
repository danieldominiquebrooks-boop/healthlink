import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, MapPin } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { IslandFilterBar } from "@/components/IslandFilterBar";
import api from "@/lib/api";
import { useIsland } from "@/context/IslandContext";

const FALLBACK = "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80";

export default function Blog() {
  const { island } = useIsland();
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const p = island && island !== "All Islands" ? { island } : {};
    api.get("/articles", { params: p }).then((r) => setArticles(r.data)).catch(() => setArticles([]));
  }, [island]);

  return (
    <Layout>
      <PageHero title="Health Blog" subtitle="Articles, educational material and announcements to help you live healthier." testid="blog-hero" />
      <IslandFilterBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    {a.island && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {a.island}</span>}
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
            <p className="mt-3 text-muted-foreground">No articles published yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
