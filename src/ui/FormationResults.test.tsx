// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormationResults, type ResultSnapshot } from "./FormationResults";
import { generateEventFormations } from "../event-engine";
import { eventData } from "../data/events";
import { classifiedFixture } from "../test/fixtures";
import { systemProfile } from "../test/system-fixtures";
afterEach(cleanup);
function snapshot(count = 5): ResultSnapshot {
  const profile = systemProfile(); profile.teamRobotIds = [null, null, null];
  return { profile, formations: generateEventFormations({ profile, event: eventData.events.find(e=>e.id==="cyber")!, catalog: classifiedFixture }).slice(0, count) };
}
it("shows one recommendation with all three teams, percentages, heroes and None robots by default", () => {
  render(<FormationResults snapshot={snapshot()} />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Unranked Formation" })).toBeTruthy();
  const first = screen.getByRole("article", { name: "Formation 1" });
  expect(within(first).getAllByRole("region", { name: /Formation 1 team/ })).toHaveLength(3);
  expect(first.querySelectorAll(".hero-position")).toHaveLength(9);
  expect(first.querySelectorAll(".team-ratios b")).toHaveLength(9);
  expect(within(first).getAllByText(/Robot: None/)).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Show 4 Alternative Formations" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("article", { name: "Formation 2" })).toBeNull();
});
it("expands and collapses alternatives while retaining rank and exact history indices", async () => {
  const user = userEvent.setup(), onLog = vi.fn(), data = snapshot();
  render(<FormationResults snapshot={data} onLog={onLog} />);
  await user.click(within(screen.getByRole("article", { name: "Formation 1" })).getByRole("button", { name: /Log an attack/ }));
  expect(onLog).toHaveBeenLastCalledWith(0);
  await user.click(screen.getByRole("button", { name: "Show 4 Alternative Formations" }));
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(screen.getByRole("button", { name: "Hide 4 Alternative Formations" }).getAttribute("aria-expanded")).toBe("true");
  for (let i = 1; i < 5; i++) {
    const card = screen.getByRole("article", { name: `Formation ${i + 1}` });
    expect(within(card).getByRole("heading", { name: `Alternative Formation ${i + 1}` })).toBeTruthy();
    expect(within(card).getByText("Score explanation & data warnings")).toBeTruthy();
    expect(card.querySelector(".score strong")?.textContent).toBe(data.formations[i].score.toLocaleString("en-US"));
    await user.click(within(card).getByRole("button", { name: /Log an attack/ }));
    expect(onLog).toHaveBeenLastCalledWith(i);
  }
  await user.click(screen.getByRole("button", { name: "Hide 4 Alternative Formations" }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
});
it.each([0, 1, 2, 3, 4])("handles %i candidates with correct alternative counts", count => {
  render(<FormationResults snapshot={snapshot(count)} />);
  if (count > 1) expect(screen.getByRole("button", { name: `Show ${count - 1} Alternative ${count === 2 ? "Formation" : "Formations"}` })).toBeTruthy();
  else expect(screen.queryByRole("button", { name: /Alternative/ })).toBeNull();
  expect(screen.queryAllByRole("article")).toHaveLength(count ? 1 : 0);
});
it("resets expanded state for a new generation, profile, event or cleared snapshot", async () => {
  const user = userEvent.setup(), data = snapshot(); const { rerender } = render(<FormationResults snapshot={data} />);
  for (const next of [structuredClone(data), { ...data, profile: { ...data.profile, id: "different" } }, { ...data, formations: data.formations.map(f => ({ ...f, event: eventData.events[1] })) }, null, data]) {
    const toggle = screen.queryByRole("button", { name: "Show 4 Alternative Formations" });
    if (toggle) await user.click(toggle);
    rerender(<FormationResults snapshot={next} />);
    expect(screen.queryByRole("button", { name: /Hide/ })).toBeNull();
    expect(screen.queryAllByRole("article")).toHaveLength(next ? 1 : 0);
  }
});

it("renders robot rows only for Cyber and Warlord, including explicit None choices", () => {
  const data = snapshot(); const { rerender } = render(<FormationResults snapshot={data} />);
  for (const event of eventData.events) {
    rerender(<FormationResults snapshot={{ ...data, formations: data.formations.map(f => ({ ...f, event })) }} />);
    const enabled = ["cyber", "warlord"].includes(event.id);
    expect(screen.queryAllByText(/Robot: None/)).toHaveLength(enabled ? 3 : 0);
    expect(screen.getByRole("heading", { name: "Unranked Formation" })).toBeTruthy();
  }
});

it("recommends only differentiated supported scores and makes insufficient guide coverage Unranked", () => {
  const data = snapshot();
  // Controlled presentation fixture: testing labels, not introducing game effects.
  data.formations[0].score = 34;
  const { rerender } = render(<FormationResults snapshot={data} />);
  expect(screen.getByRole("heading", { name: "Recommended Formation" })).toBeTruthy();
  expect(screen.getByText("Why this candidate ranks first")).toBeTruthy();
  expect(screen.getByText(/highest score among the returned candidates/)).toBeTruthy();
  const partial = structuredClone(data); partial.formations[0].communityRanking![0].tier = null;
  rerender(<FormationResults snapshot={partial} />);
  expect(screen.getByRole("heading", { name: "Unranked Formation" })).toBeTruthy();
  expect(screen.getByText(/Unknown does not mean weak/)).toBeTruthy();
});

it("uses game lane order and keeps every original hero slot in recommended and alternative cards", async () => {
  const data = snapshot(), before = structuredClone(data), user = userEvent.setup();
  render(<FormationResults snapshot={data} />);
  await user.click(screen.getByRole("button", { name: "Show 4 Alternative Formations" }));
  for (let rank = 0; rank < data.formations.length; rank++) {
    const card = screen.getByRole("article", { name: `Formation ${rank + 1}` });
    const teams = within(card).getAllByRole("region", { name: /Formation \d team/ });
    expect(teams.map(t => within(t).getByRole("heading").textContent)).toEqual(["Team 1 — TOP IN GAME", "Team 2 — MIDDLE IN GAME", "Team 3 — BOTTOM IN GAME"]);
    teams.forEach((team, index) => {
      expect([...team.querySelectorAll(".position-name")].map(e => e.textContent)).toEqual(["Left", "Middle", "Right"]);
      expect([...team.querySelectorAll(".hero-position strong")].map(e => e.textContent)).toEqual(["Left", "Middle", "Right"].map(position => data.formations[rank].teams[index].heroes[position as "Left" | "Middle" | "Right"].name));
      expect(team.querySelector(".team-hero-slots")?.nextElementSibling?.className).toBe("team-ratios");
      expect(team.querySelectorAll(".team-ratios b")).toHaveLength(3);
      expect(within(team).getAllByRole("img")).toHaveLength(3);
    });
  }
  expect(data).toEqual(before);
});
it.each([320, 390, 768, 1440])("preserves three horizontal slot groups and vertical team DOM order at viewport %i", width => {
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  try {
    render(<FormationResults snapshot={snapshot()} />);
    const teams = screen.getAllByRole("region", { name: /Formation 1 team/ });
    expect(teams).toHaveLength(3);
    teams.forEach((team, i) => {
      expect(team.getAttribute("aria-label")).toBe(`Formation 1 team ${i + 1}`);
      expect(team.querySelector(".team-hero-slots")?.children).toHaveLength(3);
      expect([...team.querySelectorAll(".position-name")].map(e => e.textContent)).toEqual(["Left", "Middle", "Right"]);
    });
  } finally { Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth }); }
});

it("renders compact ratios without bars and keeps stars beside each hero identity", () => {
  const data = snapshot(), before = structuredClone(data);
  render(<FormationResults snapshot={data} />);
  const first = screen.getByRole("article", { name: "Formation 1" });
  expect(first.querySelectorAll(".ratio-strip")).toHaveLength(0);
  const ratios = within(first).getAllByLabelText("Troop percentages");
  expect(ratios).toHaveLength(3);
  expect([...ratios[0].querySelectorAll("span")].map(n => n.textContent)).toEqual(["Shieldbearer 0%", "Bomber 10%", "Shooter 90%"]);
  first.querySelectorAll(".hero-position").forEach(slot => {
    expect(slot.querySelector(".formation-hero-identity .stars")).toBeTruthy();
    expect(slot.querySelector(".hero-class")).toBeTruthy();
  });
  expect(data).toEqual(before);
});

it("renders canonical event names for legacy formation labels in all seven events", () => {
  const data = snapshot(), names = ["Space Gorilla", "Wise Gorilla", "Cyber Gorilla", "Primal Gorilla", "Armed Gorilla", "Treasure Gorilla", "Gorilla Warlord"];
  const { rerender } = render(<FormationResults snapshot={null} />);
  eventData.events.forEach((event, i) => {
    const legacy = { ...data, formations: data.formations.map(f => ({ ...f, event: { ...event, name: "Legacy category-appended title" } })) };
    rerender(<FormationResults snapshot={legacy} />);
    expect(screen.getByText(`${names[i]} · ${data.profile.name}`, { exact: true })).toBeTruthy();
    expect(screen.queryByText(/Legacy category-appended title/)).toBeNull();
  });
});
