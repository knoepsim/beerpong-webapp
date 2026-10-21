/** The tabs of a tournament page, in the address as they are called in the code (?tab=schedule), so reload, back and links keep them. */
export const TOURNAMENT_TABS = ["overview", "schedule", "stations", "participants", "manage"] as const;

export type TournamentTab = (typeof TOURNAMENT_TABS)[number];

/** The tab of a `?tab=` value; anything unknown is the overview. */
export function tabFromParam(value: string | null | undefined): TournamentTab {
  return TOURNAMENT_TABS.find((tab) => tab === value) ?? "overview";
}

/** The query string for a tab ("" for the overview, the default needs no parameter). */
export function tabQuery(tab: TournamentTab): string {
  return tab === "overview" ? "" : `?tab=${tab}`;
}
