"use client";

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { toNationalDigits } from "@/lib/phone";

/**
 * A German mobile number: "+49" in front, the rest typed in any form (spaces, a leading 0) and kept as digits.
 * Used as the control of a form field (login, changing the number).
 */
export function PhoneInput({
  value,
  onChange,
  disabled,
  ...input
}: Readonly<
  Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
    value: string;
    onChange: (digits: string) => void;
  }
>) {
  // id, aria-describedby and aria-invalid come from the form field (its label, hint and error belong to the input)
  return (
    <InputGroup data-disabled={disabled || undefined}>
      <InputGroupAddon>
        <InputGroupText>+49</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        {...input}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="151 12345678"
        value={value}
        onChange={(e) => onChange(toNationalDigits(e.target.value))}
        disabled={disabled}
      />
    </InputGroup>
  );
}

const SLOTS = "*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl";

/** The 6-digit code of the SMS, in two groups of three (as it is read). */
export function SmsCodeInput({
  value,
  onChange,
  disabled,
  autoFocus,
  ...field
}: Readonly<{
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** From the form field: label, hint and error belong to the input. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>) {
  return (
    <div className="flex justify-center">
      <InputOTP {...field} maxLength={6} disabled={disabled} autoFocus={autoFocus} value={value} onChange={onChange}>
        <InputOTPGroup className={SLOTS}>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator className="mx-2" />
        <InputOTPGroup className={SLOTS}>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
