import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PhoneInput, SmsCodeInput } from '../phone-fields'
import { ErrorAlert } from '../error-alert'
import { codeSchema, phoneSchema } from '@/lib/phone'
import { onboardingSchema, profileSchema } from '@/lib/profile'

describe('PhoneInput', () => {
  it('puts +49 in front and keeps the number as digits, however it is typed', () => {
    const onChange = vi.fn()
    render(<PhoneInput id="phone" value="" onChange={onChange} aria-invalid />)
    expect(screen.getByText('+49')).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'tel-national')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('id', 'phone') // the label of the form field belongs to the input
    fireEvent.change(input, { target: { value: '0151 / 234 56-78' } })
    expect(onChange).toHaveBeenCalledWith('1512345678')
  })
})

describe('SmsCodeInput', () => {
  it('takes the six digits of the code', () => {
    const onChange = vi.fn()
    render(<SmsCodeInput value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } })
    expect(onChange).toHaveBeenCalledWith('123456')
  })
})

describe('schemas', () => {
  it('check phone and code', () => {
    expect(phoneSchema.safeParse({ phone: '15123456789' }).success).toBe(true)
    expect(phoneSchema.safeParse({ phone: '3012345678' }).success).toBe(false) // a landline
    expect(codeSchema.safeParse({ code: '12345' }).success).toBe(false)
  })

  it('need a name everywhere and the e-mail only on the first start', () => {
    expect(profileSchema.safeParse({ name: 'Ada', email: '' }).success).toBe(true)
    expect(profileSchema.safeParse({ name: ' A ', email: '' }).success).toBe(false)
    expect(onboardingSchema.safeParse({ name: 'Ada', email: '' }).success).toBe(false)
    expect(onboardingSchema.safeParse({ name: 'Ada', email: 'ada@example.org' }).success).toBe(true)
  })
})

describe('ErrorAlert', () => {
  it('says what went wrong as an alert, with the way out below', () => {
    render(<ErrorAlert message="Das hat nicht geklappt."><button type="button">Erneut versuchen</button></ErrorAlert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Das hat nicht geklappt.')
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
  })
})
