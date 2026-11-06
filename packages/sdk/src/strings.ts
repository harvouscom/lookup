// Text the widget shows or announces, in the languages of the countries Here's My Church covers
// most. Pick one with `lang` (or the page's), and override any string with the `strings` property.

export interface Strings {
  label: string;
  placeholder: string;
  /** Shown when a search finds nothing; the add link follows it. */
  none: string;
  add: string;
  /** Announced when a search finds nothing. */
  noneShort: string;
  error: string;
  found: (n: number) => string;
  filled: (n: number, missing: string[]) => string;
  loadFail: string;
  dataFrom: string;
  clear: string;
  required: string;
}

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");
const pl = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

export const STRINGS: Record<string, Strings> = {
  en: {
    label: "Church",
    placeholder: "Start typing your church's name",
    none: "No matching church. What you typed stays in the form. ",
    add: "Add it on Here's My Church",
    noneShort: "No matching church.",
    error: "Search isn't available right now. You can keep typing your church's details.",
    found: (n) => `${n} ${n === 1 ? "church" : "churches"} found. Use up and down arrows to choose.`,
    filled: (n, m) => `Filled ${n} ${n === 1 ? "field" : "fields"}.${list(m, "Not available:")}`,
    loadFail: "Couldn't load that church's details. You can type them in.",
    dataFrom: "Data from",
    clear: "Clear church",
    required: "Choose your church from the list.",
  },
  es: {
    label: "Iglesia",
    placeholder: "Escribe el nombre de tu iglesia",
    none: "No encontramos esa iglesia. Lo que escribiste se queda en el formulario. ",
    add: "Agrégala en Here's My Church",
    noneShort: "No hay iglesias que coincidan.",
    error: "La búsqueda no está disponible ahora. Puedes seguir escribiendo los datos de tu iglesia.",
    found: (n) => `${n} ${n === 1 ? "iglesia encontrada" : "iglesias encontradas"}. Usa las flechas arriba y abajo para elegir.`,
    filled: (n, m) => `${n} ${n === 1 ? "campo completado" : "campos completados"}.${list(m, "No disponible:")}`,
    loadFail: "No pudimos cargar los datos de esa iglesia. Puedes escribirlos.",
    dataFrom: "Datos de",
    clear: "Borrar iglesia",
    required: "Elige tu iglesia de la lista.",
  },
  fr: {
    label: "Église",
    placeholder: "Tapez le nom de votre église",
    none: "Aucune église correspondante. Ce que vous avez tapé reste dans le formulaire. ",
    add: "Ajoutez-la sur Here's My Church",
    noneShort: "Aucune église correspondante.",
    error: "La recherche n'est pas disponible pour le moment. Vous pouvez continuer à saisir les informations de votre église.",
    found: (n) => `${n} ${n === 1 ? "église trouvée" : "églises trouvées"}. Utilisez les flèches haut et bas pour choisir.`,
    filled: (n, m) => `${n} ${n === 1 ? "champ rempli" : "champs remplis"}.${list(m, "Non disponible :")}`,
    loadFail: "Impossible de charger les informations de cette église. Vous pouvez les saisir.",
    dataFrom: "Données de",
    clear: "Effacer l'église",
    required: "Choisissez votre église dans la liste.",
  },
  de: {
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
  },
  pt: {
    label: "Igreja",
    placeholder: "Digite o nome da sua igreja",
    none: "Nenhuma igreja encontrada. O que você digitou continua no formulário. ",
    add: "Adicione no Here's My Church",
    noneShort: "Nenhuma igreja encontrada.",
    error: "A busca não está disponível agora. Você pode continuar digitando os dados da sua igreja.",
    found: (n) => `${n} ${n === 1 ? "igreja encontrada" : "igrejas encontradas"}. Use as setas para cima e para baixo para escolher.`,
    filled: (n, m) => `${n} ${n === 1 ? "campo preenchido" : "campos preenchidos"}.${list(m, "Indisponível:")}`,
    loadFail: "Não foi possível carregar os dados dessa igreja. Você pode digitá-los.",
    dataFrom: "Dados de",
    clear: "Limpar igreja",
    required: "Escolha sua igreja na lista.",
  },
  pl: {
    label: "Kościół",
    placeholder: "Wpisz nazwę swojego kościoła",
    none: "Nie znaleziono kościoła. To, co wpisano, zostaje w formularzu. ",
    add: "Dodaj go w Here's My Church",
    noneShort: "Brak pasujących kościołów.",
    error: "Wyszukiwanie jest teraz niedostępne. Możesz dalej wpisywać dane kościoła.",
    found: (n) => `Znaleziono ${n} ${pl(n, "kościół", "kościoły", "kościołów")}. Wybierz strzałkami w górę i w dół.`,
    filled: (n, m) => `Uzupełniono ${n} ${pl(n, "pole", "pola", "pól")}.${list(m, "Niedostępne:")}`,
    loadFail: "Nie udało się wczytać danych kościoła. Możesz je wpisać.",
    dataFrom: "Dane z",
    clear: "Wyczyść kościół",
    required: "Wybierz swój kościół z listy.",
  },
};

/** The strings for a language tag such as "es-MX", falling back to English. */
export function stringsFor(lang: string | null | undefined): Strings {
  const base = (lang ?? "").toLowerCase().split("-")[0]!;
  return STRINGS[base] ?? STRINGS.en!;
}
