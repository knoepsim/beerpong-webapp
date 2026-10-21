import { cn } from "@/lib/utils";

export const APP_NAME = "MatchBase";

/**
 * The mark of MatchBase: the bracket that runs into the base. Below 64 px (header) the reduced mark with
 * one round, else the full one (files in public/brand, made by `pnpm brand`). Decorative: the name stands next to it.
 */
export function BrandMark({ size, className }: Readonly<{ size: number; className?: string }>) {
  const src = size < 64 ? "/brand/favicon.svg" : "/brand/icon.svg";
  // an SVG: next/image would not optimize it anyway (it serves SVGs as they are)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className={cn("shrink-0", className)} />;
}

/** The name as on the logo: "Match" in the brand color, "Base" in the color of the text. */
export function BrandName({ className }: Readonly<{ className?: string }>) {
  return (
    <span className={cn("font-heading font-extrabold tracking-tight", className)}>
      <span className="text-primary">Match</span>
      <span>Base</span>
    </span>
  );
}
