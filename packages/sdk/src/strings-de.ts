// de strings for <church-lookup>. Script tag: loads by itself when lang="de". Bundlers:
// import "@heresmychurch/lookup/strings/de";
import { registerStrings, type Strings } from "./strings.ts";

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

const strings: Strings = {
    label: "Kirche",
    placeholder: "Namen Ihrer Kirche eingeben",
    none: "Keine passende Kirche. Ihre Eingabe bleibt im Formular. ",
    add: "Auf Here's My Church hinzufügen",
    noneShort: "Keine passende Kirche.",
    error: "Die Suche ist gerade nicht verfügbar. Sie können die Angaben Ihrer Kirche weiter eintippen.",
    found: (n) => `${n} ${n === 1 ? "Kirche" : "Kirchen"} gefunden. Mit den Pfeiltasten auswählen.`,
    filled: (n, m) => `${n} ${n === 1 ? "Feld" : "Felder"} ausgefüllt.${list(m, "Nicht verfügbar:")}`,
    loadFail: "Die Angaben dieser Kirche konnten nicht geladen werden. Sie können sie selbst eintragen.",
    dataFrom: "Daten von",
    clear: "Kirche entfernen",
    required: "Wählen Sie Ihre Kirche aus der Liste.",
    shareTitle: "Korrekturen mit Here's My Church teilen?",
    shareBody: "Markierte Änderungen helfen allen Kirchen-Apps. Nichts wird gesendet, bevor Sie Teilen wählen.",
    share: "Teilen",
    notNow: "Nicht jetzt",
    goesLive: "Sofort sichtbar",
    reviewed: "Wird moderiert",
    soon: "Bald verfügbar",
    st: { live: "Jetzt sichtbar", in_review: "Zur Prüfung gesendet", not_applied: "Schon aktuell", rejected: "Nicht angenommen", try_again: "Senden fehlgeschlagen. Bitte gleich noch einmal versuchen.", coming_soon: "Bald verfügbar" },
    shared: (n) => `${n} ${n === 1 ? "Änderung" : "Änderungen"} geteilt.`,
    sending: "Wird gesendet…",
    sandbox: "Nur Demo: nichts wurde gesendet.",
    confirmQ: "Angaben von Here's My Church. Noch korrekt?",
    stillCorrect: "Noch korrekt",
    done: "Fertig",
    thanks: "Danke fürs Bestätigen.",
    changedNote: (n) => `Sie haben ${n} ${n === 1 ? "Angabe" : "Angaben"} geändert. Unter dem Kirchenfeld können Sie sie mit Here's My Church teilen.`,
  };

registerStrings("de", strings);
export default strings;
