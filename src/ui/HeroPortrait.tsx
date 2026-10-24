import { useState } from "react";
import { portraitPath } from "../data/portraits";
import type { Hero } from "../data/catalog";

export function HeroPortrait({ hero, size = "roster" }: { hero: Pick<Hero, "id" | "name">; size?: "roster" | "formation" }) {
  const src = portraitPath(hero.id);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const className = `hero-portrait portrait-${size}`;
  if (!src || failedSource === src) {
    return <span className={`${className} portrait-fallback`} role="img" aria-label={`${hero.name} portrait unavailable`} title="Portrait unavailable. No image match has been guessed.">
      <svg viewBox="0 0 32 40" fill="none" aria-hidden="true"><circle cx="16" cy="12" r="6" stroke="currentColor" strokeWidth="1.6" /><path d="M5 33v-3a11 11 0 0 1 22 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M23 5h5M25.5 2.5v5" stroke="currentColor" strokeWidth="1.3" /></svg>
    </span>;
  }
  return <img className={className} src={src} alt={`${hero.name} portrait`} width={size === "roster" ? 48 : 42} height={size === "roster" ? 60 : 53} loading="lazy" decoding="async" onError={() => setFailedSource(src)} title="Reused source artwork may include original game UI; your entered stars and levels are shown separately." />;
}
