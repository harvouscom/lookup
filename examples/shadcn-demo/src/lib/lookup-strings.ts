// Lookup by Here's My Church: Spanish, French, German, Portuguese and Polish text for ChurchLookup and
// ChurchConsent. Import this file once and set lang (or the page's lang). Generated from
// packages/sdk/src/strings-*.ts by scripts/build-registry.mjs. MIT.
/* eslint-disable */
import { registerStrings, type Strings } from "@/lib/lookup-core"

// ── es ──
{
  const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

  const strings: Strings = {
      label: "Iglesia",
      placeholder: "Escribe el nombre de tu iglesia",
      none: "No encontramos esa iglesia. Lo que escribiste se queda en el formulario. ",
      add: "Agrégala en Here's My Church",
      noneShort: "No hay iglesias que coincidan.",
      error: "La búsqueda no está disponible ahora. Puedes seguir escribiendo los datos de tu iglesia.",
      found: (n) => `${n} ${n === 1 ? "iglesia encontrada" : "iglesias encontradas"}. Usa las flechas arriba y abajo para elegir.`,
      more: "Mostrar más resultados",
      loading: "Cargando…",
      moreFound: (n) => `${n} ${n === 1 ? "iglesia más" : "iglesias más"}.`,
      corrected: (q) => `Resultados para «${q}»`,
      retry: "Reintentar",
      filled: (n, m) => `${n} ${n === 1 ? "campo completado" : "campos completados"}.${list(m, "No disponible:")}`,
      loadFail: "No pudimos cargar los datos de esa iglesia. Puedes escribirlos.",
      dataFrom: "Datos de",
      clear: "Borrar iglesia",
      required: "Elige tu iglesia de la lista.",
      shareTitle: "¿Compartir tus correcciones con Here's My Church?",
      shareBody: "Desmarca lo que prefieras no compartir. No se envía nada hasta que elijas Compartir.",
      share: "Compartir",
      notNow: "Ahora no",
      goesLive: "Se publica",
      reviewed: "Lo revisa un moderador",
      soon: "Próximamente",
      st: { live: "Publicado", in_review: "Enviado a revisión", not_applied: "Sin cambios: Here's My Church mantuvo el dato publicado", rejected: "No aceptado", try_again: "No se pudo enviar. Inténtalo en un momento.", coming_soon: "Próximamente" },
      shared: (n) => `${n} ${n === 1 ? "cambio compartido" : "cambios compartidos"}.`,
      sending: "Enviando…",
      sandbox: "Solo demostración: no se envió nada.",
      confirmQ: "Datos de Here's My Church. ¿Siguen siendo correctos?",
      stillCorrect: "Siguen correctos",
      done: "Listo",
      thanks: "Gracias por confirmar.",
      changedNote: (n) => `Cambiaste ${n} ${n === 1 ? "dato" : "datos"}. Puedes compartirlos con Here's My Church debajo del campo de iglesia.`,
      address: "Dirección",
      shareN: (n) => `Compartir ${n} ${n === 1 ? "corrección" : "correcciones"}`,
      report: "Informar un problema",
      reports: { reportClosed: "Cerrada", reportDuplicate: "Duplicada", reportRelocated: "Se mudó" },
      reported: "Gracias. Un moderador lo revisará.",
      moreFixes: "Más correcciones en Here's My Church",
      addQ: (name) => `¿Agregar ${name} a Here's My Church?`,
      addBody: "Se publica enseguida para que otros la encuentren. Revisa los datos antes.",
      addBtn: "Agregar iglesia",
      adding: "Agregando…",
      similarQ: "¿Es alguna de estas?",
      noneOfThese: "Ninguna, agrégala",
      added: (name) => `Se agregó ${name}. ¡Gracias!`,
    };

  registerStrings("es", strings);
}

