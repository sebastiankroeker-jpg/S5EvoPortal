"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signIn } from "next-auth/react";

interface ESVHeroProps {
  onLogin?: () => void;
}

export default function ESVHero({ onLogin }: ESVHeroProps) {
  return (
    <div className="relative min-h-[600px] bg-gradient-to-br from-[#1a5f1a] via-[#2d4a2d] to-[#1a3d1a] overflow-hidden">
      {/* Background Pattern / Luftbild-Simulation */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,<svg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'><g fill='none' fill-rule='evenodd'><g fill='%23ffffff' fill-opacity='0.1'><circle cx='30' cy='30' r='2'/></g></g></svg>")`,
          backgroundRepeat: 'repeat'
        }}></div>
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-8">
          
          {/* Vereinswappen Slot */}
          <div className="flex justify-center">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 backdrop-blur-sm border-2 border-[#dc2626] flex items-center justify-center">
              <div className="text-4xl md:text-5xl font-bold text-[#dc2626]">ESV</div>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
              Mannschaftsfünfkampf
              <br />
              <span className="text-[#dc2626]">2026</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto">
              ESV Bad Bayersoien lädt ein zum traditionellen Fünfkampf-Wettkampf. 
              Meldet eure Mannschaften an und kämpft um den Pokal!
            </p>
          </div>

          {/* Call-to-Action */}
          <Card className="max-w-md mx-auto bg-white/10 backdrop-blur-md border-[#dc2626]">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-xl font-semibold text-white">Team anmelden</h3>
              <p className="text-gray-200 text-sm">
                Sichere dir einen Platz für deine Mannschaft beim diesjährigen Fünfkampf
              </p>
              <Button 
                onClick={() => signIn("authentik")}
                size="lg"
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold"
              >
                🏅 Jetzt anmelden
              </Button>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            <Card className="bg-white/5 backdrop-blur-sm border-white/10">
              <CardContent className="p-6 text-center">
                <div className="text-2xl mb-2">🏃‍♂️</div>
                <h4 className="font-semibold text-white mb-2">5 Disziplinen</h4>
                <p className="text-gray-300 text-sm">Vielseitiger Wettkampf für alle Teammitglieder</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 backdrop-blur-sm border-white/10">
              <CardContent className="p-6 text-center">
                <div className="text-2xl mb-2">👥</div>
                <h4 className="font-semibold text-white mb-2">5er Teams</h4>
                <p className="text-gray-300 text-sm">Jede Mannschaft besteht aus 5 Teilnehmern</p>
              </CardContent>
            </Card>
            <Card className="bg-white/5 backdrop-blur-sm border-white/10">
              <CardContent className="p-6 text-center">
                <div className="text-2xl mb-2">🏆</div>
                <h4 className="font-semibold text-white mb-2">Tradition</h4>
                <p className="text-gray-300 text-sm">Seit Jahren ein Highlight des Vereinsjahres</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}