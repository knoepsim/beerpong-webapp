"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { useCurrentUser } from "@/components/user-provider";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Save, User as UserIcon, Monitor, Moon, Sun, Smartphone, RefreshCwIcon } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Der Anzeigename muss mindestens 2 Zeichen lang sein."),
  email: z.string().email("Bitte gib eine gültige E-Mail Adresse ein.").or(z.literal("")).optional(),
});

const phoneSchema = z.object({
  phone: z.string().min(5, "Bitte gib eine gültige Telefonnummer ein.").regex(/^\d+$/, "Nur Zahlen erlaubt"),
});

const codeSchema = z.object({
  code: z.string().length(6, "Bitte gib den 6-stelligen Code ein."),
});

export default function ProfilePage() {
  const router = useRouter();
  const { user, reload } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Phone Change State
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [currentPhone, setCurrentPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [phoneApiError, setPhoneApiError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema as any),
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
    resolver: zodResolver(phoneSchema as any),
    defaultValues: { phone: "" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema as any),
    defaultValues: { code: "" },
  });

  const onSubmitProfile = async (values: z.infer<typeof profileSchema>) => {
    setIsSaving(true);
    setApiError(null);
    setSuccess(false);
    try {
      const updatedUser = await api.users.updateMe(values);
      await reload();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setApiError(err.message || "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  async function onSubmitPhone(values: z.infer<typeof phoneSchema>) {
    setIsPhoneLoading(true);
    setPhoneApiError(null);
    try {
      await api.users.requestPhoneChange(values.phone);
      setCurrentPhone(values.phone);
      setPhoneStep(2);
    } catch (err: any) {
      setPhoneApiError(err.message || "Fehler bei der Anfrage.");
    } finally {
      setIsPhoneLoading(false);
    }
  }

  async function onSubmitCode(values: z.infer<typeof codeSchema>) {
    setIsPhoneLoading(true);
    setPhoneApiError(null);
    try {
      await api.users.verifyPhoneChange(currentPhone, values.code);
      await reload();
      setIsPhoneDialogOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      phoneForm.reset();
      codeForm.reset();
      setPhoneStep(1);
    } catch (err: unknown) {
      setPhoneApiError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setIsPhoneLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center animate-pulse">Lade Profil…</div>;
  }

  // Check if profile values changed to disable save button
  const currentValues = profileForm.watch();
  const isProfileUnchanged = currentValues.name === user.name && (currentValues.email || "") === (user.email || "");

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

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
                  setPhoneApiError(null);
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
                  disabled={isSaving || isProfileUnchanged} 
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Speichere…" : "Speichern"}
                </Button>
                {apiError && <p className="text-sm text-destructive font-medium">{apiError}</p>}
                {success && <p className="text-sm text-green-500 font-medium">Profil erfolgreich aktualisiert!</p>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Erscheinungsbild</CardTitle>
          <CardDescription>Passe das Theme der App an deine Vorlieben an.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label>Theme</Label>
            {mounted ? (
              <div className="flex bg-muted p-1 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    theme === "light"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  Hell
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    theme === "dark"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  Dunkel
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    theme === "system"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  System
                </button>
              </div>
            ) : (
              <div className="h-9 w-[280px] rounded-lg bg-muted animate-pulse" />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-8 border-t">
        <Button variant="ghost" className="text-muted-foreground" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
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
                    <span 
                      role="button"
                      tabIndex={0}
                      onClick={() => { setPhoneApiError(null); setPhoneStep(1); }} 
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPhoneApiError(null);
                          setPhoneStep(1);
                        }
                      }}
                      className="text-primary hover:underline font-medium focus:outline-none cursor-pointer"
                    >
                      Ändern?
                    </span>
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
                        <div className="flex rounded-md border border-input focus-within:ring-1 focus-within:ring-ring shadow-sm overflow-hidden" aria-invalid={!!phoneForm.formState.errors.phone}>
                          <div className="flex items-center px-3 bg-muted text-sm text-muted-foreground select-none border-r">
                            +49
                          </div>
                          <Input
                            type="tel"
                            placeholder="151 12345678"
                            {...field}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                              field.onChange(val);
                            }}
                            disabled={isPhoneLoading}
                            className="border-0 focus-visible:ring-0 rounded-l-none shadow-none flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {phoneApiError && <p className="text-sm text-destructive">{phoneApiError}</p>}
                <Button type="submit" className="w-full" disabled={isPhoneLoading}>
                  <Smartphone className="mr-2 h-4 w-4" />
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
                      <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            disabled={isPhoneLoading}
                            aria-invalid={!!codeForm.formState.errors.code}
                            className={codeForm.formState.errors.code ? "border-destructive" : ""}
                            value={codeForm.watch("code") || ""}
                            onChange={(val) => {
                              codeForm.setValue("code", val, { shouldValidate: true });
                            }}
                          >
                            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator className="mx-2" />
                            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
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
                  {isPhoneLoading ? "Überprüfe…" : "Bestätigen & Speichern"}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