// ── fr ──
{
  const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

  const strings: Strings = {
      label: "Église",
      placeholder: "Tapez le nom de votre église",
      none: "Aucune église correspondante. Ce que vous avez tapé reste dans le formulaire. ",
      add: "Ajoutez-la sur Here's My Church",
      noneShort: "Aucune église correspondante.",
      error: "La recherche n'est pas disponible pour le moment. Vous pouvez continuer à saisir les informations de votre église.",
      found: (n) => `${n} ${n === 1 ? "église trouvée" : "églises trouvées"}. Utilisez les flèches haut et bas pour choisir.`,
      more: "Afficher plus de résultats",
      loading: "Chargement…",
      moreFound: (n) => `${n} ${n === 1 ? "église de plus" : "églises de plus"}.`,
      corrected: (q) => `Résultats pour « ${q} »`,
      retry: "Réessayer",
      filled: (n, m) => `${n} ${n === 1 ? "champ rempli" : "champs remplis"}.${list(m, "Non disponible :")}`,
      loadFail: "Impossible de charger les informations de cette église. Vous pouvez les saisir.",
      dataFrom: "Données de",
      clear: "Effacer l'église",
      required: "Choisissez votre église dans la liste.",
      shareTitle: "Partager vos corrections avec Here's My Church ?",
      shareBody: "Décochez ce que vous préférez ne pas partager. Rien n'est envoyé avant que vous choisissiez Partager.",
      share: "Partager",
      notNow: "Pas maintenant",
      goesLive: "Publié aussitôt",
      reviewed: "Un modérateur vérifie",
      soon: "Bientôt",
      st: { live: "Publié", in_review: "Envoyé pour vérification", not_applied: "Inchangé : Here's My Church a gardé la valeur publiée", rejected: "Non accepté", try_again: "Envoi impossible. Réessayez dans un instant.", coming_soon: "Bientôt" },
      shared: (n) => `${n} ${n === 1 ? "modification partagée" : "modifications partagées"}.`,
      sending: "Envoi…",
      sandbox: "Démo : rien n'a été envoyé.",
      confirmQ: "Informations de Here's My Church. Toujours exactes ?",
      stillCorrect: "Toujours exactes",
      done: "Terminé",
      thanks: "Merci de votre confirmation.",
      changedNote: (n) => `Vous avez modifié ${n} ${n === 1 ? "information" : "informations"}. Vous pouvez les partager avec Here's My Church sous le champ église.`,
      address: "Adresse",
      shareN: (n) => `Partager ${n} ${n === 1 ? "correction" : "corrections"}`,
      report: "Signaler un problème",
      reports: { reportClosed: "Fermée", reportDuplicate: "Doublon", reportRelocated: "A déménagé" },
      reported: "Merci. Un modérateur va vérifier.",
      moreFixes: "Autres corrections sur Here's My Church",
      addQ: (name) => `Ajouter ${name} à Here's My Church ?`,
      addBody: "Elle est publiée tout de suite pour que d'autres la trouvent. Vérifiez d'abord les informations.",
      addBtn: "Ajouter l'église",
      adding: "Ajout…",
      similarQ: "Est-ce l'une de celles-ci ?",
      noneOfThese: "Aucune, l'ajouter",
      added: (name) => `${name} a été ajoutée. Merci !`,
    };

  registerStrings("fr", strings);
}

// ── de ──
{
  const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

  const strings: Strings = {
      label: "Kirche",
      placeholder: "Namen Ihrer Kirche eingeben",
      none: "Keine passende Kirche. Ihre Eingabe bleibt im Formular. ",
      add: "Auf Here's My Church hinzufügen",
      noneShort: "Keine passende Kirche.",
      error: "Die Suche ist gerade nicht verfügbar. Sie können die Angaben Ihrer Kirche weiter eintippen.",
      found: (n) => `${n} ${n === 1 ? "Kirche" : "Kirchen"} gefunden. Mit den Pfeiltasten auswählen.`,
      more: "Mehr Ergebnisse anzeigen",
      loading: "Wird geladen…",
      moreFound: (n) => `${n} weitere ${n === 1 ? "Kirche" : "Kirchen"}.`,
      corrected: (q) => `Ergebnisse für „${q}“`,
      retry: "Erneut versuchen",
      filled: (n, m) => `${n} ${n === 1 ? "Feld" : "Felder"} ausgefüllt.${list(m, "Nicht verfügbar:")}`,
      loadFail: "Die Angaben dieser Kirche konnten nicht geladen werden. Sie können sie selbst eintragen.",
      dataFrom: "Daten von",
      clear: "Kirche entfernen",
      required: "Wählen Sie Ihre Kirche aus der Liste.",
      shareTitle: "Korrekturen mit Here's My Church teilen?",
      shareBody: "Entfernen Sie das Häkchen bei allem, was Sie nicht teilen möchten. Nichts wird gesendet, bevor Sie Teilen wählen.",
      share: "Teilen",
      notNow: "Nicht jetzt",
      goesLive: "Sofort sichtbar",
      reviewed: "Wird moderiert",
      soon: "Bald verfügbar",
      st: { live: "Jetzt sichtbar", in_review: "Zur Prüfung gesendet", not_applied: "Nicht geändert: Here's My Church behält den bisherigen Wert", rejected: "Nicht angenommen", try_again: "Senden fehlgeschlagen. Bitte gleich noch einmal versuchen.", coming_soon: "Bald verfügbar" },
      shared: (n) => `${n} ${n === 1 ? "Änderung" : "Änderungen"} geteilt.`,
      sending: "Wird gesendet…",
      sandbox: "Nur Demo: nichts wurde gesendet.",
      confirmQ: "Angaben von Here's My Church. Noch korrekt?",
      stillCorrect: "Noch korrekt",
      done: "Fertig",
      thanks: "Danke fürs Bestätigen.",
      changedNote: (n) => `Sie haben ${n} ${n === 1 ? "Angabe" : "Angaben"} geändert. Unter dem Kirchenfeld können Sie sie mit Here's My Church teilen.`,
      address: "Adresse",
      shareN: (n) => `${n} ${n === 1 ? "Korrektur" : "Korrekturen"} teilen`,
      report: "Problem melden",
      reports: { reportClosed: "Geschlossen", reportDuplicate: "Doppelt", reportRelocated: "Umgezogen" },
      reported: "Danke. Ein Moderator prüft es.",
      moreFixes: "Weitere Korrekturen auf Here's My Church",
      addQ: (name) => `${name} zu Here's My Church hinzufügen?`,
      addBody: "Sie ist sofort sichtbar, damit andere sie finden. Prüfen Sie die Angaben vorher.",
      addBtn: "Kirche hinzufügen",
      adding: "Wird hinzugefügt…",
      similarQ: "Ist es eine von diesen?",
      noneOfThese: "Keine davon, hinzufügen",
      added: (name) => `${name} wurde hinzugefügt. Danke!`,
    };

  registerStrings("de", strings);
}

