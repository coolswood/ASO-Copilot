"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import * as isoCountries from "i18n-iso-countries";
import worldTopology from "world-atlas/countries-110m.json";

interface CountryResult {
  country: string;
  position: number | null;
}

const WIDTH = 980;
const HEIGHT = 500;

function rankColor(position: number | null | undefined): string {
  if (position === undefined) return "var(--border)";
  if (position === null) return "var(--danger)";
  if (position <= 10) return "var(--success)";
  if (position <= 50) return "var(--warning)";
  return "var(--danger)";
}

export default function WorldMap({ results }: { results: CountryResult[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; name: string; position: number | null } | null>(
    null,
  );

  const features = useMemo(() => {
    const topology = worldTopology as unknown as Topology;
    const countries = topology.objects.countries as GeometryCollection;
    return (feature(topology, countries) as unknown as { features: Feature<Geometry>[] }).features;
  }, []);

  const path = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" } as unknown as Feature);
    return geoPath(projection);
  }, []);

  const resultByNumeric = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const r of results) {
      const numeric = isoCountries.alpha2ToNumeric(r.country.toUpperCase());
      if (numeric) map.set(Number(numeric), r.position);
    }
    return map;
  }, [results]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="World map colored by the app's search rank per country for the selected keyword"
      >
        {features.map((geo, i) => {
          const id = Number(geo.id);
          const hasResult = resultByNumeric.has(id);
          const position = hasResult ? resultByNumeric.get(id) ?? null : undefined;
          const name = (geo.properties as { name?: string } | null)?.name ?? "Unknown";
          return (
            <path
              key={geo.id != null ? String(geo.id) : `geo-${i}`}
              d={path(geo) ?? undefined}
              fill={rankColor(position)}
              stroke="var(--background)"
              strokeWidth={0.5}
              className="transition-all duration-300 cursor-default hover:brightness-125"
              onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, name, position: position ?? null })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none fixed z-30 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow-lg animate-fade-in"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: rankColor(hover.position) }} />
          <div>
            <div className="font-medium">{hover.name}</div>
            <div className="text-muted">{hover.position !== null ? `#${hover.position}` : "Not ranked"}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success)" }} />
          Top 10
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--warning)" }} />
          11-50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--danger)" }} />
          51+ / not found
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-border" style={{ background: "var(--border)" }} />
          Not scanned
        </span>
      </div>
    </div>
  );
}
