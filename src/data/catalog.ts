import bundledCatalog from "../../public/hero-catalog.json";

export const heroClasses = ["Shieldbearer", "Bomber", "Shooter"] as const;
export type HeroClass = typeof heroClasses[number];
export type Hero = {
  id: string;
  name: string;
  verification: "unverified";
  rarity?: { value: "N" | "R" | "SR" | "SSR"; source: string };
  aliases?: { name: string; verification: "verified"; source: string }[];
  class: { value: HeroClass; source: string } | null;
  seasonAvailability: { from: number; through?: number; verification: "verified" | "source-observed"; source: string } | null;
  skillMetadata: {
    status: "unknown" | "verified" | "source-observed";
    skills: { id: string; name: string; description: string; source: string }[];
  };
  sources: string[];
};
export type CatalogDocument = { version: 1; heroes: Hero[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim() && v === v.trim();
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const source = (v: unknown): v is string => {
  if (typeof v !== "string") return false;
  if (/^\/catalog-evidence\/[a-z0-9-]+\.md$/.test(v)) return true;
  try { const url = new URL(v); return ["https:", "http:"].includes(url.protocol); } catch { return false; }
};
/** Reject invalid updates as a whole; never silently drop broken records. */
export function parseCatalog(raw: unknown): CatalogDocument {
  if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.heroes) || !raw.heroes.length) throw new Error("Invalid catalog document.");
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const h of raw.heroes) {
    if (!object(h) || !text(h.id) || !text(h.name) || h.verification !== "unverified" || !Array.isArray(h.sources) || !h.sources.every(source)) throw new Error("Invalid catalog hero.");
    if (h.rarity !== undefined && (!object(h.rarity) || !["N", "R", "SR", "SSR"].includes(h.rarity.value as string) || !source(h.rarity.source))) throw new Error("Invalid hero rarity.");
    if (h.aliases !== undefined && (!Array.isArray(h.aliases) || !h.aliases.every(a => object(a) && text(a.name) && a.verification === "verified" && source(a.source)) || new Set(h.aliases.map(a => (a as { name: string }).name.toLowerCase())).size !== h.aliases.length)) throw new Error("Invalid verified aliases.");
    const id = h.id.toLowerCase(), name = h.name.toLowerCase();
    if (ids.has(id) || names.has(name)) throw new Error("Duplicate catalog hero ID or name.");
    ids.add(id); names.add(name);
    if (h.class !== null && (!object(h.class) || !heroClasses.includes(h.class.value as HeroClass) || !source(h.class.source))) throw new Error("Invalid hero class: use null for unknown or supply a source.");
    const season = h.seasonAvailability;
    if (season !== null && (!object(season) || !integer(season.from) || (season.through !== undefined && (!integer(season.through) || season.through < season.from)) || !["verified", "source-observed"].includes(season.verification as string) || !source(season.source))) throw new Error("Invalid season availability: unknown must be null.");
    const metadata = h.skillMetadata;
    if (!object(metadata) || !["unknown", "verified", "source-observed"].includes(metadata.status as string) || !Array.isArray(metadata.skills)) throw new Error("Invalid skill metadata.");
    if (metadata.status === "unknown" && metadata.skills.length) throw new Error("Unknown skills must not contain invented metadata.");
    if (metadata.status === "verified" && !metadata.skills.length) throw new Error("Verified skills require records.");
    const skillIds = new Set<string>();
    for (const skill of metadata.skills) {
      if (!object(skill) || !text(skill.id) || !text(skill.name) || !text(skill.description) || !source(skill.source) || skillIds.has(skill.id)) throw new Error("Invalid or duplicate skill metadata.");
      skillIds.add(skill.id);
    }
  }
  return structuredClone(raw) as CatalogDocument;
}
export const heroCatalog: readonly Hero[] = parseCatalog(bundledCatalog).heroes;
export function filterCatalog(catalog: readonly Hero[], filters: { query?: string; heroClass?: HeroClass | "unknown" | "all"; eligibleIds?: ReadonlySet<string> } = {}): Hero[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  return catalog.filter(h => (h.name.toLowerCase().includes(query) || h.id.toLowerCase().includes(query) || h.aliases?.some(a => a.name.toLowerCase().includes(query))) &&
    (!filters.heroClass || filters.heroClass === "all" || (h.class?.value ?? "unknown") === filters.heroClass) &&
    (!filters.eligibleIds || filters.eligibleIds.has(h.id)));
}
export async function fetchCatalog(): Promise<Hero[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}hero-catalog.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  return parseCatalog(await response.json()).heroes;
}

