import eventRules from "../public/robot-event-rules.json";
import data from "../public/robot-evidence.json";
import { validateProfile, type PlayerProfile } from "./profiles";
import type { Triple } from "./engine";
export const robotsEnabledForEvent = (eventId: string): boolean => eventRules.enabledEventIds.includes(eventId);
export type RobotReuse = "unknown" | "unique" | "allowed";
export type RobotEffect = {
  id: string; metric: string; source: string; verification: "verified-in-gorilla" | "source-reported";
  events: string[]; valuesByLevel: Record<string, number>; minimumCore?: { name: string; level: number };
};
export type RobotEvidence = { id: string; effects: RobotEffect[] };
export function parseRobotEvidence(raw: unknown): RobotEvidence[] {
  const object = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
  if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.robots)) throw new Error("Invalid robot evidence document.");
  const ids = new Set<string>();
  for (const robot of raw.robots) {
    if (!object(robot) || typeof robot.id !== "string" || !robot.id.trim() || ids.has(robot.id) || !Array.isArray(robot.effects)) throw new Error("Invalid or duplicate robot evidence ID.");
    ids.add(robot.id); const effectIds = new Set<string>();
    for (const effect of robot.effects) {
      if (!object(effect) || typeof effect.id !== "string" || !effect.id.trim() || effectIds.has(effect.id) || typeof effect.metric !== "string" || !effect.metric.trim() || typeof effect.source !== "string" || !/^https?:\/\//.test(effect.source) || !["source-reported", "verified-in-gorilla"].includes(effect.verification) || !Array.isArray(effect.events) || !effect.events.every((event: unknown) => ["space", "wise", "primal", "cyber", "armed", "treasure", "warlord"].includes(event as string)) || !object(effect.valuesByLevel) || !Object.entries(effect.valuesByLevel).every(([level, value]) => /^\d+$/.test(level) && typeof value === "number" && Number.isFinite(value))) throw new Error("Invalid documented robot effect.");
      if (effect.minimumCore !== undefined && (!object(effect.minimumCore) || typeof effect.minimumCore.name !== "string" || !Number.isSafeInteger(effect.minimumCore.level) || effect.minimumCore.level < 0)) throw new Error("Invalid robot core requirement.");
      effectIds.add(effect.id);
    }
  }
  return structuredClone(raw.robots) as RobotEvidence[];
}
export const robotEvidence: readonly RobotEvidence[] = parseRobotEvidence(data);
export function robotEffects(profile: PlayerProfile, assignments: Triple<string | null>, eventId: string, evidence: readonly RobotEvidence[] = robotEvidence) {
  if (!robotsEnabledForEvent(eventId)) return [0, 1, 2].map(team => ({ team, robotId: null, applied: [], unresolved: ["Robots are not used in this event (player-verified rule)."] }));
  return assignments.map((id, team) => {
    if (id === null) return { team, robotId: null, applied: [], unresolved: ["No robot assigned."] };
    const owned = profile.ownedRobots.find(r => r.robotId === id);
    if (!owned) throw new Error("Cannot assign an unowned robot.");
    const documented = evidence.find(r => r.id === id);
    const applied: { id: string; metric: string; value: number; source: string }[] = [];
    const unresolved: string[] = [];
    for (const effect of documented?.effects ?? []) {
      if (effect.verification !== "verified-in-gorilla" || !/^https?:\/\//.test(effect.source) || !effect.events.includes(eventId) || owned.level == null) { unresolved.push(`${effect.id}: applicability or progression not established.`); continue; }
      const value = effect.valuesByLevel[String(owned.level)];
      const core = effect.minimumCore;
      if (!Number.isFinite(value) || core && (owned.cores?.[core.name] ?? -1) < core.level) { unresolved.push(`${effect.id}: exact level/core requirement not established.`); continue; }
      applied.push({ id: effect.id, metric: effect.metric, value, source: effect.source });
    }
    if (!documented?.effects.length) unresolved.push("No documented Gorilla combat effects; no bonuses applied.");
    return { team, robotId: id, applied, unresolved };
  });
}
export function robotAssignmentCandidates(profile: PlayerProfile, reuse: RobotReuse = "unknown", limit = 32): Triple<string | null>[] {
  if (!validateProfile(profile)) throw new Error("Invalid robot/profile progression.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 64) throw new Error("Robot candidate limit must be 1–64.");
  const owned = profile.ownedRobots.slice(0, 12).map(r => r.robotId);
  const plans: Triple<string | null>[] = [];
  const seen = new Set<string>();
  function add(plan: Triple<string | null>) {
    if (plans.length >= limit || plan.some(id => id !== null && !profile.ownedRobots.some(r => r.robotId === id))) return;
    if (reuse === "unique" && new Set(plan.filter(Boolean)).size !== plan.filter(Boolean).length) return;
    const key = JSON.stringify(plan); if (!seen.has(key)) { seen.add(key); plans.push([...plan]); }
  }
  add(profile.teamRobotIds ?? [null, null, null]); add([null, null, null]);
  if (reuse === "unknown") {
    // No reuse assumption: keep manual setup, None, and one-robot testing alternatives.
    for (const id of owned) for (let team = 0; team < 3; team++) { const plan: Triple<string | null> = [null, null, null]; plan[team] = id; add(plan); }
  } else {
    const choices = [null, ...owned];
    for (const a of choices) for (const b of choices) for (const c of choices) { add([a, b, c]); if (plans.length >= limit) return plans; }
  }
  return plans;
}
