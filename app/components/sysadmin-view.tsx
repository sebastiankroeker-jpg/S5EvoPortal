"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InfraNode {
  id: string;
  label: string;
  type: "vm" | "service" | "network" | "edge" | "external";
  status: "online" | "offline" | "standby";
  details: string;
  icon: string;
  x: number;
  y: number;
}

interface InfraLink {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

const nodes: InfraNode[] = [
  // Edge Layer
  { id: "jetson", label: "Jetson Orin Nano", type: "edge", status: "standby", details: "8GB • ZED X Stereo • Ziellinie", icon: "📷", x: 150, y: 50 },
  // Compute Layer - Proxmox
  { id: "proxmox", label: "Proxmox (Geekom A9)", type: "service", status: "online", details: "Ryzen AI 9 HX 370 • 128GB DDR5 • 2TB NVMe", icon: "🖥️", x: 400, y: 150 },
  // VMs
  { id: "vm-openclaw", label: "openclaw", type: "vm", status: "online", details: "100.93.54.68 • Hauptserver-Agent", icon: "🤖", x: 200, y: 280 },
  { id: "vm-s5evo", label: "s5evo", type: "vm", status: "online", details: "100.117.30.7 • Fünfkampf-Agent", icon: "⚡", x: 400, y: 280 },
  { id: "vm-beacon", label: "beacon", type: "vm", status: "online", details: "100.79.55.75 • Learning Lab", icon: "🔬", x: 600, y: 280 },
  { id: "vm-authentik-local", label: "authentik (local)", type: "vm", status: "online", details: "192.168.10.250 • Identity Provider", icon: "🔐", x: 300, y: 380 },
  { id: "vm-playground", label: "playground", type: "vm", status: "standby", details: "Bumblebee / Test", icon: "🐝", x: 500, y: 380 },
  // External Services
  { id: "vercel", label: "Vercel", type: "external", status: "online", details: "s5-evo-portal.vercel.app • Next.js", icon: "▲", x: 650, y: 50 },
  { id: "github", label: "GitHub", type: "external", status: "online", details: "S5EvoPortal • CI/CD", icon: "🐙", x: 650, y: 150 },
  { id: "authentik-vps", label: "Authentik (IONOS)", type: "external", status: "online", details: "auth.s5evo.de • 217.154.65.203", icon: "🔑", x: 150, y: 150 },
  { id: "telegram", label: "Telegram", type: "external", status: "online", details: "@S5Evo_telegram_bot", icon: "📱", x: 50, y: 280 },
];

const links: InfraLink[] = [
  { from: "jetson", to: "proxmox", label: "Video Stream", color: "#ff6b35" },
  { from: "proxmox", to: "vm-openclaw", color: "#00ff88" },
  { from: "proxmox", to: "vm-s5evo", color: "#00ff88" },
  { from: "proxmox", to: "vm-beacon", color: "#00d4ff" },
  { from: "proxmox", to: "vm-authentik-local", color: "#ff00ff" },
  { from: "proxmox", to: "vm-playground", color: "#ffff00" },
  { from: "vm-s5evo", to: "vercel", label: "Deploy", color: "#00d4ff" },
  { from: "vm-s5evo", to: "github", label: "Push", color: "#00d4ff" },
  { from: "github", to: "vercel", label: "CI/CD", color: "#00ff88" },
  { from: "vercel", to: "authentik-vps", label: "OAuth2/OIDC", color: "#ff00ff" },
  { from: "vm-s5evo", to: "telegram", label: "Bot API", color: "#00d4ff" },
  { from: "vm-s5evo", to: "authentik-vps", label: "API", color: "#ff00ff" },
  { from: "vm-openclaw", to: "vm-s5evo", label: "Tailscale", color: "#00ff88" },
];

const statusColors: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  standby: "bg-yellow-500",
};

function getNodePos(id: string) {
  const node = nodes.find((n) => n.id === id);
  return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
}

export default function SysAdminView() {
  return (
    <div className="space-y-6">
      {/* Animated Architecture Diagram */}
      <Card className="bg-[#0a0a0f] border-[#1a1a2e] overflow-hidden">
        <CardHeader>
          <CardTitle className="text-[#00ff88] font-mono flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
            INFRASTRUCTURE OVERVIEW
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full" style={{ height: "460px" }}>
            <svg
              viewBox="0 0 750 460"
              className="w-full h-full"
              style={{ filter: "drop-shadow(0 0 8px rgba(0, 255, 136, 0.15))" }}
            >
              {/* Animated Links */}
              {links.map((link, i) => {
                const from = getNodePos(link.from);
                const to = getNodePos(link.to);
                return (
                  <g key={i}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={link.color || "#334155"}
                      strokeWidth="1.5"
                      opacity="0.4"
                    />
                    {/* Animated data pulse */}
                    <circle r="3" fill={link.color || "#00ff88"} opacity="0.9">
                      <animateMotion
                        dur={`${2 + i * 0.3}s`}
                        repeatCount="indefinite"
                        path={`M${from.x},${from.y} L${to.x},${to.y}`}
                      />
                    </circle>
                    {link.label && (
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 8}
                        fill="#64748b"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {link.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node, i) => (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  {/* Glow Effect */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="28"
                    fill="none"
                    stroke={node.status === "online" ? "#00ff88" : node.status === "standby" ? "#ffff00" : "#ff0055"}
                    strokeWidth="1"
                    opacity="0.3"
                  >
                    <animate
                      attributeName="r"
                      values="28;34;28"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.3;0.1;0.3"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {/* Node Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="24"
                    fill="#0f172a"
                    stroke={node.status === "online" ? "#00ff88" : node.status === "standby" ? "#ffff00" : "#ff0055"}
                    strokeWidth="1.5"
                  />
                  {/* Icon */}
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    fontSize="16"
                  >
                    {node.icon}
                  </text>
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 42}
                    fill="#e2e8f0"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {node.label}
                  </text>
                  {/* Details */}
                  <text
                    x={node.x}
                    y={node.y + 54}
                    fill="#64748b"
                    fontSize="7"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {node.details.length > 35 ? node.details.substring(0, 35) + "…" : node.details}
                  </text>
                </motion.g>
              ))}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Fleet Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-[#0f172a] border-[#1e293b] hover:border-[#00ff88]/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{node.icon}</span>
                    <span className="font-mono text-sm font-bold text-[#e2e8f0]">
                      {node.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColors[node.status]} ${node.status === "online" ? "animate-pulse" : ""}`} />
                    <span className="text-xs font-mono text-[#64748b]">{node.status}</span>
                  </div>
                </div>
                <p className="text-xs font-mono text-[#64748b]">{node.details}</p>
                <Badge
                  variant="outline"
                  className="mt-2 text-xs font-mono border-[#1e293b] text-[#64748b]"
                >
                  {node.type}
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
