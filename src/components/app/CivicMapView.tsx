import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Map as MapGlyph, RotateCcw, Satellite } from "lucide-react";
import type { Map as MlMap, GeoJSONSource, Popup as MlPopup } from "maplibre-gl";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  category: string;
  area: string;
  statusText: string;
  labels: string;
  color: string;
  innovation: boolean;
  resolved: boolean;
  partnerCase: boolean;
  high: boolean;
}

export interface LegendItem { color: string; label: string; icon: LucideIcon }

// Free public vector style (OpenFreeMap, OpenStreetMap data). No API key; attribution is shown by the style.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const JHARKHAND: [number, number] = [85.28, 23.61];
// District boundaries: geoBoundaries gbOpen IND ADM2 (Pathways Data Pvt. Ltd., lgdirectory.gov.in), ODbL 1.0 — filtered to Jharkhand.
const DISTRICTS_URL = "/data/jharkhand-districts.geojson";

export interface DistrictStat { reportDistrict: string; total: number; needs: number; progress: number; resolved: number; innovation: number; partnerCases: number }
export type DistrictStats = Record<string, DistrictStat>;

/** Trim + case/diacritic-insensitive key. No aliases. */
export function normDistrict(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export const DISTRICT_LEGEND = [
  { label: "No loaded reports", fill: "#E5E7EB", border: "#FFFFFF" },
  { label: "1–5 active reports", fill: "#FDE68A", border: "#FFFFFF" },
  { label: "6–15 active reports", fill: "#F59E0B", border: "#FFFFFF" },
  { label: "16+ active reports", fill: "#EA580C", border: "#FFFFFF" },
  { label: "More resolved than active", fill: "#86EFAC", border: "#FFFFFF" },
  { label: "Purple border: Innovation activity", fill: "#FFFFFF", border: "#7C3AED" },
];

function districtFill(s?: DistrictStat) {
  if (!s || s.total === 0) return "#E5E7EB";
  const active = s.needs + s.progress;
  if (s.resolved > 0 && s.resolved > active) return "#86EFAC";
  if (active >= 16) return "#EA580C";
  if (active >= 6) return "#F59E0B";
  if (active >= 1) return "#FDE68A";
  return "#E5E7EB";
}

type Geo = { type: "FeatureCollection"; features: Array<{ type: "Feature"; properties: Record<string, unknown>; geometry: unknown }> };
function decorate(geo: Geo, stats: DistrictStats): Geo {
  return {
    type: "FeatureCollection",
    features: geo.features.map((f) => {
      const name = String(f.properties["name"]);
      const s = stats[normDistrict(name)];
      const fill = districtFill(s);
      const line = s && s.innovation > 0 ? "#7C3AED" : fill === "#E5E7EB" ? "#9CA3AF" : fill;
      return { ...f, properties: { name, fill, line, lineW: s && s.innovation > 0 ? 3 : 2 } };
    }),
  };
}

function toGeoJSON(points: MapPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, title: p.title, category: p.category, area: p.area, statusText: p.statusText,
        labels: p.labels, color: p.color, innovation: p.innovation ? 1 : 0, resolved: p.resolved ? 1 : 0,
        partnerCase: p.partnerCase ? 1 : 0, high: p.high ? 1 : 0,
      },
    })),
  };
}

