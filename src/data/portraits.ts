import manifest from "../../public/portraits/manifest.json";

// Exact stable GorillaLab IDs only. No slug guesses, fuzzy names, or inferred aliases.
const portraitFiles = new Map(manifest.portraits.map(portrait => [portrait.heroId, portrait.file]));
export function portraitPath(heroId: string): string | null {
  const file = portraitFiles.get(heroId);
  return file ? `${import.meta.env.BASE_URL}portraits/${encodeURIComponent(file)}` : null;
}
