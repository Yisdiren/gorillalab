import { useState } from "react";
import portraits from "../../public/robot-portraits.json";
import { robotsEnabledForEvent } from "../robots";
import type { PlayerProfile } from "../profiles";

export const robotCatalog = portraits.robots;
export function RobotPortrait({ id }: { id: string }) {
  const src = robotCatalog.find(robot => robot.id.toLocaleLowerCase() === id.trim().toLocaleLowerCase())?.portrait;
  const [failed, setFailed] = useState<string | null>(null);
  return src && src !== failed
    ? <img src={src} alt="" width={48} height={48} onError={() => setFailed(src)} />
    : <span className="robot-fallback" role="img" aria-label={`${id} portrait unavailable`}>◇</span>;
}

type Edit = (action: (profile: PlayerProfile) => void) => void;
export function RobotOwnership({ profile, edit }: { profile: PlayerProfile; edit: Edit }) {
  return <div className="robot-grid" aria-label="Robot ownership">{robotCatalog.map(robot => {
    const owned = profile.ownedRobots.some(r => r.robotId.trim().toLocaleLowerCase() === robot.id.toLocaleLowerCase());
    return <button type="button" className="robot-choice" key={robot.id} aria-label={`Own ${robot.id}`} aria-pressed={owned} disabled={owned} onClick={() => edit(p => {
      if (!p.ownedRobots.some(r => r.robotId.trim().toLocaleLowerCase() === robot.id.toLocaleLowerCase())) p.ownedRobots.push({ robotId: robot.id, upgrades: {} });
    })}><RobotPortrait id={robot.id} /><strong>{robot.id}</strong><small>{owned ? "Owned · edit below" : "Not owned · add"}</small></button>;
  })}</div>;
}

export function RobotSelector({ profile, eventId, edit }: { profile: PlayerProfile | null; eventId: string; edit: Edit }) {
  if (!robotsEnabledForEvent(eventId)) return null;
  return <><p className="muted">Choose a portrait or None for each team. Scroll the portrait lists for more robots. Select again to clear; progression is retained. Robot reuse and combat effects remain unverified.</p><div className="robot-teams">{[0, 1, 2].map(team => <fieldset key={team} className="robot-team"><legend>Team {team + 1} robot</legend><div className="robot-grid">
    <button type="button" className="robot-choice" disabled={!profile} aria-pressed={!profile?.teamRobotIds?.[team]} onClick={() => edit(p => { p.teamRobotIds ??= [null, null, null]; p.teamRobotIds[team] = null; })}>None</button>
    {profile?.ownedRobots.map(robot => <button type="button" className="robot-choice" key={robot.robotId} aria-pressed={profile.teamRobotIds?.[team] === robot.robotId} onClick={() => edit(p => {
      p.teamRobotIds ??= [null, null, null]; p.teamRobotIds[team] = p.teamRobotIds[team] === robot.robotId ? null : robot.robotId;
    })}><RobotPortrait id={robot.robotId} /><strong>{robot.robotId}</strong><small>Owned · {profile.teamRobotIds?.[team] === robot.robotId ? "Selected" : "Select"}</small></button>)}
  </div>{!profile?.ownedRobots.length && <p className="muted">Add owned robots in Player profiles.</p>}</fieldset>)}</div></>;
}
