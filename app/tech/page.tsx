"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import SysAdminView from "../components/sysadmin-view";
import { ArrowLeft } from "lucide-react";

export default function TechPage() {
  return (
    <div className="sysadmin-bg min-h-screen dark">
      {/* Header mit S5Evo Logo und Zurück-Button */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-sm border-b border-[#1a1a2e]">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏅</span>
              <div>
                <h1 className="text-lg font-semibold text-[#00ff88] font-mono">
                  S5Evo
                </h1>
                <h2 className="text-sm text-[#64748b] font-mono flex items-center gap-2">
                  <span>🖥️</span>
                  Technische Infrastruktur
                </h2>
              </div>
            </div>
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#64748b] hover:text-[#00ff88] hover:bg-[#1a1a2e] transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <SysAdminView />
      </main>
    </div>
  );
}