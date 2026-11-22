import React from 'react';
import { MapPin, Mail, Paintbrush } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="mt-24 relative bg-[#070a12] text-gray-200 overflow-hidden border-t border-[#16243f] font-body">
      {/* Subtle Ambient Blue Spray Glow */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-80 h-80 bg-[#0ea5e9] rounded-full blur-[130px] opacity-20" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-[#38bdf8] rounded-full blur-[150px] opacity-15" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand Info */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#38bdf8] to-[#0284c7] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                <Paintbrush className="w-5 h-5 text-[#070a12]" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                <span className="font-tag text-[#38bdf8]">AssistIQ</span>
              </h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-xs sm:text-sm">
              Street-smart AI built for high-performance students. 
              Four study tools: PDF Notes, Quiz Generator, Email Summary and Study Planner (Planly).
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="font-tag text-xs text-[#38bdf8] bg-[#0ea5e9]/15 px-3 py-1 rounded-full border border-[#0ea5e9]/30 uppercase">
                ✦ STREET AI 2026 ✦
              </span>
            </div>
          </div>

          {/* Core Services Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[#38bdf8] flex items-center gap-2 font-tag">
              <Paintbrush className="w-4 h-4" /> Study tools
            </h3>
            <nav className="flex flex-col space-y-2.5 text-sm">
              {[
                { href: "/pdfNotesExtractor", text: "PDF Notes", tag: "START HERE" },
                { href: "/quizgenerator", text: "Quiz Generator", tag: "PRACTICE" },
                { href: "/EmailSummarizer", text: "Email Summary", tag: "OUTLOOK" },
                { href: "/planly", text: "Study Planner", tag: "PLANLY" },
              ].map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-[#0d1527] border border-[#16243f] hover:border-[#38bdf8]/40 transition-all duration-200"
                >
                  <span className="text-gray-300 group-hover:text-white transition-colors">{link.text}</span>
                  <span className="font-tag text-xs text-[#38bdf8] group-hover:underline">{link.tag} →</span>
                </a>
              ))}
            </nav>
          </div>

          {/* Contact Details */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-[#38bdf8] flex items-center gap-2 font-tag">
              <MapPin className="w-4 h-4" /> Headquarters
            </h3>
            <div className="space-y-3 text-xs text-gray-400">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0ea5e9]" />
                <span>AssistIQ Lab // Street Academic Division</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0ea5e9]" />
                <span>team@assistiq.ai</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#16243f] flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500">
          <p>© 2026 AssistIQ. All rights reserved.</p>
          <p className="font-tag text-[#38bdf8]/70 text-xs mt-2 sm:mt-0">
            Crafted for bold learners.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
