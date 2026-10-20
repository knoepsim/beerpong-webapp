"use client";

import { useState, useEffect } from "react";
import { useCreateTeam } from "@/hooks/queries/teams";
import { useCurrentUser, useUpdateMe } from "@/hooks/queries/user";
import { errorMessage } from "@/lib/errors";
import { onboardingSchema } from "@/lib/profile";
import { Skeleton } from "@/components/ui/skeleton";
import { getRedirectParam } from "@/lib/auth";
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

const teamSchema = z.object({
  teamName: z.string().min(2, "Der Teamname muss mindestens 2 Zeichen lang sein."),
});

export default function OnboardingPage() {
  const [step, setStep] = useState<"profile" | "team">("profile");
  
  const { user, isLoading } = useCurrentUser();
  const updateMe = useUpdateMe();
  const createTeam = useCreateTeam();
  const isSaving = updateMe.isPending || createTeam.isPending;
  const failure = step === "profile" ? updateMe.error : createTeam.error;
  const apiError = failure ? errorMessage(failure) : null;

  const profileForm = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: "", email: "" },
  });

  const teamForm = useForm<z.infer<typeof teamSchema>>({
    resolver: zodResolver(teamSchema),
    defaultValues: { teamName: "" },
  });

  // a complete profile needs no onboarding; otherwise the form starts with what is there (a name that is only the
  // phone number is no name)
  const profileComplete = !!user?.name && !user.name.startsWith("+49") && !!user.email;
  useEffect(() => {
    if (!user) return;
    if (profileComplete) {
      window.location.href = "/tournaments";
      return;
    }
    profileForm.reset({ name: user.name.startsWith("+49") ? "" : user.name, email: user.email ?? "" });
  }, [user, profileComplete, profileForm]);

  const onProfileSubmit = (values: z.infer<typeof onboardingSchema>) =>
    updateMe.mutate(
      { name: values.name.trim(), email: values.email.trim() },
      {
        onSuccess: () => {
          const redirectUrl = getRedirectParam();
          if (redirectUrl) window.location.href = redirectUrl;
          else setStep("team");
        },
      },
    );

  const onTeamSubmit = (values: z.infer<typeof teamSchema>) =>
    createTeam.mutate(values.teamName.trim(), {
      onSuccess: () => {
        window.location.href = "/tournaments";
      },
    });

  if (isLoading || profileComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Skeleton className="h-80 w-full max-w-sm rounded-xl" />
      </div>
    );
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
                          <User className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
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
                  {isSaving ? "Wird gespeichert…" : "Weiter"}
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
                          <Users className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
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
                  {isSaving ? "Wird erstellt…" : "Team gründen und loslegen"}
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
