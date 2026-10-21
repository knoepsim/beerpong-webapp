import type { StationTerms } from "@/components/games";

/** "einen freien Tisch", "einen freien Platz", "eine freie Spielstätte": the adjective takes the ending of the article. */
export function freeOne(terms: StationTerms): string {
  const [article, ...noun] = terms.accusative.split(" ");
  const ending = article.endsWith("en") ? "freien" : "freie";
  return [article, ending, ...noun].join(" ");
}
