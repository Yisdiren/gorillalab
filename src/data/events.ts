import bundled from "../../public/gorilla-events.json";
import { validRatio, type TroopRatio } from "../engine";
export const eventDisplayNames: Readonly<Record<string, string>> = {"space":"Space Gorilla","wise":"Wise Gorilla","primal":"Primal Gorilla","cyber":"Cyber Gorilla","armed":"Armed Gorilla","treasure":"Treasure Gorilla","warlord":"Gorilla Warlord"};
export function eventDisplayName(id: string): string { return Object.hasOwn(eventDisplayNames, id) ? eventDisplayNames[id] : "Unknown Gorilla"; }
export const bonusCategories = ["satellite", "technology", "tome", "power-armor", "hero-equipment", "collection"] as const;
export type BonusCategory = typeof bonusCategories[number];
export type GorillaEvent = {
  id: string; day: string; name: string; startingRatio: TroopRatio;
  bonuses: { category: BonusCategory; reportedBoostPercent: number; strength: "daily-boost" | "normal"; baseValue: null; damageMultiplier: null }[];
  mechanicsStatus: "unknown";
  ratioStatus: "starting-recommendation-not-proven-optimum";
};
export type EventData = {
  version: 1; source: string; verification: "guide-reported-not-independently-verified";
  adaShieldRule: { heroId: "Ada"; skill: "second war skill"; minimumShieldbearers: number; verification: "pending" };
  events: GorillaEvent[];
};
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
export function parseEvents(raw: unknown): EventData {
  if (!object(raw) || raw.version !== 1 || typeof raw.source !== "string" || !raw.source.trim() || raw.verification !== "guide-reported-not-independently-verified" || !Array.isArray(raw.events) || raw.events.length !== 7) throw new Error("Invalid seven-event configuration.");
  const rule = raw.adaShieldRule;
  if (!object(rule) || rule.heroId !== "Ada" || rule.skill !== "second war skill" || !Number.isSafeInteger(rule.minimumShieldbearers) || rule.minimumShieldbearers < 0 || rule.verification !== "pending") throw new Error("Invalid pending Ada rule.");
  const ids = new Set(), seenDays = new Set();
  for (const e of raw.events) {
    if (!object(e) || typeof e.id !== "string" || !e.id.trim() || ids.has(e.id) || !days.includes(e.day) || seenDays.has(e.day) || typeof e.name !== "string" || !e.name.trim() || !object(e.startingRatio) || !validRatio(e.startingRatio as TroopRatio) || e.mechanicsStatus !== "unknown" || e.ratioStatus !== "starting-recommendation-not-proven-optimum" || !Array.isArray(e.bonuses)) throw new Error("Invalid event or duplicate day/ID.");
    ids.add(e.id); seenDays.add(e.day);
    if (e.bonuses.length !== (e.day === "Sunday" ? 6 : 1)) throw new Error("Sunday requires six separate categories; daily events require one.");
    const categories = new Set();
    for (const b of e.bonuses) {
      if (!object(b) || !bonusCategories.includes(b.category) || categories.has(b.category) || !Number.isFinite(b.reportedBoostPercent) || b.reportedBoostPercent < 0 || b.baseValue !== null || b.damageMultiplier !== null || (e.day === "Sunday" ? b.strength !== "normal" || b.reportedBoostPercent !== 0 : b.strength !== "daily-boost")) throw new Error("Invalid bonus: mechanics and damage multiplier must remain unknown.");
      categories.add(b.category);
    }
  }
  return structuredClone(raw) as EventData;
}
export const eventData = parseEvents(bundled);
export async function fetchEvents(): Promise<EventData> {
  const response = await fetch(`${import.meta.env.BASE_URL}gorilla-events.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Event configuration request failed (${response.status}).`);
  return parseEvents(await response.json());
}
