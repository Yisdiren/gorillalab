import { expect, it } from "vitest";
import { robotAssignmentCandidates, robotEffects, robotEvidence, type RobotEffect } from "./robots";
import { loadProfiles, migrateProfiles, saveProfile, validateProfile } from "./profiles";
import { systemProfile, systemStorage } from "./test/system-fixtures";
it("retains old profile shape and adds robot level, cores and upgrades losslessly", () => {
  const p = systemProfile(); p.ownedRobots = [{ robotId: "Fixture robot", upgrades: { armor: 2 } }];
  expect(migrateProfiles(JSON.stringify({ version: 2, profiles: [p] })).profiles[0]).toEqual(p);
  p.ownedRobots[0].level = 10; p.ownedRobots[0].cores = { module: 3, unknown: null };
  p.ownedHeroes[0].exclusiveEquipment = { name: "Fixture equipment", level: 2, upgrades: { custom: 1 } };
  const storage = systemStorage(); saveProfile(storage, p); expect(loadProfiles(storage).profiles[0]).toEqual(p);
  p.ownedRobots[0].level = -1; expect(validateProfile(p)).toBe(false);
});
it("considers only owned robots and None, without assuming a reuse rule", () => {
  const p = systemProfile(); p.ownedRobots = [{ robotId: "Fixture robot", upgrades: {} }];
  const unknown = robotAssignmentCandidates(p);
  expect(unknown).toContainEqual([null, null, null]);
  expect(unknown.every(plan => plan.filter(Boolean).length <= 1)).toBe(true);
  expect(robotAssignmentCandidates(p, "allowed", 64)).toContainEqual(["Fixture robot", "Fixture robot", "Fixture robot"]);
  expect(robotAssignmentCandidates(p, "unique", 64).every(plan => plan.filter(Boolean).length <= 1)).toBe(true);
  expect(() => robotEffects(p, ["Unowned", null, null], "cyber")).toThrow(/unowned/);
});
it("only applies exact-level Gorilla-documented effects when event and core conditions are met", () => {
  const p = systemProfile(); p.ownedRobots = [{ robotId: "Fixture robot", upgrades: {}, level: 10, cores: { module: 3 } }];
  const effect: RobotEffect = { id: "synthetic-documentation-test", metric: "synthetic-stat-not-game-data", source: "https://example.invalid/synthetic", verification: "verified-in-gorilla", events: ["cyber"], valuesByLevel: { "10": 12 }, minimumCore: { name: "module", level: 3 } };
  const evidence = [{ id: "Fixture robot", effects: [effect] }];
  expect(robotEffects(p, ["Fixture robot", null, null], "cyber", evidence)[0].applied[0].value).toBe(12);
  expect(robotEffects(p, ["Fixture robot", null, null], "space", evidence)[0].applied).toEqual([]);
  expect(robotEffects(p, ["Fixture robot", null, null], "cyber", [{ id: "Fixture robot", effects: [{ ...effect, verification: "source-reported" }] }])[0].applied).toEqual([]);
  p.ownedRobots[0].cores!.module = 2;
  expect(robotEffects(p, ["Fixture robot", null, null], "cyber", evidence)[0].applied).toEqual([]);
  p.ownedRobots[0].cores!.module = 3; p.ownedRobots[0].level = 9;
  expect(robotEffects(p, ["Fixture robot", null, null], "cyber", evidence)[0].applied).toEqual([]);
  expect(robotEvidence.every(r => r.effects.length === 0)).toBe(true);
});

it("validates data-only robot evidence updates and rejects unsupported or duplicate records", async () => {
  const { parseRobotEvidence } = await import("./robots");
  expect(() => parseRobotEvidence({ version: 1, robots: [{ id: "one", effects: [] }, { id: "one", effects: [] }] })).toThrow(/duplicate/);
  expect(() => parseRobotEvidence({ version: 1, robots: [{ id: "one", effects: [{ id: "effect", metric: "unknown", source: "javascript:alert(1)", verification: "verified-in-gorilla", events: ["cyber"], valuesByLevel: { 1: 1 } }] }] })).toThrow(/effect/);
});

it("gates robot effects for all seven events even when synthetic evidence claims every event", async () => {
  const { eventData } = await import("./data/events"); const { robotsEnabledForEvent } = await import("./robots");
  const p = systemProfile(); p.ownedRobots = [{ robotId: "Fixture robot", upgrades: {}, level: 1 }];
  const evidence = [{ id: "Fixture robot", effects: [{ id: "synthetic", metric: "not-game-data", source: "https://example.invalid/test", verification: "verified-in-gorilla" as const, events: eventData.events.map(e => e.id), valuesByLevel: { "1": 9 } }] }];
  for (const event of eventData.events) {
    const allowed = ["cyber", "warlord"].includes(event.id);
    expect(robotsEnabledForEvent(event.id)).toBe(allowed);
    const effects = robotEffects(p, ["Fixture robot", null, null], event.id, evidence);
    expect(effects[0].applied).toHaveLength(allowed ? 1 : 0);
    if (!allowed) expect(effects.every(t => t.robotId === null)).toBe(true);
  }
});
