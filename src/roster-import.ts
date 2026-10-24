import { heroClasses, type Hero, type HeroClass } from "./data/catalog";
import manifest from "../public/portraits/manifest.json";
import type { PlayerProfile } from "./profiles";

export type RosterRow = { line: number; raw: string; name: string; heroId: string; stars: number | null; heroClass: HeroClass | null; skip: boolean; parseError: string };
export type ImportOptions = { mode: "merge" | "replace"; confirmStarChanges: boolean; confirmRemovals: boolean };
const normalize = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
export function matchRosterName(name: string, catalog: readonly Hero[]): string {
  const key = normalize(name);
  const ids = new Set(catalog.filter(h => normalize(h.name) === key || normalize(h.id) === key || h.aliases?.some(a => a.verification === "verified" && normalize(a.name) === key)).map(h => h.id));
  for (const alias of manifest.portraits) if (alias.match === "documented-alias" && normalize(alias.sourceHeroName) === key && catalog.some(h => h.id === alias.heroId)) ids.add(alias.heroId);
  return ids.size === 1 ? [...ids][0] : "";
}
export function parseRoster(text: string, catalog: readonly Hero[]): RosterRow[] {
  if (!text.trim()) throw new Error("The TXT file is empty.");
  if (text.length > 200000 || text.includes("\0") || /[\u0001-\u0008\u000e-\u001f\ufffd]/u.test(text)) throw new Error("Unreadable text. Use a UTF-8 TXT file under 200 KB.");
  const rows: RosterRow[] = [];
  let section: HeroClass | null = null;
  text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).forEach((raw, index) => {
    let value = raw.trim();
    if (!value || value.startsWith("#") || value.startsWith("//")) return;
    const header = value.replace(/^[#\[\s]+|[\]:\s]+$/g, "");
    const heading = heroClasses.find(c => (normalize(c) === normalize(header) || `${normalize(c)}s` === normalize(header)));
    if (heading) { section = heading; return; }
    let heroClass = section;
    value = value.replace(/\b(Shieldbearer|Bomber|Shooter)\b/ig, token => { heroClass = heroClasses.find(c => normalize(c) === normalize(token))!; return " "; });
    let stars: number | null = null;
    let parseError = "";
    const tokens = [...value.matchAll(/(?:[+-]?\d+(?:\.\d+)?\s*(?:stars?\b|[★⭐])|[★⭐]\s*[+-]?\d+(?:\.\d+)?|[★⭐]+)/gi)];
    if (tokens.length > 1) parseError = "Multiple star values; enter one star level.";
    if (tokens.length) {
      const token = tokens[0][0];
      const number = token.match(/[+-]?\d+(?:\.\d+)?/);
      stars = number ? Number(number[0]) : [...token].filter(c => c === "★" || c === "⭐").length;
      value = value.replace(tokens[0][0], " ");
      if (!Number.isInteger(stars) || stars < 0 || stars > 5) parseError = "Stars must be a whole number from 0 to 5.";
    }
    const name = value.replace(/^[\s|,:;–—-]+|[\s|,:;–—-]+$/g, "").replace(/\s+/g, " ");
    if (!name || /\bstars?\b|[★⭐]/i.test(name)) parseError ||= "Malformed hero or star entry; correct the match and stars.";
    rows.push({ line: index + 1, raw, name, heroId: matchRosterName(name, catalog), stars, heroClass, skip: false, parseError });
  });
  if (!rows.length) throw new Error("No hero entries found. Add one hero per line.");
  if (rows.length > 1000) throw new Error("Too many entries. Maximum 1,000 hero lines per import.");
  return rows;
}
export function rosterIssues(rows: readonly RosterRow[], catalog: readonly Hero[]): string[] {
  const seen = new Set<string>();
  return rows.filter(r => !r.skip).flatMap(r => {
    const issues: string[] = [];
    const hero = catalog.find(h => h.id === r.heroId);
    if (r.parseError) issues.push(r.parseError);
    if (!hero) issues.push("Unknown hero: choose a catalog match or skip this entry.");
    if (r.stars !== null && (!Number.isInteger(r.stars) || r.stars < 0 || r.stars > 5)) issues.push("Stars must be a whole number from 0 to 5.");
    if (hero && r.heroClass && hero.class && r.heroClass !== hero.class.value) issues.push(`Class conflicts with catalog (${hero.class.value}); correct the class or leave it unspecified.`);
    if (r.heroId && seen.has(r.heroId)) issues.push("Duplicate hero: skip or correct this entry.");
    seen.add(r.heroId);
    return issues.map(issue => `Line ${r.line}: ${issue}`);
  });
}
export function importRoster(profile: PlayerProfile, rows: readonly RosterRow[], catalog: readonly Hero[], options: ImportOptions): PlayerProfile {
  const issues = rosterIssues(rows, catalog);
  if (issues.length) throw new Error(issues.join(" "));
  const entries = rows.filter(r => !r.skip);
  if (!entries.length) throw new Error("Select at least one valid hero to import.");
  const ids = new Set(entries.map(r => r.heroId));
  if (options.mode === "replace" && profile.ownedHeroes.some(h => !ids.has(h.heroId)) && !options.confirmRemovals) throw new Error("Confirm removal of existing heroes before replacing the roster.");
  if (entries.some(r => r.stars !== null && profile.ownedHeroes.some(h => h.heroId === r.heroId && h.stars !== null && h.stars !== r.stars)) && !options.confirmStarChanges) throw new Error("Confirm overwriting existing star levels.");
  const next = structuredClone(profile);
  if (options.mode === "replace") next.ownedHeroes = next.ownedHeroes.filter(h => ids.has(h.heroId));
  for (const row of entries) {
    const owned = next.ownedHeroes.find(h => h.heroId === row.heroId);
    if (owned) { if (row.stars !== null) owned.stars = row.stars; }
    else next.ownedHeroes.push({ heroId: row.heroId, stars: row.stars, skillLevels: {}, equipment: [] });
  }
  return next;
}


/** Parsing, catalog resolution and import validation are separate audit stages. */
export function rosterReport(rows: readonly RosterRow[], catalog: readonly Hero[]) {
  const active = rows.filter(r => !r.skip);
  const parsingErrors = active.filter(r => r.parseError || r.stars !== null && (!Number.isInteger(r.stars) || r.stars < 0 || r.stars > 5));
  const unmatched = active.filter(r => !catalog.some(h => h.id === r.heroId));
  return {
    entries: active.length,
    matched: active.length - unmatched.length,
    unmatched,
    parsingErrors,
    sections: Object.fromEntries(heroClasses.map(c => [c, active.filter(r => r.heroClass === c).length])),
    validationIssues: rosterIssues(rows, catalog).filter(issue => !issue.includes("Unknown hero:") && !parsingErrors.some(r => issue.startsWith(`Line ${r.line}:`) && (issue.includes(r.parseError || "Stars must be") || issue.includes("Stars must be")))),
  };
}