// ── pt ──
{
  const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

  const strings: Strings = {
      label: "Igreja",
      placeholder: "Digite o nome da sua igreja",
      none: "Nenhuma igreja encontrada. O que você digitou continua no formulário. ",
      add: "Adicione no Here's My Church",
      noneShort: "Nenhuma igreja encontrada.",
      error: "A busca não está disponível agora. Você pode continuar digitando os dados da sua igreja.",
      found: (n) => `${n} ${n === 1 ? "igreja encontrada" : "igrejas encontradas"}. Use as setas para cima e para baixo para escolher.`,
      more: "Mostrar mais resultados",
      loading: "Carregando…",
      moreFound: (n) => `Mais ${n} ${n === 1 ? "igreja" : "igrejas"}.`,
      corrected: (q) => `Resultados para “${q}”`,
      retry: "Tentar novamente",
      filled: (n, m) => `${n} ${n === 1 ? "campo preenchido" : "campos preenchidos"}.${list(m, "Indisponível:")}`,
      loadFail: "Não foi possível carregar os dados dessa igreja. Você pode digitá-los.",
      dataFrom: "Dados de",
      clear: "Limpar igreja",
      required: "Escolha sua igreja na lista.",
      shareTitle: "Compartilhar suas correções com o Here's My Church?",
      shareBody: "Desmarque o que preferir não compartilhar. Nada é enviado até você escolher Compartilhar.",
      share: "Compartilhar",
      notNow: "Agora não",
      goesLive: "Publicado na hora",
      reviewed: "Um moderador revisa",
      soon: "Em breve",
      st: { live: "Publicado", in_review: "Enviado para revisão", not_applied: "Sem mudança: o Here's My Church manteve o dado publicado", rejected: "Não aceito", try_again: "Não foi possível enviar. Tente de novo em instantes.", coming_soon: "Em breve" },
      shared: (n) => `${n} ${n === 1 ? "mudança compartilhada" : "mudanças compartilhadas"}.`,
      sending: "Enviando…",
      sandbox: "Só demonstração: nada foi enviado.",
      confirmQ: "Dados do Here's My Church. Continuam corretos?",
      stillCorrect: "Continuam corretos",
      done: "Pronto",
      thanks: "Obrigado por confirmar.",
      changedNote: (n) => `Você mudou ${n} ${n === 1 ? "dado" : "dados"}. Você pode compartilhá-los com o Here's My Church abaixo do campo da igreja.`,
      address: "Endereço",
      shareN: (n) => `Compartilhar ${n} ${n === 1 ? "correção" : "correções"}`,
      report: "Informar um problema",
      reports: { reportClosed: "Fechada", reportDuplicate: "Duplicada", reportRelocated: "Mudou de endereço" },
      reported: "Obrigado. Um moderador vai verificar.",
      moreFixes: "Mais correções no Here's My Church",
      addQ: (name) => `Adicionar ${name} ao Here's My Church?`,
      addBody: "Ela é publicada na hora, para que outros a encontrem. Confira os dados antes.",
      addBtn: "Adicionar igreja",
      adding: "Adicionando…",
      similarQ: "É uma destas?",
      noneOfThese: "Nenhuma, adicionar",
      added: (name) => `${name} foi adicionada. Obrigado!`,
    };

  registerStrings("pt", strings);
}

// ── pl ──
{
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
}
