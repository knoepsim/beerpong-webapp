"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getRedirectParam } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { useRequestCode, useVerifyCode } from "@/hooks/queries/user";
import { RefreshCwIcon } from "lucide-react";
import { BrandMark, BrandName } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { z } from "zod";
import { codeSchema, phoneSchema, toE164 } from "@/lib/phone";
import { PhoneInput, SmsCodeInput } from "@/components/phone-fields";
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

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [currentPhone, setCurrentPhone] = useState("");
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();
  const isLoading = requestCode.isPending || verifyCode.isPending;
  const failure = step === "phone" ? requestCode.error : verifyCode.error;
  const apiError = failure ? errorMessage(failure) : null;

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const resetErrors = () => {
    requestCode.reset();
    verifyCode.reset();
  };

  const onSubmitPhone = (values: z.infer<typeof phoneSchema>) => {
    resetErrors();
    requestCode.mutate(toE164(values.phone), {
      onSuccess: () => {
        setCurrentPhone(values.phone);
        setStep("code");
      },
    });
  };

  const onSubmitCode = (values: z.infer<typeof codeSchema>) => {
    resetErrors();
    verifyCode.mutate(
      { phoneNumber: toE164(currentPhone), code: values.code },
      {
        onSuccess: (user) => {
          if (!user.email || !user.name || user.name === user.phone_number) setStep("new_user");
          else window.location.href = getRedirectParam() || "/tournaments";
        },
        onError: () => codeForm.setValue("code", ""),
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <BrandMark size={72} className="mx-auto mb-2 rounded-2xl" />
          <CardTitle className="text-2xl">
            <BrandName />
          </CardTitle>
          <CardDescription>
            {step === "phone" && "Melde dich mit deiner Telefonnummer an"}
            {step === "code" && `Code an +49 ${currentPhone} gesendet`}
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
                        <PhoneInput
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={isLoading}
                        />
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
                  {isLoading ? "Code wird gesendet…" : "Code anfordern"}
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
                      <SmsCodeInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={isLoading}
                          autoFocus
                      />
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
                  {isLoading ? "Wird geprüft…" : "Anmelden"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setStep("phone");
                    codeForm.reset();
                    resetErrors();
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
                    const redirectUrl = getRedirectParam();
                    let path = "/onboarding";
                    if (redirectUrl) path += `?redirect=${encodeURIComponent(redirectUrl)}`;
                    window.location.href = path;
                  }}
                >
                  Ja, Account erstellen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    void api.auth.logout().catch(() => undefined);
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
