"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAcceptTeamInvite, useMyTeams, useTeamInvite } from "@/hooks/queries/teams";
import { errorMessage } from "@/lib/errors";
import { ErrorAlert } from "@/components/error-alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries/user";

export default function JoinTeamPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();
  
  const { user } = useCurrentUser();
  const { data: myTeams } = useMyTeams({ enabled: !!user });
  const { data: invite, isLoading, isError } = useTeamInvite(token);
  const accept = useAcceptTeamInvite(token);
  const isJoining = accept.isPending;

  // the team shows up in "Meine Teams", where everything about it is
  const handleJoin = () => accept.mutate(undefined, { onSuccess: () => router.push("/teams") });

  return (
    <div className="mx-auto max-w-sm px-4 pt-12">
      <Card className="text-center shadow-lg border-primary/20">
        <CardHeader>
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary">
            <Users className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">
            {invite ? <>Team <strong>{invite.team_name}</strong> Beitreten</> : "Team Beitreten"}
          </CardTitle>
          <CardDescription>
            {invite 
              ? <>Du wurdest von <strong>{invite.inviter_name}</strong> eingeladen, dem Team <strong>{invite.team_name}</strong> beizutreten.</>
              : "Du wurdest eingeladen, einem Team beizutreten."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="text-sm text-muted-foreground pb-4">
              Lade Einladungsdetails…
            </div>
          )}
          {isError && (
            <ErrorAlert message="Die Einladung konnte nicht geladen werden oder ist ungültig." />
          )}
          {accept.isError && (
            <ErrorAlert message={errorMessage(accept.error, "Der Link ist ungültig oder das Team ist bereits voll.")} />
          )}
          
          
          {invite && myTeams?.some(t => t.id === invite.team_id) ? (
            <Button 
              className="w-full h-12 text-lg bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed" 
              disabled={true}
            >
              Du bist bereits Mitglied
            </Button>
          ) : (
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleJoin} 
              disabled={isJoining || isLoading || isError}
            >
              {isJoining ? "Wird angenommen…" : "Einladung annehmen"}
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => router.push("/teams")}
            disabled={isJoining}
          >
            Abbrechen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
