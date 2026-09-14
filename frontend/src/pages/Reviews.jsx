import React, { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { StarRating } from "@/components/StarRating";
import api from "@/lib/api";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get("/reviews", { params: { limit: 100 } }).then((r) => setReviews(r.data)).catch(() => setReviews([]));
  }, []);

  return (
    <Layout>
      <PageHero title="Community Reviews" subtitle="Real feedback and testimonials from patients across the Caribbean. All reviews are approved by our team." testid="reviews-hero" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {reviews.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r, i) => (
              <div key={r.id} className="hl-card p-6" data-testid={`review-card-${i}`}>
                <StarRating value={r.rating} size={16} />
                {r.title && <h3 className="font-display font-bold text-[#0F172A] mt-3">{r.title}</h3>}
                <p className="text-muted-foreground mt-2 leading-relaxed">"{r.comment}"</p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#0F172A]">{r.author_name}</span>
                  {r.provider_name && <span className="text-[#E89D93] font-medium">{r.provider_name}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#E89D93]/25 py-20 text-center">
            <MessageSquare size={30} className="mx-auto text-[#E89D93]/60" />
            <p className="mt-3 text-muted-foreground">No reviews published yet. Visit a provider profile to leave the first review.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
