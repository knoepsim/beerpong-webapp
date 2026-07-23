"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setTokens } from "@/lib/auth";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestCode = async () => {
    if (phone.length < 5) {
      setError("Bitte gib eine gültige Telefonnummer ein.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.auth.requestCode(phone);
      setStep("code");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Senden des Codes";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Bitte gib den 6-stelligen Code ein.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.auth.verify(phone, code);
      setTokens(result.access_token, result.refresh_token);
      router.push("/tournaments");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ungültiger oder abgelaufener Code";
      setError(message);
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
            {step === "phone"
              ? "Melde dich mit deiner Telefonnummer an"
              : `Code an ${phone} gesendet`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+49 162 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestCode()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleRequestCode}
                disabled={isLoading}
              >
                {isLoading ? "Sende Code…" : "Code anfordern"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Verifizierungscode</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={isLoading}
              >
                {isLoading ? "Überprüfe…" : "Anmelden"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
              >
                Andere Nummer verwenden
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
