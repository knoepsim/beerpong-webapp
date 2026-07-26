"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { RefreshCwIcon } from "lucide-react";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type Step = "phone" | "code" | "new_user";

const phoneSchema = z.object({
  phone: z.string().min(5, "Bitte gib eine gültige Telefonnummer ein.").regex(/^\d+$/, "Nur Zahlen erlaubt"),
});

const codeSchema = z.object({
  code: z.string().length(6, "Bitte gib den 6-stelligen Code ein."),
});

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [currentPhone, setCurrentPhone] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema as any),
    defaultValues: { phone: "" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema as any),
    defaultValues: { code: "" },
  });

  const onSubmitPhone = async (values: z.infer<typeof phoneSchema>) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await api.auth.requestCode(`+49${values.phone}`);
      setCurrentPhone(values.phone);
      setStep("code");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Senden des Codes";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCode = async (values: z.infer<typeof codeSchema>) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const result = await api.auth.verify(`+49${currentPhone}`, values.code);
      setTokens(result.access_token, result.refresh_token);
      
      const user = await api.users.me();
      const redirectUrl = new URLSearchParams(window.location.search).get("redirect");
      
      if (!user.email || !user.name || user.name === user.phone_number) {
        setStep("new_user");
      } else {
        router.push(redirectUrl || "/tournaments");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ungültiger oder abgelaufener Code";
      setApiError(message);
      codeForm.setValue("code", "");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <div className="text-4xl mb-2">🏓</div>
          <CardTitle className="text-2xl font-bold">Bierpong Turnier</CardTitle>
          <CardDescription>
            {step === "phone" && "Melde dich mit deiner Telefonnummer an"}
            {step === "code" && `Code an ${currentPhone} gesendet`}
            {step === "new_user" && "Account Einrichtung"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "phone" && (
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)} className="space-y-4">
                <FormField
                  control={phoneForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefonnummer</FormLabel>
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
                            disabled={isLoading}
                            className="border-0 focus-visible:ring-0 rounded-l-none shadow-none flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {apiError && <p className="text-sm text-destructive font-medium">{apiError}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Sende Code…" : "Code anfordern"}
                </Button>
                <div className="text-center pt-2">
                  <Link href="/reset" className="text-xs text-muted-foreground hover:underline hover:text-primary">
                    Ich habe keinen Zugriff mehr auf meine alte Nummer
                  </Link>
                </div>
              </form>
            </Form>
          )}
          
          {step === "code" && (
            <Form {...codeForm}>
              <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-4">
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between pb-2">
                        <FormLabel>Verifizierungscode</FormLabel>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onSubmitPhone({ phone: currentPhone })} 
                          disabled={isLoading} 
                          className="h-7 px-2 text-xs"
                        >
                          <RefreshCwIcon className="mr-1.5 h-3 w-3" />
                          Erneut senden
                        </Button>
                      </div>
                      <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            disabled={isLoading}
                            autoFocus
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
                {apiError && <p className="text-sm text-destructive font-medium text-center">{apiError}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Überprüfe…" : "Anmelden"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setStep("phone");
                    codeForm.reset();
                    setApiError(null);
                  }}
                >
                  Andere Nummer verwenden
                </Button>
              </form>
            </Form>
          )}

          {step === "new_user" && (
            <div className="space-y-6 pt-2">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Diese Nummer ist noch nicht registriert.</p>
                <p className="text-xs text-muted-foreground">Möchtest du einen neuen Account erstellen?</p>
              </div>
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => {
                    const redirectUrl = new URLSearchParams(window.location.search).get("redirect");
                    let path = "/onboarding";
                    if (redirectUrl) path += `?redirect=${encodeURIComponent(redirectUrl)}`;
                    router.push(path);
                  }}
                >
                  Ja, Account erstellen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    import("@/lib/auth").then((m) => m.clearTokens());
                    setStep("phone");
                    setCurrentPhone("");
                    phoneForm.reset();
                    codeForm.reset();
                  }}
                >
                  Mit anderer Nummer anmelden
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
