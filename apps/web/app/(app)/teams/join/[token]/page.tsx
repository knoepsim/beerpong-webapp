"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users } from "lucide-react";

export default function JoinTeamPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();
  
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const team = await api.teams.acceptInvite(token);
      router.push(`/teams/${team.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Der Link ist ungültig oder das Team ist bereits voll.";
      setError(message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 pt-12">
      <Card className="text-center shadow-lg border-primary/20">
        <CardHeader>
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary">
            <Users className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">Team Beitreten</CardTitle>
          <CardDescription>
            Du wurdest eingeladen, einem Team beizutreten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          
          <Button 
            className="w-full h-12 text-lg" 
            onClick={handleJoin} 
            disabled={isJoining}
          >
            {isJoining ? "Trete bei…" : "Einladung annehmen"}
          </Button>
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
