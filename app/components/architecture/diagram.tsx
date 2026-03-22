"use client";

import { diagramEdges, diagramNodes, PersonaFilter } from "@/lib/data/architecture";
import { useMemo } from "react";

const tierColors = {
  persona: "#fef9c3",
  service: "#e0f2fe",
  data: "#fce7f3"
};

const strokeColors = {
  persona: "#facc15",
  service: "#38bdf8",
  data: "#ec4899"
};

const height = 420;
const width = 1100;

export function ArchitectureDiagram({ activePersona }: { activePersona: PersonaFilter }) {
  const markerId = "arrowhead";

  const visibleNodes = useMemo(() => {
    return diagramNodes.map((node) => {
      const active = activePersona === "all" || node.audience.includes(activePersona);
      return { ...node, active };
    });
  }, [activePersona]);

  return (
    <div className="w-full overflow-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="S5Evo Referenzarchitektur"
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {diagramEdges.map((edge) => {
          const from = diagramNodes.find((n) => n.id === edge.from);
          const to = diagramNodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          const isActive = activePersona === "all" || edge.audience.includes(activePersona);
          const startX = from.x + from.width / 2;
          const startY = from.y + 30;
          const endX = to.x + to.width / 2;
          const endY = to.y - 10;

          return (
            <g key={`${edge.from}-${edge.to}`} opacity={isActive ? 0.9 : 0.2}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#94a3b8"
                strokeWidth={2}
                markerEnd={`url(#${markerId})`}
              />
              {edge.label && (
                <text
                  x={(startX + endX) / 2}
                  y={(startY + endY) / 2 - 6}
                  textAnchor="middle"
                  className="fill-slate-500 text-[12px]"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {visibleNodes.map((node) => (
          <g key={node.id} opacity={node.active ? 1 : 0.25}>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={80}
              rx={14}
              fill={tierColors[node.kind]}
              stroke={strokeColors[node.kind]}
              strokeWidth={2}
            />
            <text x={node.x + 12} y={node.y + 28} className="font-semibold text-[16px] fill-slate-900">
              {node.label}
            </text>
            <text x={node.x + 12} y={node.y + 50} className="text-[12px] fill-slate-600">
              {node.description}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
