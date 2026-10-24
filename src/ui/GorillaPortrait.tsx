import { useState } from "react";
import { eventDisplayName } from "../data/events";

export const gorillaPortraits: Readonly<Record<string, string>> = {
  space: "/gorillas/space.png", wise: "/gorillas/wise.png",
  cyber: "/gorillas/cyber.png", primal: "/gorillas/primal.png",
  armed: "/gorillas/armed.png", treasure: "/gorillas/treasure.png",
  warlord: "/gorillas/warlord.png",
};

export function GorillaPortrait({ eventId }: { eventId: string }) {
  const src = gorillaPortraits[eventId];
  const [failed, setFailed] = useState<string | null>(null);
  const name = eventDisplayName(eventId);
  if (!src || failed === src) return <span className="gorilla-portrait gorilla-fallback" role="img" aria-label={`${name} portrait unavailable`}>G</span>;
  return <img className="gorilla-portrait" src={src} alt={`${name} portrait`} width={44} height={44} decoding="async" onError={() => setFailed(src)} />;
}
