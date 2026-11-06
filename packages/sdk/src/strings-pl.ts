// pl strings for <church-lookup>. Script tag: loads by itself when lang="pl". Bundlers:
// import "@heresmychurch/lookup/strings/pl";
import { registerStrings, type Strings } from "./strings.ts";

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");
const pl = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

const strings: Strings = {
    label: "Kościół",
    placeholder: "Wpisz nazwę swojego kościoła",
    none: "Nie znaleziono kościoła. To, co wpisano, zostaje w formularzu. ",
    add: "Dodaj go w Here's My Church",
    noneShort: "Brak pasujących kościołów.",
    error: "Wyszukiwanie jest teraz niedostępne. Możesz dalej wpisywać dane kościoła.",
    found: (n) => `Znaleziono ${n} ${pl(n, "kościół", "kościoły", "kościołów")}. Wybierz strzałkami w górę i w dół.`,
    more: "Pokaż więcej wyników",
    loading: "Wczytywanie…",
    moreFound: (n) => `Jeszcze ${n} ${pl(n, "kościół", "kościoły", "kościołów")}.`,
    corrected: (q) => `Wyniki dla „${q}”`,
    retry: "Spróbuj ponownie",
    filled: (n, m) => `Uzupełniono ${n} ${pl(n, "pole", "pola", "pól")}.${list(m, "Niedostępne:")}`,
    loadFail: "Nie udało się wczytać danych kościoła. Możesz je wpisać.",
    dataFrom: "Dane z",
    clear: "Wyczyść kościół",
    required: "Wybierz swój kościół z listy.",
    shareTitle: "Udostępnić poprawki Here's My Church?",
    shareBody: "Odznacz to, czego nie chcesz udostępniać. Nic nie zostanie wysłane, zanim wybierzesz Udostępnij.",
    share: "Udostępnij",
    notNow: "Nie teraz",
    goesLive: "Od razu widoczne",
    reviewed: "Sprawdza moderator",
    soon: "Wkrótce",
    st: { live: "Widoczne", in_review: "Wysłano do sprawdzenia", not_applied: "Bez zmian: Here's My Church zachował obecną wartość", rejected: "Nie przyjęto", try_again: "Nie udało się wysłać. Spróbuj za chwilę.", coming_soon: "Wkrótce" },
    shared: (n) => `Udostępniono zmiany: ${n}.`,
    sending: "Wysyłanie…",
    sandbox: "Tylko demo: nic nie wysłano.",
    confirmQ: "Dane z Here's My Church. Nadal aktualne?",
    stillCorrect: "Nadal aktualne",
    done: "Gotowe",
    thanks: "Dziękujemy za potwierdzenie.",
    changedNote: (n) => `Zmieniono dane: ${n}. Możesz je udostępnić Here's My Church pod polem kościoła.`,
    address: "Adres",
    shareN: (n) => `Udostępnij poprawki: ${n}`,
    report: "Zgłoś problem",
    reports: { reportClosed: "Zamknięty", reportDuplicate: "Duplikat", reportRelocated: "Przeniesiony" },
    reported: "Dziękujemy. Moderator to sprawdzi.",
    moreFixes: "Więcej poprawek w Here's My Church",
    addQ: (name) => `Dodać ${name} do Here's My Church?`,
    addBody: "Pojawi się od razu, aby inni mogli go znaleźć. Najpierw sprawdź dane.",
    addBtn: "Dodaj kościół",
    adding: "Dodawanie…",
    similarQ: "Czy to jeden z tych?",
    noneOfThese: "Żaden, dodaj",
    added: (name) => `Dodano ${name}. Dziękujemy!`,
  };

registerStrings("pl", strings);
export default strings;
