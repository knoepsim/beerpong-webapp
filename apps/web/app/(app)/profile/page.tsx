"use client";

import { useState, useEffect } from "react";
import { errorMessage } from "@/lib/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logout } from "@/lib/auth";
import { useCurrentUser, useRequestPhoneChange, useUpdateMe, useVerifyPhoneChange } from "@/hooks/queries/user";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { codeSchema, phoneSchema, toE164 } from "@/lib/phone";
import { profileSchema } from "@/lib/profile";
import { PhoneInput, SmsCodeInput } from "@/components/phone-fields";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Save, User as UserIcon, Monitor, Moon, Sun, Smartphone, RefreshCwIcon } from "lucide-react";

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const updateMe = useUpdateMe({ successMessage: "Profil gespeichert." });
  const requestPhoneChange = useRequestPhoneChange();
  const verifyPhoneChange = useVerifyPhoneChange();

  // Phone Change State
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [currentPhone, setCurrentPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const isPhoneLoading = requestPhoneChange.isPending || verifyPhoneChange.isPending;
  const phoneFailure = requestPhoneChange.error ?? verifyPhoneChange.error;
  const phoneApiError = phoneFailure ? errorMessage(phoneFailure) : null;
  const resetPhoneErrors = () => {
    requestPhoneChange.reset();
    verifyPhoneChange.reset();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { 
      name: user?.name || "", 
      email: user?.email || "" 
    },
  });

  // Re-sync default values when user loads
  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name, email: user.email || "" });
    }
  }, [user, profileForm]);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const onSubmitProfile = (values: z.infer<typeof profileSchema>) => updateMe.mutate(values);

  const handleLogout = () => void logout();

  function onSubmitPhone(values: z.infer<typeof phoneSchema>) {
    resetPhoneErrors();
    requestPhoneChange.mutate(toE164(values.phone), {
      onSuccess: () => {
        setCurrentPhone(values.phone);
        setPhoneStep(2);
      },
    });
  }

  function onSubmitCode(values: z.infer<typeof codeSchema>) {
    resetPhoneErrors();
    verifyPhoneChange.mutate(
      { phoneNumber: toE164(currentPhone), code: values.code },
      {
        onSuccess: () => {
          setIsPhoneDialogOpen(false);
          phoneForm.reset();
          codeForm.reset();
          setPhoneStep(1);
        },
      },
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 pt-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  // Check if profile values changed to disable save button
  const currentValues = profileForm.watch();
  const isProfileUnchanged = currentValues.name === user.name && (currentValues.email || "") === (user.email || "");

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserIcon className="h-8 w-8" />
            </div>
            <div>
              <CardTitle>Persönliche Daten</CardTitle>
              <CardDescription>Passe deinen Namen an, der im Turnier angezeigt wird.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Telefonnummer</Label>
            <div className="flex gap-2 items-center">
              <Input value={user.phone_number} disabled className="bg-muted text-muted-foreground flex-1" />
              <Button 
                variant="outline" 
                onClick={() => {
                  resetPhoneErrors();
                  phoneForm.reset();
                  codeForm.reset();
                  setPhoneStep(1);
                  setIsPhoneDialogOpen(true);
                }}
              >
                Ändern
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Deine Nummer ist privat und wird nicht veröffentlicht.</p>
          </div>
          
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4 border-t pt-4">
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anzeigename</FormLabel>
                    <FormControl>
                      <Input placeholder="Wie möchtest du genannt werden?" {...field} />
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
                      <Input type="email" placeholder="deine@email.de" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                <Button 
                  type="submit"
                  disabled={updateMe.isPending || isProfileUnchanged} 
                  className="w-full sm:w-auto"
                >
                  <Save aria-hidden="true" />
                  {updateMe.isPending ? "Wird gespeichert…" : "Profil speichern"}
                </Button>
                {updateMe.isError && (
                  <p role="alert" className="text-sm text-destructive font-medium">
                    {errorMessage(updateMe.error)}
                  </p>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Erscheinungsbild</CardTitle>
          <CardDescription>Hell, dunkel oder wie dein Gerät eingestellt ist.</CardDescription>
        </CardHeader>
        <CardContent>
          {mounted ? (
            <ToggleGroup
              aria-label="Erscheinungsbild"
              variant="outline"
              spacing={0}
              value={[theme ?? "system"]}
              onValueChange={(value) => value[0] && setTheme(value[0])}
            >
              <ToggleGroupItem value="light">
                <Sun data-icon="inline-start" aria-hidden="true" />
                Hell
              </ToggleGroupItem>
              <ToggleGroupItem value="dark">
                <Moon data-icon="inline-start" aria-hidden="true" />
                Dunkel
              </ToggleGroupItem>
              <ToggleGroupItem value="system">
                <Monitor data-icon="inline-start" aria-hidden="true" />
                System
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <Skeleton className="h-9 w-[280px] rounded-lg" />
          )}
        </CardContent>
      </Card>

      <Separator />
      <div className="flex justify-center">
        <Button variant="ghost" className="text-muted-foreground" onClick={handleLogout}>
          <LogOut data-icon="inline-start" aria-hidden="true" />
          Abmelden
        </Button>
      </div>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Handynummer ändern</DialogTitle>
            <DialogDescription>
              {phoneStep === 1 
                ? "Bitte gib deine neue Handynummer ein. Wir senden dir einen Bestätigungscode per SMS."
                : (
                  <span className="flex items-center gap-1 flex-wrap">
                    Wir haben einen 6-stelligen Code an +49 {currentPhone} gesendet.
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => {
                        resetPhoneErrors();
                        setPhoneStep(1);
                      }}
                    >
                      Nummer ändern
                    </Button>
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>

          {phoneStep === 1 ? (
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)} className="space-y-4 py-4">
                <FormField
                  control={phoneForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neue Handynummer</FormLabel>
                      <FormControl>
                        <PhoneInput
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isPhoneLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {phoneApiError && <p className="text-sm text-destructive">{phoneApiError}</p>}
                <Button type="submit" className="w-full" disabled={isPhoneLoading}>
                  <Smartphone aria-hidden="true" />
                  Code anfordern
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...codeForm}>
              <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-6 py-4 flex flex-col items-center">
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <div className="flex items-center justify-between pb-2">
                        <FormLabel>Bestätigungscode</FormLabel>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          type="button" 
                          onClick={() => onSubmitPhone({ phone: currentPhone })} 
                          disabled={isPhoneLoading} 
                          className="h-7 px-2 text-xs"
                        >
                          <RefreshCwIcon className="mr-1.5 h-3 w-3" />
                          Erneut senden
                        </Button>
                      </div>
                      <SmsCodeInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={isPhoneLoading}
                      />
                      <FormMessage className="text-center" />
                    </FormItem>
                  )}
                />
                {phoneApiError && <p className="text-sm text-destructive text-center">{phoneApiError}</p>}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isPhoneLoading}
                >
                  {isPhoneLoading ? "Wird geprüft…" : "Nummer bestätigen"}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
