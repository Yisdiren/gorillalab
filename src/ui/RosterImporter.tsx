import { useState } from "react";
import { heroClasses, type Hero } from "../data/catalog";
import type { PlayerProfile } from "../profiles";
import { importRoster, parseRoster, rosterIssues, rosterReport, type RosterRow } from "../roster-import";

export function RosterImporter({ profile, catalog, commit }: { profile: PlayerProfile; catalog: readonly Hero[]; commit: (next: PlayerProfile) => void }) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [starsConfirmed, setStarsConfirmed] = useState(false);
  const [removalsConfirmed, setRemovalsConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const issues = rosterIssues(rows, catalog);
  const report = rosterReport(rows, catalog);
  function update(index: number, patch: Partial<RosterRow>) {
    setRows(previous => previous.map((r, i) => i === index ? { ...r, ...patch } : r));
    setStarsConfirmed(false); setRemovalsConfirmed(false); setError(""); setMessage("");
  }
  const starChanges = rows.filter(r => !r.skip && r.stars !== null && profile.ownedHeroes.some(h => h.heroId === r.heroId && h.stars !== null && h.stars !== r.stars));
  const removed = mode === "replace" ? profile.ownedHeroes.filter(h => !rows.some(r => !r.skip && r.heroId === h.heroId)) : [];
  return <section className="panel roster-importer" aria-labelledby="roster-import-title">
    <h2 id="roster-import-title">Import Hero Roster</h2>
    <p>Import into <strong>{profile.name}</strong> only. Use a UTF-8 .txt file, one hero per line: Durga ★5, Ada 4 stars, or Flameborne - 4★. Singular or plural section headings are supported: Shieldbearers:, Bombers:, Shooters:. UTF-8 BOM is optional.</p>
    <p className="muted">Exact catalog names and documented aliases only; no fuzzy matches. Stars: whole numbers 0–5, blank means unknown and preserves existing stars. Classes are checked against the catalog, never used to change it. Season eligibility remains unchanged. Flameborne has guide-supported Bomber classification; season and detailed combat metadata remain unknown.</p>
    <label>Roster TXT file<input type="file" accept=".txt,text/plain" disabled={reading} onChange={async e => {
      const input = e.currentTarget; const file = input.files?.[0]; input.value = "";
      setRows([]); setMode("merge"); setError(""); setMessage(""); setStarsConfirmed(false); setRemovalsConfirmed(false);
      if (!file) return;
      if (!/\.txt$/i.test(file.name) || file.size > 200000) { setError("Choose a .txt file under 200 KB."); return; }
      setReading(true);
      try {
        const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read the TXT file.")); reader.readAsText(file, "UTF-8"); });
        setRows(parseRoster(text, catalog));
      } catch (e) { setError(String(e)); } finally { setReading(false); }
    }} /></label>
    {reading && <p role="status">Reading roster…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {rows.length > 0 && <>
      <h3>Import preview</h3><p role="status">{report.entries} hero entries · {report.matched} matched to catalog · {report.unmatched.length} require catalog review · {report.parsingErrors.length} parsing errors</p><p>{heroClasses.map(c => `${c}: ${report.sections[c]}`).join(" · ")}</p><p>Correct unmatched names using the catalog selector. Skip unwanted lines. Malformed star entries must be corrected explicitly before importing.</p>
      <div className="roster-preview">{rows.map((row, index) => <fieldset key={row.line}><legend>Line {row.line}: {row.raw}</legend>
        <label className="checkbox-label"><input type="checkbox" checked={row.skip} onChange={e => update(index, { skip: e.target.checked })} />Skip line {row.line}</label>
        <div className="field-grid"><label>Hero match · line {row.line}<select value={row.heroId} onChange={e => update(index, { heroId: e.target.value })}><option value="">Unmatched: {row.name || "missing name"}</option>{catalog.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>Stars · line {row.line}<input type="number" min="0" max="5" step="1" value={row.stars ?? ""} placeholder="Unknown" onChange={e => update(index, { stars: e.target.value === "" ? null : Number(e.target.value), parseError: "" })} /></label>
        <label>Class · line {row.line}<select value={row.heroClass ?? ""} onChange={e => update(index, { heroClass: (e.target.value || null) as RosterRow["heroClass"] })}><option value="">Unspecified</option>{heroClasses.map(c => <option key={c}>{c}</option>)}</select></label></div>
        <p className="muted">{row.heroId ? `Matched: ${catalog.find(h => h.id === row.heroId)?.name ?? "catalog entry unavailable"}` : "Unmatched — choose a hero or skip."} · {row.stars === null ? "Stars unknown" : `${row.stars} stars`}</p>
        {row.parseError && <p>{row.parseError} Edit Stars to resolve.</p>}
      </fieldset>)}</div>
      {issues.length > 0 && <div role="alert">{report.parsingErrors.length > 0 && <><h4>Parsing errors</h4>{report.parsingErrors.map(r => <p key={r.line}>Line {r.line}: {r.parseError || "Invalid star level."}</p>)}</>}{report.unmatched.length > 0 && <><h4>Catalog entries requiring review</h4><p>These names were parsed but have no unique catalog match. They are not parsing errors. No identity has been substituted.</p>{report.unmatched.map(r => <p key={r.line}>Line {r.line}: {r.name || "missing name"} — select a verified match or skip.</p>)}</>}{report.validationIssues.length > 0 && <><h4>Import validation</h4>{report.validationIssues.map((issue, i) => <p key={i}>{issue}</p>)}</>}</div>}
      <label>Roster import mode<select value={mode} onChange={e => { setMode(e.target.value as typeof mode); setRemovalsConfirmed(false); setStarsConfirmed(false); }}><option value="merge">Merge — keep existing owned heroes</option><option value="replace">Replace — keep only imported heroes</option></select></label>
      <p>Skills, equipment, exclusive equipment and robots are preserved for retained heroes. Replace removes omitted heroes and their progression from this profile. Other profiles are unchanged. Import saves this profile, including its current edits, locally.</p>
      {starChanges.length > 0 && <label className="checkbox-label"><input type="checkbox" checked={starsConfirmed} onChange={e => setStarsConfirmed(e.target.checked)} />I confirm overwriting existing star levels: {starChanges.map(r => `${catalog.find(h => h.id === r.heroId)?.name}: ${profile.ownedHeroes.find(h => h.heroId === r.heroId)?.stars} → ${r.stars}`).join(", ")}</label>}
      {removed.length > 0 && <label className="checkbox-label"><input type="checkbox" checked={removalsConfirmed} onChange={e => setRemovalsConfirmed(e.target.checked)} />I confirm removing {removed.length} owned heroes and their progression: {removed.map(h => h.heroId).join(", ")}</label>}
      <div className="button-row"><button className="primary" disabled={reading || !!issues.length || !rows.some(r => !r.skip) || (!!starChanges.length && !starsConfirmed) || (!!removed.length && !removalsConfirmed)} onClick={() => {
        try { const next = importRoster(profile, rows, catalog, { mode, confirmStarChanges: starsConfirmed, confirmRemovals: removalsConfirmed }); commit(next); setRows([]); setError(""); setMessage(`Roster imported and saved for ${profile.name}.`); } catch (e) { setError(String(e)); }
      }}>Import roster into {profile.name}</button><button className="secondary" onClick={() => { setRows([]); setError(""); }}>Cancel preview</button></div>
    </>}
  </section>;
}

