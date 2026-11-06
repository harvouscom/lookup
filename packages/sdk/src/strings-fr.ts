// fr strings for <church-lookup>. Script tag: loads by itself when lang="fr". Bundlers:
// import "@heresmychurch/lookup/strings/fr";
import { registerStrings, type Strings } from "./strings.ts";

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

const strings: Strings = {
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
    shareTitle: "Partager vos corrections avec Here's My Church ?",
    shareBody: "Les modifications cochées aident toutes les applis d'église. Rien n'est envoyé avant que vous choisissiez Partager.",
    share: "Partager",
    notNow: "Pas maintenant",
    goesLive: "Publié aussitôt",
    reviewed: "Un modérateur vérifie",
    soon: "Bientôt",
    st: { live: "Publié", in_review: "Envoyé pour vérification", not_applied: "Déjà à jour", rejected: "Non accepté", try_again: "Envoi impossible. Réessayez dans un instant.", coming_soon: "Bientôt" },
    shared: (n) => `${n} ${n === 1 ? "modification partagée" : "modifications partagées"}.`,
    sending: "Envoi…",
    sandbox: "Démo : rien n'a été envoyé.",
    confirmQ: "Informations de Here's My Church. Toujours exactes ?",
    stillCorrect: "Toujours exactes",
    done: "Terminé",
    thanks: "Merci de votre confirmation.",
    changedNote: (n) => `Vous avez modifié ${n} ${n === 1 ? "information" : "informations"}. Vous pouvez les partager avec Here's My Church sous le champ église.`,
  };

registerStrings("fr", strings);
export default strings;
