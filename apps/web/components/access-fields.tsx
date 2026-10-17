import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/option-select";
import { JOIN_OPTIONS, VISIBILITY_OPTIONS } from "@/lib/tournament-access";
import type { JoinPolicy, TournamentVisibility } from "@/types";

export interface AccessValues {
  visibility: TournamentVisibility;
  join_policy: JoinPolicy;
}

/**
 * The two questions about access: who sees the results and who may join (only while teams can join: `joinable`).
 * Shared by create dialog and settings.
 */
export function AccessFields({
  values,
  onChange,
  joinable = true,
}: Readonly<{ values: AccessValues; onChange: (patch: Partial<AccessValues>) => void; joinable?: boolean }>) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Ergebnisse sehen</Label>
        <OptionSelect
          label="Ergebnisse sehen"
          options={VISIBILITY_OPTIONS}
          value={values.visibility}
          onChange={(visibility) => onChange({ visibility })}
        />
      </div>
      {joinable && (
        <div className="space-y-2">
          <Label>Beitreten</Label>
          <OptionSelect
            label="Beitreten"
            options={JOIN_OPTIONS}
            value={values.join_policy}
            onChange={(join_policy) => onChange({ join_policy })}
          />
        </div>
      )}
    </div>
  );
}
