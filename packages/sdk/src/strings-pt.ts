// pt strings for <church-lookup>. Script tag: loads by itself when lang="pt". Bundlers:
// import "@heresmychurch/lookup/strings/pt";
import { registerStrings, type Strings } from "./strings.ts";

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

const strings: Strings = {
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
    shareTitle: "Compartilhar suas correções com o Here's My Church?",
    shareBody: "As mudanças marcadas ajudam todos os apps de igrejas. Nada é enviado até você escolher Compartilhar.",
    share: "Compartilhar",
    notNow: "Agora não",
    goesLive: "Publicado na hora",
    reviewed: "Um moderador revisa",
    soon: "Em breve",
    st: { live: "Publicado", in_review: "Enviado para revisão", not_applied: "Já estava atualizado", rejected: "Não aceito", try_again: "Não foi possível enviar. Tente de novo em instantes.", coming_soon: "Em breve" },
    shared: (n) => `${n} ${n === 1 ? "mudança compartilhada" : "mudanças compartilhadas"}.`,
    sending: "Enviando…",
    sandbox: "Só demonstração: nada foi enviado.",
    confirmQ: "Dados do Here's My Church. Continuam corretos?",
    stillCorrect: "Continuam corretos",
    done: "Pronto",
    thanks: "Obrigado por confirmar.",
    changedNote: (n) => `Você mudou ${n} ${n === 1 ? "dado" : "dados"}. Você pode compartilhá-los com o Here's My Church abaixo do campo da igreja.`,
  };

registerStrings("pt", strings);
export default strings;
