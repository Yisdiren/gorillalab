import { heroDatabase } from "../data/roster";
import { heroClasses, type Hero } from "../data/catalog";
// Synthetic class assignments for legacy behavior tests only. Not game data.
export const classifiedFixture: Hero[] = heroDatabase.map((hero, i) => ({ ...hero, class: { value: heroClasses[i % 3], source: "https://example.invalid/synthetic-class-fixture" } }));
