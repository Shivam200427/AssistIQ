"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Paintbrush, LogIn, Menu, X, BookOpen, CircleHelp, Mail, LayoutDashboard } from "lucide-react";

const Navbar = () => {
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState("home");
  const [manualActive, setManualActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const tools = [
    { href: "/pdfNotesExtractor", label: "PDF Notes", icon: BookOpen },
    { href: "/quizgenerator", label: "Quiz Generator", icon: CircleHelp },
    { href: "/EmailSummarizer", label: "Email Summary", icon: Mail },
    { href: "/planly", label: "Study Planner", icon: LayoutDashboard },
  ];

  const sections = ["home", "features", "about", "contact"];
  const router = useRouter();

  const handleLogin = () => {
    window.location.href = "/api/auth/callback";
  };

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (manualActive) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.4 }
    );

    sections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [manualActive]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get("/api/auth/checklogin");
        setAuthorized(res.data.Authorized);
      } catch (err: any) {
        console.log("Auth check error:", err.message);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await axios.get("/api/auth/logout");
      if (res.status === 200) {
        setAuthorized(false);
      }
    } catch (err: any) {
      console.log(err.message);
    }
  };

  const handleClick = (sec: string) => {
    if (sec === "home") {
      setManualActive(true);
      setActiveSection("home");
      router.push("/home");
      setTimeout(() => setManualActive(false), 1000);
    } else {
      setManualActive(true);
      setActiveSection(sec);
      handleScrollTo(sec);
      setTimeout(() => setManualActive(false), 800);
    }
  };

  return (
    <nav className="sticky z-[100] top-0 bg-[#070a12]/95 backdrop-blur-md px-6 md:px-12 py-3.5 text-white flex justify-between items-center border-b border-[#0ea5e9]/25 shadow-[0_6px_25px_rgba(0,0,0,0.6)]">
      {/* Brand Logo: AssistIQ with Street Tag */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => router.push("/home")}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] flex items-center justify-center transform -rotate-3 group-hover:rotate-0 transition-transform shadow-[0_0_20px_rgba(56,189,248,0.4)]">
          <Paintbrush className="w-5 h-5 text-[#070a12] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-tag text-2xl md:text-3xl text-[#38bdf8] spray-glow tracking-wider transform -rotate-1">
            AssistIQ
          </span>
          <span className="hidden xl:inline-block px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest bg-[#0ea5e9]/20 text-[#38bdf8] border border-[#0ea5e9]/40 rounded-full font-stencil">
            STREET ED.
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="hidden lg:flex flex-row gap-6 xl:gap-8 font-medium text-sm xl:text-base">
        {sections.map((sec) => (
          <div
            key={sec}
            onClick={() => handleClick(sec)}
            className={`relative cursor-pointer uppercase tracking-wider whitespace-nowrap transition-colors py-1 ${
              activeSection === sec ? "text-[#38bdf8] font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            {sec}
            {activeSection === sec && (
              <motion.div
                layoutId="underline"
                className="absolute left-0 -bottom-1 h-[3px] w-full bg-gradient-to-r from-[#38bdf8] to-[#0ea5e9] rounded-full shadow-[0_0_10px_#38bdf8]"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
          </div>
        ))}
        <div
          onClick={() => router.push("/planly")}
          className="relative cursor-pointer uppercase tracking-wider whitespace-nowrap transition-colors py-1 text-gray-400 hover:text-white"
        >
          Study Planner
        </div>
      </div>

      {/* Auth Action Button: Simple "Connect" */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Below desktop width: compact tools menu (the full links don't fit) */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="site-tools-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden rounded-xl border border-[#0ea5e9]/40 p-2 text-[#38bdf8] cursor-pointer"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        {authorized ? (
          <button
            className="border border-[#0ea5e9] bg-[#0ea5e9]/15 text-[#38bdf8] hover:bg-[#0ea5e9] hover:text-[#070a12] font-bold uppercase text-xs md:text-sm px-4 py-2 rounded-xl transition-all duration-200 shadow-[0_0_15px_rgba(14,165,233,0.2)] hover:shadow-[0_0_25px_#0ea5e9] cursor-pointer"
            onClick={handleLogout}
          >
            Logout
          </button>
        ) : (
          <button
            className="bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-[#070a12] hover:from-[#7dd3fc] hover:to-[#38bdf8] font-black tracking-wide text-xs md:text-sm px-5 py-2.5 rounded-xl transition-all duration-200 shadow-[0_4px_20px_rgba(14,165,233,0.4)] flex items-center gap-2 cursor-pointer border border-[#38bdf8]/40 uppercase"
            onClick={handleLogin}
          >
            <LogIn className="w-4 h-4" />
            <span>Connect</span>
          </button>
        )}
      </div>

      {menuOpen && (
        <div id="site-tools-menu" className="lg:hidden absolute left-0 right-0 top-full border-b border-[#0ea5e9]/25 bg-[#070a12]/98 px-4 py-3 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.href}
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(t.href);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[#16243f] bg-[#0d1527] px-3 py-3 text-sm font-semibold text-gray-100 hover:border-[#38bdf8]/60 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[#38bdf8]" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
