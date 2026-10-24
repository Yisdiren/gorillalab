import { afterEach, expect, it, vi } from "vitest";
import { fetchCatalog, filterCatalog, heroCatalog, parseCatalog } from "./catalog";
import { createProfile, eligibleHeroes, generateForProfile } from "../profiles";

const document = () => ({ version: 1, heroes: structuredClone([...heroCatalog]) });
afterEach(() => vi.unstubAllGlobals());
it("has unique stable IDs and explicit unknown fields for every unverified hero", () => {
  expect(heroCatalog).toHaveLength(51);
  expect(new Set(heroCatalog.map(h => h.id)).size).toBe(heroCatalog.length);
  expect(parseCatalog(document()).heroes).toEqual(heroCatalog);
  for (const hero of heroCatalog) {
    if (hero.id === "Iwado") expect(hero.class?.value).toBe("Shieldbearer"); else if (["Lunarl", "Flameborne"].includes(hero.id)) expect(hero.class?.value).toBe("Bomber"); else expect(hero.class).toBeNull();
    expect(hero.seasonAvailability).toBeNull();
    expect(hero.skillMetadata).toEqual({ status: "unknown", skills: [] });
  }
  expect(heroCatalog.find(h => h.id === "Flameborne")?.sources).toContain("https://lojxlab.com/gorilla-legion/");
  expect(heroCatalog.find(h => h.id === "Vivian")?.sources).toContain("https://lojwiki.com/heroes/");
});
it("rejects duplicate IDs and duplicate names, including case variants", () => {
  const data = document();
  data.heroes.push({ ...data.heroes[0], id: "ADA", name: "Other" });
  expect(() => parseCatalog(data)).toThrow(/Duplicate/);
  data.heroes.pop();
  data.heroes.push({ ...data.heroes[0], id: "different", name: "ada" });
  expect(() => parseCatalog(data)).toThrow(/Duplicate/);
});
it("rejects unsupported schema, invalid seasons, classes, sources and unknown skills with values", () => {
  expect(() => parseCatalog({ version: 2, heroes: [] })).toThrow();
  const data = document();
  const h = data.heroes[0];
  expect(() => parseCatalog({ version: 1, heroes: [{ ...h, class: "Wizard" }] })).toThrow(/class/);
  expect(() => parseCatalog({ version: 1, heroes: [{ ...h, sources: ["javascript:alert(1)"] }] })).toThrow();
  expect(() => parseCatalog({ version: 1, heroes: [{ ...h, seasonAvailability: { from: 4, through: 1, verification: "verified", source: "https://example.com/evidence" } }] })).toThrow(/season/);
  expect(() => parseCatalog({ version: 1, heroes: [{ ...h, skillMetadata: { status: "unknown", skills: [{ id: "made-up" }] } }] })).toThrow(/Unknown/);
});
it("searches and filters names, classes and eligibility without modifying catalog", () => {
  expect(filterCatalog(heroCatalog, { query: "  rYuIcHi " }).map(h => h.id)).toEqual(["Ryuichi Ito"]);
  expect(filterCatalog(heroCatalog, { heroClass: "unknown" })).toHaveLength(48);
  expect(filterCatalog(heroCatalog, { heroClass: "Shooter" })).toEqual([]);
  expect(filterCatalog(heroCatalog, { eligibleIds: new Set(["Ada"]) }).map(h => h.id)).toEqual(["Ada"]);
  expect(heroCatalog).toHaveLength(51);
});
it("accepts data-only administrator updates and filters ownership before season eligibility", () => {
  const data = document();
  data.heroes[0].class = { value: "Shooter", source: "https://example.com/class-evidence" };
  data.heroes[0].seasonAvailability = { from: 3, through: 5, verification: "verified", source: "https://example.com/season-evidence" };
  const catalog = parseCatalog(data).heroes;
  expect(filterCatalog(catalog, { heroClass: "Shooter" }).map(h => h.id)).toEqual(["Ada"]);
  const p = createProfile("public", "Any server"); p.serverNumber = 10004; p.currentSeason = 3;
  expect(eligibleHeroes(p, catalog)).toEqual([]);
  p.ownedHeroes.push({ heroId: "Ada", stars: null, skillLevels: {}, equipment: [] });
  expect(eligibleHeroes(p, catalog).map(h => h.id)).toEqual(["Ada"]);
  p.currentSeason = 5; expect(eligibleHeroes(p, catalog)).toHaveLength(1);
  p.currentSeason = 6; expect(eligibleHeroes(p, catalog)).toEqual([]);
  p.currentSeason = 2; expect(eligibleHeroes(p, catalog)).toEqual([]);
  p.ownedHeroes.push({ heroId: "removed-from-catalog", stars: null, skillLevels: {}, equipment: [] });
  expect(eligibleHeroes(p, catalog)).toEqual([]);
  expect(() => generateForProfile(p, { mode: "Shared", ratio: { shield: 0, bomber: 0, shooter: 100 } }, {}, catalog)).toThrow(/found 0/);
});
it("loads and validates public JSON updates, rejecting invalid or unavailable responses", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => document() });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchCatalog()).toEqual(heroCatalog);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("hero-catalog.json"), { cache: "no-store" });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ version: 99 }) });
  await expect(fetchCatalog()).rejects.toThrow(/Invalid/);
  fetch.mockResolvedValue({ ok: false, status: 404 });
  await expect(fetchCatalog()).rejects.toThrow(/404/);
});



it("stores evidenced Iwado metadata once and leaves Iwakado separate", () => {
  const iwado = heroCatalog.filter(h => h.id === "Iwado");
  expect(iwado).toHaveLength(1);
  expect(iwado[0]).toMatchObject({ name: "Iwado", class: { value: "Shieldbearer" }, rarity: { value: "SR" }, aliases: [{ name: "Sumo Tyrant, Iwado", verification: "verified" }], seasonAvailability: null });
  expect(heroCatalog.find(h => h.id === "Iwakado")?.name).toBe("Iwakado");
  expect(filterCatalog(heroCatalog, { query: "Sumo Tyrant" }).map(h => h.id)).toEqual(["Iwado"]);
  expect(() => parseCatalog({ version: 1, heroes: [{ ...iwado[0], rarity: { value: "invented", source: "/catalog-evidence/iwado.md" } }] })).toThrow(/rarity/);
  expect(() => parseCatalog({ version: 1, heroes: [{ ...iwado[0], aliases: [{ name: "Iwakado", verification: "unverified" }] }] })).toThrow(/aliases/);
});
