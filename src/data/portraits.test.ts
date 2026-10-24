import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import manifest from "../../public/portraits/manifest.json";
import { heroCatalog } from "./catalog";
import { portraitPath } from "./portraits";

it("accounts for every catalog hero with a confident exact mapping or an explicit missing entry", () => {
  expect(manifest.portraits).toHaveLength(40);
  expect(manifest.missing).toHaveLength(11);
  const ids = [...manifest.portraits, ...manifest.missing].map(entry => entry.heroId);
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual(heroCatalog.map(h => h.id).sort());
  for (const portrait of manifest.portraits) {
    expect(heroCatalog.find(h => h.id === portrait.heroId)?.name).toBe(portrait.heroName);
    expect(portrait.evidence.length).toBeGreaterThan(0);
    expect(portrait.file).toMatch(/^[a-z0-9-]+\.(png|jpg)$/);
    expect(portraitPath(portrait.heroId)).toBe(`/portraits/${portrait.file}`);
  }
});
it("preserves every copied file byte-for-byte with original filenames and no extra source assets", () => {
  const directory = resolve(process.cwd(), "public/portraits");
  const images = readdirSync(directory).filter(name => /\.(png|jpg)$/i.test(name));
  expect(images.sort()).toEqual(manifest.portraits.map(p => p.file).sort());
  for (const portrait of manifest.portraits) {
    const bytes = readFileSync(resolve(directory, portrait.file));
    expect(bytes.length).toBe(portrait.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(portrait.sha256);
    if (portrait.file.endsWith("png")) expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    else expect(bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
  }
});
it("uses only documented aliases and never guesses a similar-name portrait", () => {
  expect(manifest.portraits.filter(p => p.match === "documented-alias").map(p => p.heroId).sort()).toEqual(["Mia", "Ryuichi Ito"]);
  expect(portraitPath("Ryuichi Ito")).toBe("/portraits/ryuichi.png");
  expect(portraitPath("Mia")).toBe("/portraits/mia-scarlet-pyros.png");
  expect(portraitPath("Fran & Pike")).toBe("/portraits/fran-pike.jpg");
  expect(portraitPath("Iwakado")).toBeNull();
  expect(portraitPath("Iwado")).toBeNull();
  expect(portraitPath("ada")).toBeNull();
  expect(portraitPath("unknown-id")).toBeNull();
});
it("records redistribution uncertainty rather than assigning an unsupported asset license", () => {
  expect(manifest.licenseStatus).toBe("public-redistribution-permission-unverified");
  expect(manifest.copiedWithoutModification).toBe(true);
});

