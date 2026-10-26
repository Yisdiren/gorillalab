// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RobotManager } from "./PlayerManagement";
import { RobotPortrait, RobotSelector } from "./RobotSelector";
import { createProfile, loadProfiles, migrateProfiles, saveProfile, STORAGE_KEY, type PlayerProfile } from "../profiles";

afterEach(cleanup);
it.each(["cyber", "warlord"])("keeps Dauntless selectable with a fallback in %s", async eventId => {
  const profile = createProfile("dauntless-fixture", "Dauntless fixture");
  profile.ownedRobots = [{ robotId: "Dauntless", upgrades: {} }];
  let next = structuredClone(profile);
  render(<RobotSelector profile={profile} eventId={eventId} edit={action => action(next)} />);
  const button = within(screen.getByRole("group", { name: "Team 1 robot" })).getByRole("button", { name: /Dauntless/ });
  expect(within(button).getByRole("img", { name: "Dauntless portrait unavailable" })).toBeTruthy();
  expect(button.querySelector("img")).toBeNull();
  await userEvent.setup().click(button);
  expect(next.teamRobotIds).toEqual(["Dauntless", null, null]);
  expect(next.ownedRobots).toEqual(profile.ownedRobots);
});

it.each(["cyber", "warlord"])("resolves Bastion to its clean replacement portrait in %s", eventId => {
  const profile = createProfile("bastion-fixture", "Bastion fixture");
  profile.ownedRobots = [{ robotId: "Bastion", level: 50, upgrades: { module: 3 } }];
  profile.teamRobotIds = ["Bastion", null, null];
  const before = structuredClone(profile);
  render(<RobotSelector profile={profile} eventId={eventId} edit={() => { throw new Error("Rendering must not edit a profile"); }} />);
  const button = within(screen.getByRole("group", { name: "Team 1 robot" })).getByRole("button", { name: /Bastion/ });
  expect(button.querySelector("img")?.getAttribute("src")).toBe("/robots/bastion.png");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("img", { name: "Bastion portrait unavailable" })).toBeNull();
  expect(profile).toEqual(before);
});

it("selects and deselects with the keyboard, retaining progression across save/reload and isolating profiles", async () => {
  const p = createProfile("fixture", "Stiletto fixture"); p.serverNumber = 248;
  p.ownedRobots = [{ robotId: "Ranger", level: 12, cores: { alpha: 3 }, upgrades: { module: 7 } }];
  const other = createProfile("other", "Other fixture");
  const values = new Map([[STORAGE_KEY, JSON.stringify({ version: 2, profiles: [p, other] })]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  function Harness() {
    const [profile, setProfile] = useState(p);
    return <><RobotSelector profile={profile} eventId="cyber" edit={action => setProfile(prev => { const next = structuredClone(prev); action(next); return next; })} /><button onClick={() => saveProfile(storage, profile)}>Save</button></>;
  }
  const user = userEvent.setup(); render(<Harness />);
  const ranger = within(screen.getByRole("group", { name: "Team 1 robot" })).getByRole("button", { name: /Ranger/ });
  await user.tab(); await user.tab(); expect(document.activeElement).toBe(ranger);
  await user.keyboard(" "); expect(ranger.getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByText("Save"));
  expect(loadProfiles(storage).profiles[0].teamRobotIds).toEqual(["Ranger", null, null]);
  await user.click(ranger); await user.click(screen.getByText("Save"));
  expect(loadProfiles(storage).profiles[0].teamRobotIds).toEqual([null, null, null]);
  expect(loadProfiles(storage).profiles[0].ownedRobots).toEqual(p.ownedRobots);
  expect(loadProfiles(storage).profiles[1]).toEqual(other);
});

it("adds catalog ownership once without duplicating saved names or altering progression", async () => {
  const p = createProfile("fixture", "Fixture");
  p.ownedRobots = [{ robotId: "Ranger", level: 10, upgrades: { module: 3 } }];
  let latest: PlayerProfile = p;
  function Harness() {
    const [profile, setProfile] = useState(p);
    return <RobotManager profile={profile} edit={action => setProfile(prev => { const next = structuredClone(prev); action(next); latest = next; return next; })} />;
  }
  const user = userEvent.setup(); render(<Harness />);
  expect((screen.getByRole("button", { name: "Own Ranger" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Own Halo" }));
  expect(latest.ownedRobots).toEqual([...p.ownedRobots, { robotId: "Halo", upgrades: {} }]);
});

it("falls back for missing and failed portraits", () => {
  const view = render(<RobotPortrait id="Ranger" />);
  fireEvent.error(view.container.querySelector("img")!);
  expect(screen.getByRole("img", { name: "Ranger portrait unavailable" })).toBeTruthy();
  view.rerender(<RobotPortrait id="Dauntless" />);
  expect(screen.getByRole("img", { name: "Dauntless portrait unavailable" })).toBeTruthy();
});

it("retains robot progression and assignments in legacy migration without writing storage", () => {
  const raw = JSON.stringify({ version: 1, profiles: [{ id: "old", name: "Legacy", ownedHeroIds: [], ownedRobots: [{ robotId: "Ranger", level: 4, upgrades: { module: 2 } }], teamRobotIds: ["Ranger", null, null] }] });
  const migrated = migrateProfiles(raw).profiles[0];
  expect(migrated.ownedRobots).toEqual(JSON.parse(raw).profiles[0].ownedRobots);
  expect(migrated.teamRobotIds).toEqual(["Ranger", null, null]);
});
