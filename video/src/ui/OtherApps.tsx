// Two more of the site's demo apps (site/demo/harvest.html and steeple.html), drawn small for the
// "your app, your styles" fan. Each shows the same church, filled by the same widget in its own look.

import { SANS } from "../fonts.ts";
import { CHURCH, mixc, widgetMix } from "./tokens.ts";
import { SearchBox } from "./Widget.tsx";

const Bar = ({ url, dark }: { url: string; dark?: boolean }) => (
  <div style={{ height: 38, display: "flex", alignItems: "center", gap: 14, padding: "0 14px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "#E4E4E7"}`,
    background: dark ? "#141414" : "#FAFAF9" }}>
    <span style={{ display: "flex", gap: 7 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <i key={c} style={{ width: 11, height: 11, borderRadius: 9, background: c }} />)}</span>
    <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
      <span style={{ padding: "4px 60px", borderRadius: 7, fontSize: 11, background: dark ? "rgba(255,255,255,.06)" : "rgba(17,16,20,.05)", color: dark ? "#A3A3A3" : "#57534E" }}>{url}</span>
    </span>
  </div>
);

const Field = ({ label, value, accent, radius, dark }: { label: string; value: string; accent: string; radius: number; dark?: boolean }) => (
  <div style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: dark ? "#D4D4D4" : "#44403C" }}>{label}</span>
    <span style={{ height: 36, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: radius, fontSize: 14,
      border: `1px solid ${mixc(dark ? "#3F3F46" : "#D6D3D1", accent, 0.45)}`, background: mixc(dark ? "#18181B" : "#fff", accent, 0.06), color: dark ? "#FAFAFA" : "#1C1917" }}>{value}</span>
  </div>
);

/** Harvest: a food-pantry partner sign-up, warm paper and tomato red. */
export function HarvestApp({ w = 760 }: { w?: number }) {
  const accent = "#C8371D";
  return (
    <div style={{ width: w, borderRadius: 14, overflow: "hidden", background: "#FFFBF5", border: "1px solid #E7E5E4", fontFamily: SANS, color: "#1C1917",
      boxShadow: "0 30px 70px -30px rgba(5,2,15,.8)" }}>
      <Bar url="harvest.org/partners/join" />
      <div style={{ padding: "26px 32px 30px", display: "grid", gap: 18 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: accent }}>Partner sign-up · 10 minutes</span>
          <h3 style={{ margin: "8px 0 0", fontSize: 26, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.02em", fontFamily: "Georgia, serif" }}>
            Your church already has the door. We'll bring the food.
          </h3>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#44403C" }}>Your church</span>
          <SearchBox look={widgetMix(1, accent)} w={w - 64} h={46} radius={6} text={CHURCH.name} chosen fontSize={15} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Address" value={CHURCH.location} accent={accent} radius={6} />
          <Field label="Phone" value={CHURCH.phone} accent={accent} radius={6} />
        </div>
      </div>
    </div>
  );
}

/** Steeple: a church website builder, dark with a lime accent and a live preview. */
export function SteepleApp({ w = 760 }: { w?: number }) {
  const accent = "#D2F25C";
  const look = { ...widgetMix(1, accent), bg: "#18181B", text: "#FAFAFA", inputBorder: "#3F3F46", border: "#27272A", muted: "#A1A1AA", popover: "#18181B" };
  return (
    <div style={{ width: w, borderRadius: 14, overflow: "hidden", background: "#0C0C0C", border: "1px solid #27272A", fontFamily: SANS, color: "#FAFAFA",
      boxShadow: "0 30px 70px -30px rgba(5,2,15,.9)" }}>
      <Bar url="steeple.site/new" dark />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, padding: "26px 28px 28px" }}>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <h3 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>Start with your church</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#A1A1AA", lineHeight: 1.45 }}>Find your church and the site writes its first draft. Fix anything that's out of date.</p>
          <SearchBox look={look} w={(w - 78) / 2} h={44} radius={10} text={CHURCH.name} chosen fontSize={14} />
          <Field label="Service times" value={CHURCH.times} accent={accent} radius={10} dark />
        </div>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #27272A", background: "linear-gradient(160deg, #1F2A12, #0F0F0F 70%)" }}>
          <div style={{ padding: "20px 18px", display: "grid", gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: accent }}>Welcome home · {CHURCH.city}</span>
            <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{CHURCH.name}</span>
            <span style={{ fontSize: 13, color: "#D4D4D8" }}>{CHURCH.times} · {CHURCH.street}</span>
            <span style={{ justifySelf: "start", marginTop: 6, padding: "8px 14px", borderRadius: 999, background: accent, color: "#0C0C0C", fontSize: 13, fontWeight: 600 }}>Plan a visit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
