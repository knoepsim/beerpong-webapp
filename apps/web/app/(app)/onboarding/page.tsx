"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { User, Users } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const profileSchema = z.object({
  name: z.string().min(2, "Der Anzeigename muss mindestens 2 Zeichen lang sein."),
  email: z.string().email("Bitte gib eine gültige E-Mail Adresse ein."),
});

const teamSchema = z.object({
  teamName: z.string().min(2, "Der Teamname muss mindestens 2 Zeichen lang sein."),
});

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "team">("profile");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema as any),
    defaultValues: { name: "", email: "" },
  });

  const teamForm = useForm<z.infer<typeof teamSchema>>({
    resolver: zodResolver(teamSchema as any),
    defaultValues: { teamName: "" },
  });

  useEffect(() => {
    // Check if the user needs onboarding
    api.users.me()
      .then(user => {
        let defaultName = "";
        let defaultEmail = "";
        
        if (user.name && !user.name.startsWith("+49") && user.email) {
          window.location.href = "/tournaments";
          return;
        }

        if (user.name && !user.name.startsWith("+49")) {
          defaultName = user.name;
        }
        if (user.email) {
          defaultEmail = user.email;
        }
        
        profileForm.reset({ name: defaultName, email: defaultEmail });
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [profileForm]);

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsSaving(true);
    setApiError(null);
    try {
      await api.users.updateMe({ name: values.name.trim(), email: values.email.trim() });
      
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");
      
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setStep("team");
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const onTeamSubmit = async (values: z.infer<typeof teamSchema>) => {
    setIsSaving(true);
    setApiError(null);
    try {
      await api.teams.create(values.teamName.trim());
      window.location.href = "/tournaments";
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Fehler beim Erstellen des Teams");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center p-4 text-muted-foreground animate-pulse">Lade...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <div className="text-4xl mb-2">🏓</div>
          <CardTitle className="text-2xl font-bold">Willkommen!</CardTitle>
          <CardDescription>
            {step === "profile" 
              ? "Bevor du loslegst, schließe dein Profil ab." 
              : "Gründe jetzt dein erstes Beerpong-Team."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "profile" ? (
            <Form {...profileForm}>
              <form key="profile-form" onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dein Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Wie sollen wir dich nennen?"
                            disabled={isSaving}
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail Adresse</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            placeholder="deine@email.de"
                            disabled={isSaving}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {apiError && <p className="text-sm text-destructive font-medium">{apiError}</p>}
                
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Speichere…" : "Weiter"}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...teamForm}>
              <form key="team-form" onSubmit={teamForm.handleSubmit(onTeamSubmit)} className="space-y-4">
                <FormField
                  control={teamForm.control}
                  name="teamName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Name deines Teams"
                            disabled={isSaving}
                            className="pl-9"
                            autoFocus
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {apiError && <p className="text-sm text-destructive font-medium">{apiError}</p>}
                
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Erstelle…" : "Team gründen & loslegen"}
                </Button>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-muted-foreground mt-2" 
                  onClick={() => window.location.href = "/tournaments"}
                  disabled={isSaving}
                >
                  Später erstellen
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
