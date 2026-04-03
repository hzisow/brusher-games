import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGame } from "@/lib/gameContext";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, FileText, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import gannLogo from "@assets/Gann_Academy__MA__Red_Heifers_2_Logo_1765161174122.png";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useGame();
  const [location] = useLocation();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  if (!currentUser) return <div className="min-h-screen bg-background">{children}</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <img src={gannLogo} alt="Gann Academy" className="h-10 w-10 object-contain" />
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl leading-none tracking-tight text-foreground group-hover:text-primary transition-colors">
                  BRUSHER GAMES
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Gann Academy</span>
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
             <Button variant="ghost" size="sm" asChild className="hidden sm:flex gap-2">
                <a href="https://docs.google.com/document/d/14u_YquL67kXpkz7yrw1xmVZAgIYJ3H6z9P9mlUXzeHA/edit?tab=t.0#heading=h.jcl1clyjefps" target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" /> Rules
                </a>
             </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark((prev) => !prev)}
              className="h-9 w-9"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-none text-foreground">{currentUser.name}</div>
                <div className="text-xs text-muted-foreground mt-1 capitalize">{currentUser.role}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Floating Admin Button */}
      {location !== '/admin' && (
        <Link href="/admin">
          <Button
            className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-slate-800 hover:bg-slate-700 text-white"
            size="icon"
            title="Admin Dashboard"
            data-testid="button-admin"
          >
            <Shield className="h-5 w-5" />
          </Button>
        </Link>
      )}
    </div>
  );
}
