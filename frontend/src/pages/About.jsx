import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import api from "@/lib/api";

export default function About() {
  const [about, setAbout] = useState(null);

  useEffect(() => {
    api.get("/about").then((r) => setAbout(r.data || {})).catch(() => setAbout({}));
  }, []);

  const heading = about?.heading || "About My Healthcare Link";
  const story = about?.story || "";
  const image = about?.image_url || "";
  const team = about?.team || [];

  return (
    <Layout>
      <div data-testid="about-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[#B8912B] font-semibold">Who we are</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0F172A]" data-testid="about-heading">
            {heading}
          </h1>
        </motion.div>

        {image && (
          <motion.img
            src={image}
            alt={heading}
            data-testid="about-image"
            className="mt-8 w-full h-64 sm:h-80 object-cover rounded-3xl border border-[#E89D93]/20 shadow-sm"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
        )}

        {story ? (
          <div
            className="prose prose-slate max-w-none mt-8 text-[#334155] leading-relaxed [&_p]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[#0F172A] [&_a]:text-[#E89D93]"
            data-testid="about-story"
            dangerouslySetInnerHTML={{ __html: story }}
          />
        ) : (
          <p className="mt-8 text-[#334155] leading-relaxed">
            My Healthcare Link connects Caribbean communities with trusted healthcare providers, services,
            health information and events — closer to you, across every island.
          </p>
        )}

        {team.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A]">Meet the team</h2>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="about-team">
              {team.map((m, i) => (
                <motion.div
                  key={i}
                  data-testid={`team-member-${i}`}
                  className="rounded-2xl border border-[#E89D93]/20 bg-white p-6 text-center"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  {m.photo ? (
                    <img src={m.photo} alt={m.name} className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-[#D4AF37]/40" />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto bg-[#FDF0EE] flex items-center justify-center text-[#E89D93] font-display text-2xl font-bold">
                      {(m.name || "?").charAt(0)}
                    </div>
                  )}
                  <h3 className="mt-4 font-display font-bold text-lg text-[#0F172A]">{m.name}</h3>
                  {m.role && <p className="text-sm text-[#B8912B] font-medium">{m.role}</p>}
                  {m.bio && <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{m.bio}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
