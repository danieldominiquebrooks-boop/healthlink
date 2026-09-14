import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { Layout } from "@/components/Layout";
import api from "@/lib/api";

const FALLBACK = "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&q=80";

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);

  useEffect(() => {
    api.get(`/articles/${slug}`).then((r) => setArticle(r.data)).catch(() => setArticle(false));
  }, [slug]);

  if (article === false) return <Layout><div className="py-24 text-center text-muted-foreground">Article not found. <Link to="/blog" className="text-[#E89D93] font-semibold">Back to blog</Link></div></Layout>;
  if (!article) return <Layout><div className="py-40 text-center text-muted-foreground">Loading...</div></Layout>;

  return (
    <Layout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-[#E89D93] hover:text-[#d47f74] text-sm mb-6"><ArrowLeft size={16} /> Back to blog</Link>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">{article.category || "Article"}</span>
          {article.island && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> {article.island}</span>}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">{article.title}</h1>
        <p className="text-muted-foreground mt-3">By {article.author}</p>
        <img src={article.image_url || FALLBACK} alt={article.title} className="w-full h-64 sm:h-80 object-cover rounded-2xl mt-6" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
        {article.excerpt && <p className="text-lg text-[#0F172A] font-medium mt-6 leading-relaxed">{article.excerpt}</p>}
        <div className="hl-prose mt-5 text-[#334155] leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content || "" }} />
      </article>
    </Layout>
  );
}
