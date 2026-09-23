import React from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitTracker } from "@/components/VisitTracker";

export function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <VisitTracker />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
