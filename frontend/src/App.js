import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { IslandProvider } from "@/context/IslandContext";
import { SavedProvider } from "@/context/SavedContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { InstallProvider } from "@/context/InstallContext";
import { InstallNudge } from "@/components/InstallNudge";
import { OfflineBanner } from "@/components/OfflineBanner";

import Home from "@/pages/Home";
import Directory from "@/pages/Directory";
import ProviderDetail from "@/pages/ProviderDetail";
import Blog from "@/pages/Blog";
import ArticleDetail from "@/pages/ArticleDetail";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Reviews from "@/pages/Reviews";
import Saved from "@/pages/Saved";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/admin" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <AuthProvider>
        <IslandProvider>
          <SavedProvider>
            <InstallProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/provider/:id" element={<ProviderDetail />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<ArticleDetail />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/saved" element={<Saved />} />
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <Toaster position="top-right" richColors />
            <InstallNudge />
            <OfflineBanner />
            </InstallProvider>
          </SavedProvider>
        </IslandProvider>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
