import { eventData } from "./data/events";
import { positions, validRatio, validTroopCounts, type RatioMode, type Triple, type TroopCounts } from "./engine";
import { validateProfile, type PlayerProfile, type Storage } from "./profiles";

export type Battle = {
  version: 1; id: string; profileId: string | null; playerName: string | null; server: number;
  observedAt?: string;
  testConditions?: { group: string; setup: string; confirmed: true };
  eventId: string; date: string | null; damage: number;
  attackKind: "individual" | "five-attack-total" | "unknown"; attackCount: 1 | 5 | null;
  formation: Triple<Record<typeof positions[number], string>> | null;
  ratios: RatioMode | { mode: "unknown"; ratio: { shield: number; bomber: number; shooter: number } } | null;
  troopCounts: Triple<TroopCounts> | null; robotIds: Triple<string | null> | null;
  progressionSnapshot: PlayerProfile | null;
  notes: string; provenance: "manual" | "imported" | "user-provided-history";
};
export const BATTLE_KEY = "gorillalab.battles.v1";
const legacyFields: (keyof Battle)[] = ["version", "id", "profileId", "playerName", "server", "eventId", "date", "damage", "attackKind", "attackCount", "formation", "ratios", "troopCounts", "robotIds", "progressionSnapshot", "notes", "provenance"];
const fields: (keyof Battle)[] = [...legacyFields, "observedAt", "testConditions"];
const obj = (x: unknown): x is Record<string, any> => !!x && typeof x === "object" && !Array.isArray(x);
const int = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const nullableText = (x: unknown) => x === null || typeof x === "string" && x.length > 0;
const triple = (x: unknown): x is unknown[] => Array.isArray(x) && x.length === 3;
export function validBattle(x: unknown): x is Battle {
  if (!obj(x) || x.version !== 1 || typeof x.id !== "string" || !x.id.trim() || !nullableText(x.profileId) || !nullableText(x.playerName) || !int(x.server) || !eventData.events.some(e => e.id === x.eventId) || !int(x.damage) || typeof x.notes !== "string" || !["manual", "imported", "user-provided-history"].includes(x.provenance)) return false;
  if (x.observedAt !== undefined && (typeof x.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(x.observedAt) || !Number.isFinite(Date.parse(x.observedAt)) || new Date(x.observedAt.slice(0,10)+"T00:00:00Z").toISOString().slice(0,10)!==x.observedAt.slice(0,10))) return false;
  if (x.testConditions !== undefined && (!obj(x.testConditions) || x.testConditions.confirmed !== true || typeof x.testConditions.group !== "string" || !x.testConditions.group.trim() || x.testConditions.group.length > 100 || typeof x.testConditions.setup !== "string" || !x.testConditions.setup.trim() || x.testConditions.setup.length > 2000)) return false;
  if (x.date !== null && (typeof x.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Number.isFinite(Date.parse(x.date)) || new Date(x.date).toISOString().slice(0, 10) !== x.date)) return false;
  if (x.attackKind === "individual" ? x.attackCount !== 1 : x.attackKind === "five-attack-total" ? x.attackCount !== 5 : x.attackKind !== "unknown" || x.attackCount !== null) return false;
  if (x.formation !== null) {
    if (!triple(x.formation) || !x.formation.every(t => obj(t) && positions.every(p => typeof t[p] === "string" && t[p].trim()))) return false;
    const ids = x.formation.flatMap(t => positions.map(p => (t as Record<string, string>)[p])); if (new Set(ids).size !== 9) return false;
  }
  if (x.ratios !== null) {
    if (!obj(x.ratios)) return false;
    if (["Shared", "unknown"].includes(x.ratios.mode)) { if (!validRatio(x.ratios.ratio)) return false; }
    else if (x.ratios.mode !== "Independent" || !triple(x.ratios.ratios) || !x.ratios.ratios.every(r => validRatio(r as any))) return false;
  }
  if (x.troopCounts !== null) {
    if (!triple(x.troopCounts) || !x.troopCounts.every(c => obj(c) && [c.shield, c.bomber, c.shooter].every(int) && Number.isSafeInteger(c.shield + c.bomber + c.shooter) && c.shield + c.bomber + c.shooter > 0)) return false;
    if (x.ratios && x.ratios.mode !== "unknown" && !x.troopCounts.every((c, i) => validTroopCounts(c as TroopCounts, x.ratios.mode === "Shared" ? x.ratios.ratio : x.ratios.ratios[i]))) return false;
  }
  if (x.robotIds !== null && (!triple(x.robotIds) || !x.robotIds.every(nullableText))) return false;
  if (x.progressionSnapshot !== null && (!validateProfile(x.progressionSnapshot) || x.progressionSnapshot.serverNumber !== x.server || x.profileId !== x.progressionSnapshot.id)) return false;
  if (x.robotIds && x.progressionSnapshot && x.robotIds.some((id: string | null) => id !== null && !x.progressionSnapshot.ownedRobots.some((r: { robotId: string }) => r.robotId === id))) return false;
  return true;
}
export function emptyBattle(id: string, server: number, eventId: string): Battle {
  return { version: 1, id, profileId: null, playerName: null, server, eventId, date: null, damage: 0, attackKind: "unknown", attackCount: null, formation: null, ratios: null, troopCounts: null, robotIds: null, progressionSnapshot: null, notes: "", provenance: "manual" };
}
export function parseBattles(text: string): Battle[] {
  if (text.length > 5_000_000) throw new Error("Battle import exceeds 5 MB.");
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!obj(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 5000 || !data.records.every(validBattle)) throw new Error("Invalid battle data or unsupported version. No saved data changed.");
  if (new Set(data.records.map((r: Battle) => r.id)).size !== data.records.length) throw new Error("Duplicate battle IDs in import.");
  return structuredClone(data.records);
}
export function loadBattles(storage: Storage): Battle[] {
  const raw = storage.getItem(BATTLE_KEY); return raw === null ? [] : parseBattles(raw);
}
export function battlesForServer(records: readonly Battle[], server: number): Battle[] { return records.filter(b => b.server === server).map(b => structuredClone(b)); }
export function saveBattle(storage: Storage, record: Battle): Battle[] {
  if (!validBattle(record)) throw new Error("Invalid battle: check server, damage, date, attack type, and snapshot metadata.");
  const records = loadBattles(storage);
  const previous = records.find(b => b.id === record.id);
  if (previous) throw new Error("Battle ID already exists; records are not silently overwritten.");
  records.push(structuredClone(record)); storage.setItem(BATTLE_KEY, JSON.stringify({ version: 1, records })); return records;
}
export function exportBattleJSON(records: readonly Battle[], server: number): string { return JSON.stringify({ version: 1, records: battlesForServer(records, server) }, null, 2); }
const csvCell = (x: unknown) => `"${JSON.stringify(x ?? null).replace(/"/g, '""')}"`;
/** JSON-encoded CSV cells preserve nulls/nested snapshots; leading strings cannot become spreadsheet formulas. */
export function exportBattleCSV(records: readonly Battle[], server: number): string {
  return [fields.join(","), ...battlesForServer(records, server).map(record => fields.map(field => csvCell(record[field])).join(","))].join("\r\n");
}
export function parseBattleCSV(text: string): Battle[] {
  if (text.length > 5_000_000) throw new Error("Battle import exceeds 5 MB.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') { if (cell) throw new Error("Malformed CSV quote."); quoted = true; }
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(v => v !== "")) rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const columns = rows.shift();
  if (!columns || ![fields.join(","),legacyFields.join(",")].includes(columns.join(","))) throw new Error("Use GorillaLab's CSV schema; unknown columns are not inferred.");
  const records = rows.map(values => { if (values.length !== columns.length) throw new Error("Invalid CSV column count."); const record = Object.fromEntries(columns.map((field, i) => [field, JSON.parse(values[i])])); for(const field of ["observedAt","testConditions"]) if(record[field] === null) delete record[field]; return record; });
  return parseBattles(JSON.stringify({ version: 1, records }));
}
export function importBattles(storage: Storage, text: string, format: "json" | "csv", server: number): Battle[] {
  const incoming = format === "json" ? parseBattles(text) : parseBattleCSV(text);
  if (incoming.some(b => b.server !== server)) throw new Error("Import contains another server. Select that server separately; nothing was imported.");
  const records = loadBattles(storage);
  for (const record of incoming) {
    const previous = records.find(b => b.id === record.id);
    if (previous && canonical(previous) !== canonical(record)) throw new Error("Conflicting duplicate battle ID; no data changed.");
    if (!previous) records.push(structuredClone(record));
  }
  storage.setItem(BATTLE_KEY, JSON.stringify({ version: 1, records })); return records;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (obj(value)) return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function compareBattles(a: Battle, b: Battle) {
  const blocked: string[] = [];
  if (a.server !== b.server) blocked.push("Different servers are never pooled.");
  if (a.eventId !== b.eventId) blocked.push("Different Gorilla types.");
  if (a.attackKind === "unknown" || b.attackKind === "unknown" || a.attackKind !== b.attackKind) blocked.push("Unknown or different attack aggregation; individual hits and five-attack totals cannot be compared.");
  const differences: string[] = [];
  for (const field of ["profileId", "formation", "ratios", "troopCounts", "robotIds", "progressionSnapshot", "date"] as const) {
    if (a[field] === null || b[field] === null) differences.push(`${field}: missing metadata; not a controlled comparison.`);
    else if (canonical(a[field]) !== canonical(b[field])) differences.push(`${field}: changed.`);
  }
  if (a.formation && b.formation) for (let team = 0; team < 3; team++) for (const position of positions) {
    const before = a.formation[team][position], after = b.formation[team][position];
    if (before !== after) differences.push(`Team ${team + 1} ${position}: ${before} → ${after}.`);
  }
  if (a.troopCounts && b.troopCounts) for (let team = 0; team < 3; team++) for (const kind of ["shield", "bomber", "shooter"] as const) {
    if (a.troopCounts[team][kind] !== b.troopCounts[team][kind]) differences.push(`Team ${team + 1} ${kind} troops: ${a.troopCounts[team][kind]} → ${b.troopCounts[team][kind]}.`);
  }
  if (a.robotIds && b.robotIds) for (let team = 0; team < 3; team++) {
    if (a.robotIds[team] !== b.robotIds[team]) differences.push(`Team ${team + 1} robot: ${a.robotIds[team] ?? "None"} → ${b.robotIds[team] ?? "None"}.`);
  }
  if (a.progressionSnapshot && b.progressionSnapshot) {
    const before = a.progressionSnapshot, after = b.progressionSnapshot;
    for (const hero of before.ownedHeroes) {
      const next = after.ownedHeroes.find(h => h.heroId === hero.heroId);
      if (!next) { differences.push(`${hero.heroId}: ownership changed.`); continue; }
      if (hero.stars !== next.stars) differences.push(`${hero.heroId} stars: ${hero.stars ?? "unknown"} → ${next.stars ?? "unknown"}.`);
      for (const key of ["skillLevels", "equipment", "exclusiveEquipment"] as const) if (canonical(hero[key]) !== canonical(next[key])) differences.push(`${hero.heroId}: ${key} progression changed.`);
    }
    for (const hero of after.ownedHeroes) if (!before.ownedHeroes.some(h => h.heroId === hero.heroId)) differences.push(`${hero.heroId}: newly recorded ownership.`);
    for (const robot of before.ownedRobots) {
      const next = after.ownedRobots.find(r => r.robotId === robot.robotId);
      if (!next) { differences.push(`${robot.robotId}: ownership changed.`); continue; }
      if (robot.level !== next.level) differences.push(`${robot.robotId} level: ${robot.level ?? "unknown"} → ${next.level ?? "unknown"}.`);
      if (canonical(robot.cores) !== canonical(next.cores)) differences.push(`${robot.robotId}: core progression changed.`);
      if (canonical(robot.upgrades) !== canonical(next.upgrades)) differences.push(`${robot.robotId}: upgrades changed.`);
    }
    for (const robot of after.ownedRobots) if (!before.ownedRobots.some(r => r.robotId === robot.robotId)) differences.push(`${robot.robotId}: newly recorded ownership.`);
  }
  return { comparable: blocked.length === 0, controlled: !blocked.length && !differences.length,
    damageDifference: blocked.length ? null : b.damage - a.damage, percentDifference: blocked.length || a.damage === 0 ? null : (b.damage - a.damage) / a.damage * 100,
    blocked, differences, explanation: "Observed damage difference only; changes, missing metadata, and combat randomness prevent a causal damage claim. Five-attack totals are never silently divided into single hits." };
}
