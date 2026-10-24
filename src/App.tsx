import { ServerSchedule } from "./ui/ServerSchedule";
import { robotsEnabledForEvent } from "./robots";
import { useEffect, useRef, useState } from "react";
import { fetchCatalog, filterCatalog, heroCatalog, heroClasses, type Hero, type HeroClass } from "./data/catalog";
import { eventData, eventDisplayName, fetchEvents } from "./data/events";
import { validRatio, type Triple, type TroopRatio } from "./engine";
import { generateEventFormations } from "./event-engine";
import { createProfile, deleteProfile, eligibleHeroes, eligibilityReport, loadProfiles, saveProfile, validateProfile, type PlayerProfile, type Storage } from "./profiles";
import { FormationResults, type ResultSnapshot } from "./ui/FormationResults";
import { HeroProgress, RobotManager } from "./ui/PlayerManagement";
import { RosterImporter } from "./ui/RosterImporter";
import { HeroPortrait } from "./ui/HeroPortrait";
import { catalogWithEvidence, communityReference } from "./data/evidence";
import { OptimizationPanel } from "./ui/OptimizationPanel";
import { TroopRatioTesting } from "./ui/TroopRatioTesting";
import { applyRatioToSnapshot } from "./ratio-testing";
import { BattleHistory, type BattleHistoryStart } from "./ui/BattleHistory";

const browserStorage: Storage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
const kinds = ["shield", "bomber", "shooter"] as const;
const kindName = { shield: "Shieldbearer", bomber: "Bomber", shooter: "Shooter" };
const categoryName: Record<string, string> = { satellite: "Satellite", technology: "Technology", tome: "Tome", "power-armor": "Prisoner Power Armor", "hero-equipment": "Hero Equipment", collection: "Trove Collection" };
const cloneRatios = (ratio: TroopRatio): Triple<TroopRatio> => [{ ...ratio }, { ...ratio }, { ...ratio }];
type View = "generator" | "heroes" | "profiles" | "history";

