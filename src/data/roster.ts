// Legacy nine-hero fixture/API compatibility; never a player's default ownership.
import { heroCatalog } from "./catalog";
export type { Hero } from "./catalog";
const originalIds = ["Ada", "Ryuichi Ito", "Tyronn", "Mireya", "Koschevoi", "Phoenix", "Drake", "Flameborne", "Xuanming"];
export const heroDatabase = originalIds.map(id => heroCatalog.find(hero => hero.id === id)!);
export const heroes = heroCatalog.map(hero => hero.name);
