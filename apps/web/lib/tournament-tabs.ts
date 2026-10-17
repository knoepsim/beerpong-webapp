/** The tabs of a tournament page and how they appear in the address (?tab=spielplan), so reload, back and links keep them. */
export type TournamentTab = "overview" | "bracket" | "tables" | "teams" | "admin";

const PARAM: Record<TournamentTab, string | null> = {
  overview: null, // the default needs no parameter
  bracket: "spielplan",
  tables: "tische",
  teams: "teilnehmer",
  admin: "verwalten",
};

/** The tab of a `?tab=` value; anything unknown is the overview. */
export function tabFromParam(value: string | null | undefined): TournamentTab {
  const found = (Object.keys(PARAM) as TournamentTab[]).find((tab) => PARAM[tab] === value);
  return found ?? "overview";
}

/** The query string for a tab ("" for the overview). */
export function tabQuery(tab: TournamentTab): string {
  const value = PARAM[tab];
  return value ? `?tab=${value}` : "";
}
