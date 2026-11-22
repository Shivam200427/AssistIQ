'use client'

import { useEffect, useState } from "react";
import axios from "axios";
import ConceptMapGraph from "../map";
import { GitFork } from "lucide-react";

export default function ConceptMap({ persist_dir }: { persist_dir: string; documentId?: string }) {
  const [map, setMap] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const generateMap = async () => {
      try {
        setLoading(true);
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
        const res = await axios.post(`${backendUrl}/conceptmap`, {
          store: persist_dir
        });
        if (mounted) setMap(res.data);
      } catch (err) {
        console.error("Concept map error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (persist_dir) {
      generateMap();
    }
    return () => { mounted = false; };
  }, [persist_dir]);

  return (
    <div className="h-full flex flex-col font-body text-white bg-[#070a12] rounded-2xl border border-[#0ea5e9]/25 overflow-hidden">
      <div className="px-4 py-2 bg-[#0d1527] border-b border-[#16243f] flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-[#38bdf8] font-tag font-bold">
          <GitFork className="w-3.5 h-3.5" /> [CONCEPT GRAPH // MIND MAP]
        </span>
        <span className="text-gray-400 text-[10px] font-tag">INTERACTIVE NODES</span>
      </div>

      <div className="flex-1 bg-black/40 relative">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Building knowledge graph...</span>
          </div>
        ) : map ? (
          <ConceptMapGraph data={map} />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">
            No concept nodes mapped yet.
          </div>
        )}
      </div>
    </div>
  );
}