export function CivicMapView({
  points, resetKey, onOpen, canOpen, emptyText, districtStats, partnerLabel, onDistrictFilter, legend = [],
}: {
  legend?: LegendItem[];
  districtStats: DistrictStats;
  partnerLabel: string | null;
  onDistrictFilter: (reportDistrict: string) => void;
  points: MapPoint[];
  resetKey: number;
  onOpen: (id: string) => void;
  canOpen: boolean;
  emptyText: string | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [districtError, setDistrictError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const geoRef = useRef<Geo | null>(null);
  const statsRef = useRef(districtStats);
  statsRef.current = districtStats;
  const labelRef = useRef(partnerLabel);
  labelRef.current = partnerLabel;
  const filterRef = useRef(onDistrictFilter);
  filterRef.current = onDistrictFilter;

  const fitBoundary = () => {
    const map = mapRef.current, lib = libRef.current, geo = geoRef.current;
    if (!map || !lib) return;
    if (!geo) { fit(); return; }
    const b = new lib.LngLatBounds();
    const walk = (c: unknown): void => { if (Array.isArray(c) && typeof c[0] === "number") b.extend(c as [number, number]); else if (Array.isArray(c)) c.forEach(walk); };
    geo.features.forEach((f) => walk((f.geometry as { coordinates: unknown }).coordinates));
    map.fitBounds(b, { padding: 20, duration: 600 });
  };

  const fit = () => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const pts = pointsRef.current;
    if (pts.length === 0) { map.easeTo({ center: JHARKHAND, zoom: 6.4 }); return; }
    const b = new lib.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 60, maxZoom: 13, duration: 600 });
  };

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !el.current || mapRef.current) return;
        libRef.current = lib;
        const map = new lib.Map({ container: el.current, style: STYLE_URL, center: JHARKHAND, zoom: 6.4, attributionControl: { compact: false } });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (e) => console.error("[map]", e.error));
        map.on("load", () => {
          // Satellite basemap: Esri World Imagery raster tiles (free, no key). Hidden until toggled.
          map.addSource("satellite", {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Esri, Maxar, Earthstar Geographics",
          });
          map.addSource("districts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } });
          map.addLayer({ id: "district-fill", type: "fill", source: "districts",
            paint: { "fill-color": ["get", "fill"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.25, 10, 0.15] } });
          map.addLayer({ id: "district-line", type: "line", source: "districts", paint: { "line-color": ["get", "line"], "line-width": ["get", "lineW"] } });
          map.addLayer({ id: "district-hover", type: "line", source: "districts", filter: ["==", ["get", "name"], ""], paint: { "line-color": "#0F172A", "line-width": 3, "line-opacity": 0.8 } });
          map.on("mousemove", "district-fill", (e) => { const n = e.features?.[0]?.properties?.["name"]; map.setFilter("district-hover", ["==", ["get", "name"], String(n ?? "")]); });
          map.on("mouseleave", "district-fill", () => map.setFilter("district-hover", ["==", ["get", "name"], ""]));
          map.addLayer({ id: "district-selected", type: "line", source: "districts", filter: ["==", ["get", "name"], ""], paint: { "line-color": "#1E3A8A", "line-width": 4 } });
          fetch(DISTRICTS_URL)
            .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Geo>; })
            .then((geo) => {
              if (cancelled) return;
              geoRef.current = geo;
              (map.getSource("districts") as GeoJSONSource | undefined)?.setData(decorate(geo, statsRef.current) as never);
              if (pointsRef.current.length === 0) fitBoundary();
            })
            .catch((err) => { console.error("[map] district boundaries", err); if (!cancelled) setDistrictError(true); });
          map.on("click", "district-fill", (e) => {
            if (map.queryRenderedFeatures(e.point, { layers: ["clusters", "points"] }).length) return;
            const f = e.features?.[0];
            if (!f) return;
            const name = String((f.properties as { name: string }).name);
            map.setFilter("district-selected", ["==", ["get", "name"], name]);
            const s = statsRef.current[normDistrict(name)];
            const box = document.createElement("div");
            box.className = "text-sm"; box.style.color = "#111827";
            const line = (t: string, bold = false) => { const d = document.createElement("div"); d.textContent = t; if (bold) d.style.fontWeight = "700"; box.appendChild(d); };
            line(name, true);
            line(`Total permitted reports: ${s?.total ?? 0}`);
            line(`Needs action: ${s?.needs ?? 0}`);
            line(`Work in progress: ${s?.progress ?? 0}`);
            line(`Resolved: ${s?.resolved ?? 0}`);
            line(`Innovation Cases: ${s?.innovation ?? 0}`);
            if (labelRef.current) line(`${labelRef.current} opportunities: ${s?.partnerCases ?? 0}`);
            const note = document.createElement("div"); note.textContent = "Data reflects currently available permitted reports."; note.style.cssText = "margin-top:4px;font-size:12px;color:#4b5563"; box.appendChild(note);
            if (s && s.total > 0) {
              const btn = document.createElement("button");
              btn.type = "button"; btn.textContent = `View ${name} Reports`;
              btn.setAttribute("aria-label", `Filter reports to ${name}`);
              btn.style.cssText = "margin-top:8px;min-height:40px;padding:0 12px;border-radius:8px;background:#1E3A8A;color:#fff;font-weight:600";
              btn.onclick = () => { popupRef.current?.remove(); filterRef.current(s.reportDistrict); };
              box.appendChild(btn);
            }
            popupRef.current?.remove();
            popupRef.current = new lib.Popup({ maxWidth: "260px" }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
          });
          map.addSource("reports", {
            type: "geojson", data: toGeoJSON(pointsRef.current), cluster: true, clusterRadius: 45, clusterMaxZoom: 14,
            clusterProperties: { inno: ["+", ["get", "innovation"]], res: ["+", ["get", "resolved"]], high: ["+", ["get", "high"]], pc: ["+", ["get", "partnerCase"]] },
          });
          const cR: never = ["step", ["get", "point_count"], 20, 10, 25, 30, 31] as never;
          map.addLayer({ id: "cluster-shadow", type: "circle", source: "reports", filter: ["has", "point_count"],
            paint: { "circle-color": "#000000", "circle-opacity": 0.35, "circle-blur": 0.6, "circle-radius": ["+", cR, 5] as never, "circle-translate": [0, 2] } });
          map.addLayer({ id: "clusters", type: "circle", source: "reports", filter: ["has", "point_count"],
            paint: { "circle-color": ["case", [">", ["get", "high"], 0], "#DC2626", [">", ["get", "pc"], 0], "#6D28D9", "#1E3A8A"], "circle-radius": cR, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" } });
          map.addLayer({ id: "cluster-count", type: "symbol", source: "reports", filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.35)", "text-halo-width": 1 } });
          map.addLayer({ id: "point-shadow", type: "circle", source: "reports", minzoom: 7.5, filter: ["!", ["has", "point_count"]],
            paint: { "circle-color": "#000000", "circle-opacity": 0.35, "circle-blur": 0.6, "circle-radius": ["case", ["==", ["get", "partnerCase"], 1], 23, 20], "circle-translate": [0, 2] } });
          map.addLayer({ id: "points", type: "circle", source: "reports", minzoom: 7.5, filter: ["!", ["has", "point_count"]],
            paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["==", ["get", "partnerCase"], 1], 20, 17], "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" } });
          // Text glyph inside each marker so colour is never the only signal.
          map.addLayer({ id: "point-glyph", type: "symbol", source: "reports", minzoom: 7.5, filter: ["!", ["has", "point_count"]],
            layout: { "text-field": ["case", ["==", ["get", "high"], 1], "!", ["==", ["get", "partnerCase"], 1], "◆", ["==", ["get", "innovation"], 1], "★", ["==", ["get", "resolved"], 1], "✓", "•"],
              "text-size": 16, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true, "text-ignore-placement": true },
            paint: { "text-color": "#ffffff" } });
          map.addLayer({ id: "selected", type: "circle", source: "reports", filter: ["==", ["get", "id"], ""],
            paint: { "circle-radius": 24, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": "#111827" } });

          map.on("click", "clusters", async (e) => {
            const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
            if (!f) return;
            const p = f.properties as { cluster_id: number; point_count: number; inno: number; res: number };
            const src = map.getSource("reports") as GeoJSONSource;
            const zoom = await src.getClusterExpansionZoom(p.cluster_id);
            map.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom });
            const box = document.createElement("div");
            box.className = "text-sm";
            [`${p.point_count} reports`, `Service Requests: ${p.point_count - p.inno}`, `Innovation Cases: ${p.inno}`, `Resolved: ${p.res}`].forEach((t, i) => {
              const d = document.createElement("div"); d.textContent = t; if (i === 0) d.style.fontWeight = "700"; box.appendChild(d);
            });
            popupRef.current?.remove();
            popupRef.current = new lib.Popup({ maxWidth: "240px" }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
          });
          map.on("click", "points", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties as { id: string; title: string; category: string; area: string; statusText: string; labels: string; partnerCase: number; color: string };
            map.setFilter("selected", ["==", ["get", "id"], String(p.id)]);
            const box = document.createElement("div");
            box.className = "text-sm";
            box.style.color = "#111827";
            const line = (t: string, bold = false) => { const d = document.createElement("div"); d.textContent = t; if (bold) d.style.fontWeight = "700"; box.appendChild(d); };
            box.style.cssText = "color:#111827;max-height:50vh;overflow-y:auto;display:grid;gap:3px";
            if (p.statusText) {
              const b = document.createElement("span"); b.textContent = String(p.statusText);
              b.style.cssText = `justify-self:start;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;color:#fff;background:${String(p.color)}`;
              box.appendChild(b);
            }
            if (Number(p.partnerCase)) line("Government-Approved Innovation Case", true);
            line(String(p.title), true);
            if (p.category) line(String(p.category));
            line(String(p.area || "Location unavailable or private."));
            if (p.statusText) line(`Status: ${p.statusText}`);
            if (p.labels) line(String(p.labels));
            if (Number(p.partnerCase)) line("AI suggestions are advisory. Government approval is required before any pilot or implementation.");
            if (canOpen) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.textContent = "View Details";
              btn.setAttribute("aria-label", `View details for ${p.title}`);
              btn.style.cssText = "margin-top:8px;min-height:40px;padding:0 12px;border-radius:8px;background:#0f766e;color:#fff;font-weight:600";
              btn.onclick = () => openRef.current(String(p.id));
              box.appendChild(btn);
            }
            popupRef.current?.remove();
            popupRef.current = new lib.Popup({ maxWidth: "min(280px, 80vw)", className: "civic-popup" }).setLngLat((f.geometry as unknown as { coordinates: [number, number] }).coordinates).setDOMContent(box).addTo(map);
          });
          for (const l of ["clusters", "points", "district-fill"]) {
            map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
          }
          setReady(true);
          fit();
        });
        ro = new ResizeObserver(() => map.resize());
        ro.observe(el.current);
      } catch (err) {
        console.error("[map] failed to load", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const src = mapRef.current?.getSource("reports") as GeoJSONSource | undefined;
    if (!ready || !src) return;
    popupRef.current?.remove();
    src.setData(toGeoJSON(points));
  }, [points, ready]);

  useEffect(() => {
    const src = mapRef.current?.getSource("districts") as GeoJSONSource | undefined;
    if (!ready || !src || !geoRef.current) return;
    src.setData(decorate(geoRef.current, districtStats) as never);
  }, [districtStats, ready]);

  useEffect(() => { if (ready) fit(); }, [resetKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-1 rounded-lg bg-muted p-4 text-center sm:h-[500px] lg:h-[560px]">
        <p className="font-semibold">Interactive map is temporarily unavailable.</p>
        <p className="text-sm text-muted-foreground">Use the colour-coded report list below.</p>
      </div>
    );
  }
  return (
    <div className="relative">
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-lg sm:h-[500px] lg:h-[560px]" role="region" aria-label="Interactive civic impact map" />
      <div className="absolute left-2 top-2 flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md" role="group" aria-label="Map view controls">
        <button type="button" onClick={fitBoundary} aria-label="Reset map view to Jharkhand" className="flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <RotateCcw className="size-4" aria-hidden="true" />Reset
        </button>
        <button
          type="button"
          aria-pressed={satellite}
          aria-label={satellite ? "Switch to standard map view" : "Switch to satellite view"}
          onClick={() => {
            const next = !satellite;
            setSatellite(next);
            const m = mapRef.current;
            m?.setLayoutProperty("satellite", "visibility", next ? "visible" : "none");
            m?.setPaintProperty("district-fill", "fill-opacity", next ? 0.18 : (["interpolate", ["linear"], ["zoom"], 7, 0.25, 10, 0.15] as never));
          }}
          className="flex min-h-11 items-center gap-2 border-t border-border px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {satellite ? <MapGlyph className="size-4" aria-hidden="true" /> : <Satellite className="size-4" aria-hidden="true" />}
          {satellite ? "Standard" : "Satellite"}
        </button>
      </div>
      {satellite ? (
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow">Satellite Background</span>
      ) : null}
      {legend.length ? (
        <div className="absolute bottom-8 left-2 max-w-[min(260px,calc(100%-4rem))]">
          <button type="button" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen} className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-primary shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:hidden">
            {legendOpen ? "Hide Map Legend" : "Show Map Legend"}
          </button>
          <div className={`${legendOpen ? "mt-2 block" : "hidden"} max-h-[260px] overflow-y-auto rounded-lg border border-border bg-card p-3 text-card-foreground shadow-md md:block md:max-h-[340px]`}>
            <p className="text-sm font-bold">Map Status Guide</p>
            <ul className="mt-2 grid gap-1.5 text-xs">
              {legend.map((k) => (
                <li key={k.label} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-card shadow" style={{ backgroundColor: k.color }}>
                    <k.icon className="size-3 text-primary-foreground" aria-hidden="true" />
                  </span>
                  <span>{k.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Tap a marker to view public-safe report details.</p>
            <p className="text-[11px] text-muted-foreground">Colours indicate status; icons and labels provide additional context.</p>
          </div>
        </div>
      ) : null}
      {districtError ? (
        <p className="mt-2 text-sm text-muted-foreground">District boundary layer is temporarily unavailable. Report markers and list remain available.</p>
      ) : null}
      {emptyText ? (
        <p className="pointer-events-none absolute inset-x-2 bottom-8 mx-auto max-w-sm rounded-md bg-background/95 p-2 text-center text-sm shadow">{emptyText}</p>
      ) : null}
    </div>
  );
}
