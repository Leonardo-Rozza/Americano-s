import { describe, expect, it } from "vitest";
import { getTournamentRouteByState } from "../tournament-routing";

describe("tournament-routing", () => {
  it("resuelve la ruta segun el estado del torneo", () => {
    expect(getTournamentRouteByState("t1", "GRUPOS")).toBe("/torneo/t1/grupos");
    expect(getTournamentRouteByState("t1", "RANKING")).toBe("/torneo/t1/ranking");
    expect(getTournamentRouteByState("t1", "DESEMPATE")).toBe("/torneo/t1/desempate");
    expect(getTournamentRouteByState("t1", "ELIMINATORIA")).toBe("/torneo/t1/bracket");
    expect(getTournamentRouteByState("t1", "FINALIZADO")).toBe("/torneo/t1/bracket");
  });
});