export default function App({ storage = browserStorage }: { storage?: Storage }) {
  const [initial] = useState(() => { try { return { profiles: loadProfiles(storage).profiles, error: "" }; } catch (e) { return { profiles: [], error: String(e) }; } });
  const [profiles, setProfiles] = useState(initial.profiles);
  const [active, setActive] = useState<PlayerProfile | null>(() => initial.profiles[0] ? structuredClone(initial.profiles[0]) : null);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<View>("generator");
  const [catalog, setCatalog] = useState<readonly Hero[]>(() => catalogWithEvidence(heroCatalog));
  const [events, setEvents] = useState(eventData);
  const [loadWarning, setLoadWarning] = useState("");
  const [message, setMessage] = useState(initial.error);
  const [error, setError] = useState("");
  const [eventId, setEventId] = useState(eventData.events[0].id);
  const selectedEvent = events.events.find(e => e.id === eventId) ?? events.events[0];
  const [mode, setMode] = useState<"Shared" | "Independent">("Shared");
  const [ratios, setRatios] = useState(() => cloneRatios(eventData.events[0].startingRatio));
  const [communityEnabled, setCommunityEnabled] = useState(true);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [historyStart, setHistoryStart] = useState<BattleHistoryStart | null>(null);
  const [historyVisit, setHistoryVisit] = useState(0);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<HeroClass | "all" | "unknown">("all");
  const [ownership, setOwnership] = useState("all");
  useEffect(() => {
    let live = true;
    Promise.allSettled([fetchCatalog(), fetchEvents()]).then(([catalogResult, eventResult]) => {
      if (!live) return;
      const warnings: string[] = [];
      if (catalogResult.status === "fulfilled") setCatalog(catalogWithEvidence(catalogResult.value)); else warnings.push("Catalog update unavailable; using bundled data.");
      if (eventResult.status === "fulfilled") setEvents(eventResult.value); else warnings.push("Event update unavailable; using bundled schedule.");
      setLoadWarning(warnings.join(" "));
      revision.current++; setSnapshot(null);
    });
    return () => { live = false; revision.current++; };
  }, []);
  function invalidate() { revision.current++; setSnapshot(null); setError(""); }
  function edit(action: (profile: PlayerProfile) => void) {
    setActive(previous => { if (!previous) return previous; const next = structuredClone(previous); action(next); return next; });
    setDirty(true); invalidate(); setMessage("");
  }
  function newProfile() { setActive(createProfile(crypto.randomUUID(), "New player")); setDirty(true); setView("profiles"); invalidate(); setMessage("New profile. Add your account details and select the heroes you own."); }
  function chooseProfile(id: string) { const p = profiles.find(item => item.id === id); setActive(p ? structuredClone(p) : null); setDirty(false); invalidate(); setMessage("Saved profile loaded. Unsaved edits from the previous selection were not saved."); }
  function save() {
    try { if (!active) return; setProfiles(saveProfile(storage, active).profiles); setDirty(false); setMessage("Profile saved in this browser."); setError(""); } catch (e) { setError(String(e)); }
  }
  const profileValid = active !== null && validateProfile(active);
  const eligible = profileValid ? eligibleHeroes(active, catalog) : [];
  const eligibleIds = new Set(eligible.map(h => h.id));
  const ownedIds = new Set(active?.ownedHeroes.map(h => h.heroId) ?? []);
  const classCounts = heroClasses.map(c => eligible.filter(h => h.class?.value === c).length);
  const ready = profileValid && classCounts.every(count => count >= 3);
  const shown = filterCatalog(catalog, { query }).filter(h => {
    const effectiveClass = active?.classOverrides?.[h.id]?.value ?? h.class?.value ?? "unknown";
    return (classFilter === "all" || effectiveClass === classFilter) && (ownership === "all" || ownership === "owned" && ownedIds.has(h.id) || ownership === "unowned" && !ownedIds.has(h.id) || ownership === "eligible" && eligibleIds.has(h.id));
  });
  const effectiveRatio = (team: number) => mode === "Shared" ? ratios[0] : ratios[team];
  function changeMode(next: "Shared" | "Independent") { setMode(next); setRatios(cloneRatios(ratios[0])); invalidate(); }
  async function generate() {
    setError("");
    if (!active) { setError("Create or select a player profile first."); return; }
    if (!profileValid) { setError("Complete a profile name and use nonnegative whole numbers for account progression."); return; }
    const token = ++revision.current;
    setBusy(true); setSnapshot(null);
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const formations = generateEventFormations({ profile: active, event: selectedEvent, catalog, ratios: mode === "Shared" ? { mode, ratio: ratios[0] } : { mode, ratios }, useCommunityRankings: communityEnabled });
      if (revision.current === token) { setSnapshot({ formations, profile: structuredClone(active), ratioModes: formations.map(() => mode === "Shared" ? { mode, ratio: structuredClone(ratios[0]) } : { mode, ratios: structuredClone(ratios) }) }); setMessage(communityEnabled ? "Five formations found using provisional community ordinal points, not damage." : "Guide rankings disabled. Candidates use only explicitly configured heuristic points; tied or insufficient results are Unranked."); }
    } catch (e) { if (revision.current === token) setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <a href="#main-content" className="brand" aria-label="GorillaLab home" onClick={() => setView("generator")}><span className="brand-mark" aria-hidden="true">G<span>•</span></span><span>GORILLA<span className="brand-light">LAB</span><small>LANDS OF JAIL</small></span></a>
      <div className="nav-label">YOUR COMMAND CENTER</div>
      <nav aria-label="Main navigation">{([["generator", "◈", "Formation generator"], ["heroes", "◇", "Heroes & progression"], ["profiles", "▤", "Player profiles"], ["history", "≋", "Battle history"]] as const).map(([id, icon, title]) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => { if (id === "history") { setHistoryStart(null); setHistoryVisit(v => v + 1); } setView(id); }}><span aria-hidden="true">{icon}</span>{title}</button>)}</nav>
      <div className="sidebar-bottom"><span className="online-dot" /> EVERY SERVER. EVERY ALLIANCE.<p>Your account. Your formations.<br />Saved locally, in your browser.</p><div className="version">GORILLA LEGION · 7 EVENTS</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div><span className="online-dot" /> PUBLIC PLAYER TOOL <span className="topbar-divider">/</span> {view === "generator" ? "Formation generator" : view === "heroes" ? "Hero catalog" : view === "history" ? "Battle history" : "Profile management"}</div><span className="local-badge">◉ Local profiles</span></header>
      <main id="main-content">
        <div className="page-heading"><div><span className="eyebrow">GORILLA LEGION / ATTACK PLANNER</span><h1>{view === "generator" ? <>Build your next <span>Gorilla attack.</span></> : view === "heroes" ? <>Your heroes. <span>Your lineup.</span></> : view === "history" ? <>Test your changes. <span>Keep the evidence.</span></> : <>Every account. <span>One command center.</span></>}</h1><p>{view === "generator" ? "Seven events. Three teams. A formation built around the heroes you actually own." : view === "heroes" ? "Select your owned heroes and enter their progression. Missing data is a setup gap, never a power rating." : view === "history" ? "Log observed damage, preserve setup snapshots, and compare records within one server." : "Keep separate profiles for every account and server. Your data stays in this browser."}</p></div><div className="header-stats"><div><strong>07</strong><span>EVENTS</span></div><div><strong>03</strong><span>TEAMS</span></div><div><strong>09</strong><span>HEROES</span></div></div></div>
        {loadWarning && <div className="notice warning" role="status">{loadWarning}</div>}
        {initial.error && <div className="notice warning">Saved profiles could not be loaded. Existing data will not be overwritten: {initial.error}</div>}
        {message && <p className="status-message" role="status">{message}</p>}
        {error && <div className="notice error" role="alert">{error}</div>}
        {view === "generator" && <>
          <ServerSchedule key={`${active?.id}:${active?.serverNumber}`} profile={active} storage={storage} />
          <section className="event-section" aria-labelledby="events-title"><div className="section-heading"><div><span className="step-number">01</span><h2 id="events-title">Choose your event</h2></div><span className="muted">Usual order during a configured Gorilla round.</span></div><div className="event-grid" role="group" aria-label="Gorilla event">{events.events.map((event, i) => <button key={event.id} className={`event-button ${selectedEvent.id === event.id ? "selected" : ""}`} aria-pressed={selectedEvent.id === event.id} aria-label={`${event.day} ${eventDisplayName(event.id)}`} onClick={() => { setEventId(event.id); invalidate(); }}><span className="event-day">{event.day.slice(0, 3)}</span><span className="event-glyph" aria-hidden="true">{({space:"◎",wise:"⌘",cyber:"⬡",primal:"▥",armed:"⛨",treasure:"◇",warlord:"♜"} as Record<string,string>)[event.id]}</span><strong>{eventDisplayName(event.id)}</strong><span className="event-bonus">{event.day === "Sunday" ? "6 NORMAL BONUSES" : `+${event.bonuses[0].reportedBoostPercent}% BONUS`}</span></button>)}</div></section>
          <div className="generator-layout"><div className="generator-main">
            <section className="panel event-overview"><div className="event-overview-top"><div><span className="eyebrow">USUAL {selectedEvent.day.toUpperCase()}</span><h2>{eventDisplayName(selectedEvent.id)}</h2></div><span className="badge amber">Guide-reported</span></div><div className="bonus-list">{selectedEvent.bonuses.map(b => <div key={b.category}><span>{categoryName[b.category]}</span><strong>{b.strength === "normal" ? "Normal strength" : `+${b.reportedBoostPercent}%`}</strong></div>)}</div><p className="muted">{selectedEvent.day === "Sunday" ? "All six categories at normal strength. No daily +1000% boost." : "Reported category bonus. Base effects and stacking mechanics are unknown."} Bonus labels are not damage multipliers.</p><div className="recommendation"><div><span>STARTING RECOMMENDATION</span><strong>{selectedEvent.startingRatio.shield}<i>/</i>{selectedEvent.startingRatio.bomber}<i>/</i>{selectedEvent.startingRatio.shooter}</strong><small>Shield / Bomber / Shooter · not a proven optimum</small></div><button className="secondary" onClick={() => { setRatios(cloneRatios(selectedEvent.startingRatio)); invalidate(); }}>Use starting ratio ↗</button></div></section>
            <section className="panel" aria-labelledby="ratios-title"><div className="panel-heading"><div><span className="step-number">02</span><h2 id="ratios-title">Troop composition</h2></div><div className="segmented" role="group" aria-label="Troop ratio mode">{(["Shared", "Independent"] as const).map(value => <button key={value} aria-pressed={mode === value} className={mode === value ? "selected" : ""} onClick={() => changeMode(value)}>{value}</button>)}</div></div><p className="muted">{mode === "Shared" ? "One percentage ratio for all three teams." : "Set a separate ratio for each team."} Switching modes uses Team 1's ratio as the starting value.</p>
              {(mode === "Shared" ? [0] : [0, 1, 2]).map(team => { const ratio = effectiveRatio(team); const total = ratio.shield + ratio.bomber + ratio.shooter; return <fieldset className="ratio-editor" key={`${mode}-${team}`}><legend>{mode === "Shared" ? "All teams" : `Team ${team + 1}`}</legend><div className="ratio-inputs">{kinds.map(kind => <label key={kind}><span className={`class-dot ${kind}`} />{kindName[kind]}<div className="percent-input"><input aria-label={`${mode === "Shared" ? "Shared" : `Team ${team + 1}`} ${kindName[kind]} percentage`} type="number" min="0" max="100" step="any" value={ratio[kind]} onChange={e => { setRatios(previous => previous.map((value, i) => i === team ? { ...value, [kind]: Number(e.target.value) } : value) as Triple<TroopRatio>); invalidate(); }} /><span>%</span></div></label>)}</div><div className="ratio-strip"><span className="shield-bar" style={{ flexGrow: Math.max(0, ratio.shield) }} /><span className="bomber-bar" style={{ flexGrow: Math.max(0, ratio.bomber) }} /><span className="shooter-bar" style={{ flexGrow: Math.max(0, ratio.shooter) }} /></div><p className={validRatio(ratio) ? "ratio-valid" : "ratio-invalid"}>{total}% total {validRatio(ratio) ? "✓" : "— must total exactly 100%"}</p></fieldset>; })}
            </section>
            <section className="panel" aria-labelledby="troops-title"><h2 id="troops-title">Team support & evidence</h2>{!robotsEnabledForEvent(selectedEvent.id) && <p className="muted">Robots are used only in Cyber Gorilla and Gorilla Warlord. Saved robot ownership and upgrades are retained but do not apply to this event.</p>}{robotsEnabledForEvent(selectedEvent.id) && <div className="troop-entry-grid">{[0, 1, 2].map(team => <fieldset key={team} className="troop-entry"><legend>Team {team + 1}</legend><label>Robot assignment<select aria-label={`Team ${team + 1} robot`} disabled={!active} value={active?.teamRobotIds?.[team] ?? ""} onChange={e => edit(p => { p.teamRobotIds ??= [null, null, null]; p.teamRobotIds[team] = e.target.value || null; })}><option value="">None</option>{active?.ownedRobots.map(r => <option key={r.robotId}>{r.robotId}</option>)}</select></label></fieldset>)}</div>}
              <div className="notice warning"><strong>Count-dependent evidence warning</strong><p>Ada’s possible 1,000-Shieldbearer requirement is pending verification. Percentages cannot establish an actual troop count. This condition is not checked or assumed satisfied, and no skill benefit is applied.</p></div>
              <label className="checkbox-label"><input type="checkbox" checked={communityEnabled} onChange={e => { setCommunityEnabled(e.target.checked); invalidate(); }} /> Use provisional Gorilla Legion hero tiers (ordinal points, not combat effects)</label><p className="muted">Community opinion is separate from source-observed skill metadata. Unranked heroes are not assumed weak. <a href={communityReference.source} target="_blank" rel="noreferrer">Reference</a></p><div className="generate-row"><div><strong>Ready to plan your attack?</strong><p>Three legal teams. Nine unique heroes.</p></div><button className="primary generate-button" disabled={busy || !active} onClick={generate}>{busy ? "Finding formations…" : "Generate Formations"}<span aria-hidden="true">↗</span></button></div>
            </section>
          </div><aside className="setup-sidebar"><section className="panel profile-summary"><span className="eyebrow">ACTIVE PLAYER PROFILE</span><div className="profile-avatar" aria-hidden="true">{active?.name.slice(0, 2).toUpperCase() || "?"}</div><h2>{active?.name || "Make it your lineup."}</h2><p className="muted">{active ? `Server ${active.serverNumber ?? "unknown"} · Season ${active.currentSeason ?? "unknown"}` : "Create a profile and select the heroes you own."}</p>{profiles.length > 0 && <label>Saved profile<select aria-label="Select saved profile" value={profiles.some(p => p.id === active?.id) ? active!.id : ""} onChange={e => chooseProfile(e.target.value)}><option value="" disabled>Select profile</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<button className="secondary full-width" onClick={() => active ? setView("profiles") : newProfile()}>{active ? "Manage profile" : "+ Create player profile"}</button>{active && <button className="text-button full-width" onClick={() => setView("heroes")}>Manage owned heroes →</button>}{dirty && <span className="unsaved">Unsaved profile changes</span>}</section>
            <section className="panel readiness"><span className="eyebrow">ATTACK READINESS</span><h3>{ready ? "Heroes ready to deploy" : "Complete your lineup"}</h3><div className="readiness-row"><span>Owned heroes</span><strong>{ownedIds.size}</strong></div><div className="readiness-row"><span>Candidate heroes (includes unknown seasons)</span><strong>{eligible.length}</strong></div>{heroClasses.map((c, i) => <div key={c} className="readiness-row"><span>{c}</span><strong className={classCounts[i] >= 3 ? "positive" : ""}>{classCounts[i]} / 3</strong></div>)}<details className="source-details"><summary>Owned hero eligibility audit</summary>{active && profileValid && eligibilityReport(active, catalog).map(row => <p key={row.heroId}>{row.heroId}: {row.reason}{row.hero && !row.hero.class ? " Class unknown; cannot assign a team class until configured." : ""}</p>)}</details><p className="muted">Each team needs one hero of each class. Unknown season or class data is incomplete information, not a weak hero.</p></section>
            <div className="data-note"><span aria-hidden="true">ⓘ</span><div><strong>Built on transparent data.</strong><p>Heuristic points are not damage. Daily boosts, skill effects, and combat mechanics remain unverified.</p></div></div>
          </aside></div>
          <OptimizationPanel key={`${active?.id}:${selectedEvent.id}:${mode}:${JSON.stringify(ratios)}:${communityEnabled}`} profile={active} event={selectedEvent} catalog={catalog} ratios={mode === "Shared" ? { mode, ratio: ratios[0] } : { mode, ratios }} community={communityEnabled} storage={storage} apply={plan => { setMode(plan.ratios.mode); setRatios(plan.ratios.mode === "Shared" ? cloneRatios(plan.ratios.ratio) : structuredClone(plan.ratios.ratios)); if (robotsEnabledForEvent(selectedEvent.id)) edit(p => { p.teamRobotIds = [...plan.robots]; }); else invalidate(); setMessage("Percentage setup applied. Count-dependent skill conditions remain unverified. No predicted damage is claimed."); }} />
          <TroopRatioTesting key={`${active?.id}:${selectedEvent.id}`} profile={active} event={selectedEvent} storage={storage} current={mode === "Shared" ? {mode,ratio:ratios[0]} : {mode,ratios}} snapshot={snapshot} apply={(value,index) => { if (!snapshot) return; const next = applyRatioToSnapshot(snapshot,index,value); revision.current++; setMode(value.mode); setRatios(value.mode === "Shared" ? cloneRatios(value.ratio) : structuredClone(value.ratios)); setSnapshot(next); setMessage("Experimental ratio applied to the selected formation only. Heroes are unchanged; nothing was saved."); }} />
          <FormationResults snapshot={snapshot} onLog={index => { if (!snapshot) return; setHistoryStart({ formationIndex: index, eventId: snapshot.formations[index].event.id, server: snapshot.profile.serverNumber }); setHistoryVisit(v => v + 1); setView("history"); }} />
        </>}
        {view === "history" && <BattleHistory key={historyVisit} storage={storage} profile={active} snapshot={snapshot} start={historyStart} />}
        {view === "profiles" && <div className="management-layout"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">BROWSER STORAGE</span><h2>Player profiles</h2></div><button className="secondary" onClick={newProfile}>+ New profile</button></div><p className="muted">Save before switching profiles. Unsaved edits are not kept when selecting another profile. Clearing browser storage removes saved profiles.</p><div className="profile-chips">{profiles.map(p => <button key={p.id} className={`profile-chip ${p.id === active?.id ? "selected" : ""}`} onClick={() => chooseProfile(p.id)}><strong>{p.name}</strong><span>Server {p.serverNumber ?? "?"} · S{p.currentSeason ?? "?"}</span></button>)}</div>{!active ? <div className="empty-state compact"><h3>Your account belongs here.</h3><p>Create a profile for any server or alliance.</p><button className="primary" onClick={newProfile}>Create player profile</button></div> : <><div className="field-grid"><label>Profile name<input value={active.name} onChange={e => edit(p => { p.name = e.target.value; })} /></label><label>Server number<input type="number" min="0" step="1" placeholder="Unknown" value={active.serverNumber ?? ""} onChange={e => edit(p => { p.serverNumber = e.target.value === "" ? null : Number(e.target.value); })} /></label><label>Current season<input type="number" min="0" step="1" placeholder="Unknown" value={active.currentSeason ?? ""} onChange={e => edit(p => { p.currentSeason = e.target.value === "" ? null : Number(e.target.value); })} /></label></div><div className="button-row"><button className="primary" onClick={save}>Save profile</button><button className="secondary" onClick={() => setView("heroes")}>Manage heroes →</button><button className="text-button danger" onClick={() => { try { setProfiles(deleteProfile(storage, active.id).profiles); setActive(null); setDirty(false); invalidate(); setMessage("Profile deleted from this browser."); } catch (e) { setError(String(e)); } }}>Delete profile</button>{dirty && <span className="unsaved">Unsaved changes</span>}</div></>}</section>{active && <><RosterImporter key={`roster-${active.id}`} profile={active} catalog={catalog} commit={next => { const saved = saveProfile(storage, next); setProfiles(saved.profiles); setActive(next); setDirty(false); invalidate(); setMessage("Roster imported and profile saved in this browser."); }} /><RobotManager key={`robots-${active.id}`} profile={active} edit={edit} /></>}</div>}
        {view === "heroes" && <>
          <section className="panel catalog-toolbar"><div className="panel-heading"><div><span className="eyebrow">GLOBAL HERO CATALOG</span><h2>Build your owned roster</h2></div><span className="badge">{catalog.length} catalog entries</span></div><p className="muted">Catalog entries are not assumed owned. Class/season and selected skill records are checked against community game-screen references and labeled source-observed. Unreviewed fields stay unknown. Player overrides are unverified. Portraits may contain original game UI levels; your entered progression is displayed separately. Flameborne is a guide-listed Bomber with unknown season and detailed combat data.</p>{active ? <div className="active-roster"><span>Editing <strong>{active.name}</strong> · Server {active.serverNumber ?? "unknown"} · Season {active.currentSeason ?? "unknown"}</span><button className="secondary" onClick={save}>Save profile</button>{dirty && <span className="unsaved">Unsaved changes</span>}</div> : <div className="notice"><p>Select or create a player profile to record ownership.</p><button className="primary" onClick={newProfile}>Create player profile</button></div>}<div className="catalog-filters"><label>Search heroes<input type="search" value={query} placeholder="Search by hero name…" onChange={e => setQuery(e.target.value)} /></label><label>Hero class<select value={classFilter} onChange={e => setClassFilter(e.target.value as typeof classFilter)}><option value="all">All classes</option><option value="unknown">Class unknown</option>{heroClasses.map(c => <option key={c}>{c}</option>)}</select></label><label>Ownership & eligibility<select value={ownership} onChange={e => setOwnership(e.target.value)}><option value="all">All heroes</option><option value="owned">Owned</option><option value="unowned">Not owned</option><option value="eligible">Owned candidates (unknown seasons included)</option></select></label></div><span className="muted">{shown.length} heroes shown · {ownedIds.size} owned · {eligible.length} candidate heroes (unknown seasons included)</span></section>
          <div className="catalog-grid">{shown.map(hero => { const owned = active?.ownedHeroes.find(h => h.heroId === hero.id); const c = active?.classOverrides?.[hero.id]?.value ?? hero.class?.value; return <article className={`catalog-card ${owned ? "owned" : ""}`} key={hero.id}><div className="catalog-card-heading"><HeroPortrait hero={hero} /><div><h3>{hero.name}</h3><span className="muted">{c ? `${c}${active?.classOverrides?.[hero.id] ? " · player-entered" : ""}` : "Class unknown"}</span></div><label className="owned-toggle"><input type="checkbox" aria-label={`Own ${hero.name}`} disabled={!active} checked={!!owned} onChange={e => edit(p => { p.ownedHeroes = e.target.checked ? [...p.ownedHeroes, { heroId: hero.id, stars: null, skillLevels: {}, equipment: [] }] : p.ownedHeroes.filter(h => h.heroId !== hero.id); })} />Owned</label></div><div className="hero-metadata"><span>{owned?.stars == null ? "Stars unknown" : `${owned.stars} ★`}</span><span>{owned ? eligibleIds.has(hero.id) ? "Season eligible" : "Season data missing / ineligible" : "Not in your roster"}</span></div>{owned && active && <details><summary>Edit progression & eligibility</summary><HeroProgress key={`${active.id}:${hero.id}`} hero={hero} owned={owned} profile={active} edit={edit} /></details>}</article>; })}</div>{shown.length === 0 && <div className="empty-state compact"><h3>No matching heroes</h3><p>Try another name or remove a filter. This says nothing about hero strength.</p></div>}
        </>}
        <footer className="page-footer"><span>GORILLALAB <span className="muted">/ Lands of Jail player tool</span></span><span>All servers · All alliances · No assumed damage</span></footer>
      </main>
    </div>
  </div>;
}






