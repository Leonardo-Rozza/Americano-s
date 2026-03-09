export type BracketProgressMatch = {
  id: string;
  ronda: number;
  posicion: number;
  esBye: boolean;
  pareja1Id: string | null;
  pareja2Id: string | null;
  ganadorId: string | null;
  gamesPareja1: number | null;
  gamesPareja2: number | null;
  scoreJson?: unknown | null;
  walkover?: boolean;
  completado: boolean;
};

function cloneMatch(match: BracketProgressMatch): BracketProgressMatch {
  return { ...match };
}

export function syncBracketProgression(
  matches: BracketProgressMatch[],
  totalRounds: number,
): BracketProgressMatch[] {
  const byRoundAndPos = new Map<string, BracketProgressMatch>();
  const cloned = matches.map(cloneMatch);
  for (const match of cloned) {
    byRoundAndPos.set(`${match.ronda}:${match.posicion}`, match);
  }

  const get = (round: number, position: number) => byRoundAndPos.get(`${round}:${position}`);

  for (let round = 1; round <= totalRounds; round += 1) {
    const matchesInRound = 2 ** (totalRounds - round);
    for (let position = 0; position < matchesInRound; position += 1) {
      const current = get(round, position);
      if (!current) {
        continue;
      }

      if (round === 1) {
        const onlyTeam = current.pareja1Id ? (current.pareja2Id ? null : current.pareja1Id) : current.pareja2Id;
        if (onlyTeam) {
          current.esBye = true;
          current.completado = true;
          current.ganadorId = onlyTeam;
          current.gamesPareja1 = null;
          current.gamesPareja2 = null;
          current.scoreJson = null;
          current.walkover = false;
        } else if (current.pareja1Id && current.pareja2Id) {
          current.esBye = false;
          const winnerIsValid =
            current.ganadorId !== null &&
            [current.pareja1Id, current.pareja2Id].includes(current.ganadorId);
          if (!winnerIsValid) {
            current.completado = false;
            current.ganadorId = null;
            current.gamesPareja1 = null;
            current.gamesPareja2 = null;
            current.scoreJson = null;
            current.walkover = false;
          }
        }
        continue;
      }

      const feederA = get(round - 1, position * 2);
      const feederB = get(round - 1, position * 2 + 1);
      const feederAWinner = feederA?.completado ? feederA.ganadorId : null;
      const feederBWinner = feederB?.completado ? feederB.ganadorId : null;
      const feederAReady = Boolean(feederA?.completado && feederAWinner);
      const feederBReady = Boolean(feederB?.completado && feederBWinner);

      current.pareja1Id = feederAReady ? feederAWinner : null;
      current.pareja2Id = feederBReady ? feederBWinner : null;

      if (feederAReady && feederBReady) {
        const onlyTeam = current.pareja1Id ? (current.pareja2Id ? null : current.pareja1Id) : current.pareja2Id;
        if (onlyTeam) {
          current.esBye = true;
          current.completado = true;
          current.ganadorId = onlyTeam;
          current.gamesPareja1 = null;
          current.gamesPareja2 = null;
          current.scoreJson = null;
          current.walkover = false;
          continue;
        }

        if (current.pareja1Id && current.pareja2Id) {
          current.esBye = false;
          const winnerIsValid =
            current.ganadorId !== null &&
            [current.pareja1Id, current.pareja2Id].includes(current.ganadorId);
          if (!winnerIsValid) {
            current.completado = false;
            current.ganadorId = null;
            current.gamesPareja1 = null;
            current.gamesPareja2 = null;
            current.scoreJson = null;
            current.walkover = false;
          }
          continue;
        }
      }

      const waitingBye =
        (feederAReady && !feederBReady) ||
        (feederBReady && !feederAReady);
      current.esBye = waitingBye;
      current.completado = false;
      current.ganadorId = null;
      current.gamesPareja1 = null;
      current.gamesPareja2 = null;
      current.scoreJson = null;
      current.walkover = false;
    }
  }

  return cloned.sort((a, b) => a.ronda - b.ronda || a.posicion - b.posicion);
}
