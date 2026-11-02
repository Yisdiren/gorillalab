import { expect, it } from "vitest";
import { eventData } from "./data/events";
import { absoluteToServerWall, cycleOccurrences, defaultSettings, exampleCycle, loadScheduleSettings, SCHEDULE_KEY, scheduleState } from "./server-schedule";
import { robotsEnabledForEvent } from "./robots";
import { BATTLE_KEY, emptyBattle, loadBattles } from "./battles";
import { systemStorage } from "./test/system-fixtures";

it("uses the exact current order confirmed on Servers 248 and 10004", () => {
  const expected = ["space", "wise", "primal", "cyber", "armed", "treasure", "warlord"];
  expect(eventData.events.map(e => e.id)).toEqual(expected);
  expect(cycleOccurrences(exampleCycle()).map(e => e.eventId)).toEqual(expected);
  expect(eventData.events.find(e => e.day === "Wednesday")?.id).toBe("primal");
  expect(eventData.events.find(e => e.day === "Thursday")?.id).toBe("cyber");
  expect(eventData.events.filter(e => robotsEnabledForEvent(e.id)).map(e => [e.day, e.id])).toEqual([["Thursday", "cyber"], ["Sunday", "warlord"]]);
});

it.each([248, 10004])("keeps reset, appearance and inactive weeks correct on server %s", server => {
  const settings = defaultSettings("fixture", server);
  const at = (utc: string) => scheduleState(settings, absoluteToServerWall(Date.parse(utc)));
  expect(settings.recurrence.anchorDate).toBe("2026-10-26");
  expect(settings.recurrence.intervalDays).toBe(14);
  expect(at("2026-10-29T01:59:59Z").today?.eventId).toBe("primal");
  expect(at("2026-10-29T02:00:00Z").today?.eventId).toBe("cyber");
  expect(at("2026-10-29T02:00:00Z").phase).toBe("pre-appearance");
  expect(at("2026-10-29T02:29:59Z").countdownSeconds).toBe(1);
  expect(at("2026-10-29T02:30:00Z").current?.eventId).toBe("cyber");
  expect(at("2026-11-02T02:00:00Z").phase).toBe("off-week");
  expect(at("2026-11-09T02:00:00Z").today?.eventId).toBe("space");
});

it("retains explicit saved orders and historical formation snapshots by event ID without writes", () => {
  const storage = systemStorage();
  const settings = defaultSettings("fixture", 248);
  settings.recurrence.order = ["space", "wise", "cyber", "primal", "armed", "treasure", "warlord"];
  storage.setItem(SCHEDULE_KEY, JSON.stringify({ version: 3, entries: [settings] }));
  const records = ["cyber", "primal"].map((id, index) => {
    const record = emptyBattle(`fixture-${id}`, 248, id);
    record.damage = 100 + index;
    record.date = index === 0 ? "2026-10-28" : "2026-10-29";
    record.formation = [0, 1, 2].map(team => ({ Left: `${id}-${team}-left`, Middle: `${id}-${team}-middle`, Right: `${id}-${team}-right` })) as NonNullable<typeof record.formation>;
    return record;
  });
  storage.setItem(BATTLE_KEY, JSON.stringify({ version: 1, records }));
  const schedulesBefore = storage.getItem(SCHEDULE_KEY), battlesBefore = storage.getItem(BATTLE_KEY);
  expect(loadScheduleSettings(storage, "fixture", 248)).toEqual(settings);
  expect(loadBattles(storage)).toEqual(records);
  expect(storage.getItem(SCHEDULE_KEY)).toBe(schedulesBefore);
  expect(storage.getItem(BATTLE_KEY)).toBe(battlesBefore);
});
