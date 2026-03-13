export type TournamentEstado =
  | "CONFIGURACION"
  | "GRUPOS"
  | "RANKING"
  | "DESEMPATE"
  | "ELIMINATORIA"
  | "FINALIZADO";

export function getTournamentRouteByState(torneoId: string, estado: TournamentEstado | string) {
  if (estado === "RANKING") {
    return `/torneo/${torneoId}/ranking`;
  }

  if (estado === "DESEMPATE") {
    return `/torneo/${torneoId}/desempate`;
  }

  if (estado === "ELIMINATORIA" || estado === "FINALIZADO") {
    return `/torneo/${torneoId}/bracket`;
  }

  return `/torneo/${torneoId}/grupos`;
}

