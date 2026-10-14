import { describe, expect, it } from 'vitest'
import { phoneSchema, toE164, toNationalDigits } from './phone'

const valid = (phone: string) => phoneSchema.safeParse({ phone }).success

describe('phoneSchema', () => {
  it.each(['15112345678', '1761234567', '16212345678', '1601234567', '15731234567'])(
    'accepts German mobile number %s',
    (phone) => expect(valid(phone)).toBe(true),
  )

  it.each([
    ['special rate 0900', '90012345678'],
    ['service 0180', '18012345678'],
    ['mass traffic 0137', '1371234567'],
    ['landline', '3012345678'],
    ['pager range', '1641234567'],
    ['too short', '15112'],
    ['too long', '1511234567890'],
    ['empty', ''],
  ])('rejects %s', (_name, phone) => expect(valid(phone)).toBe(false))

  it('explains why a number was rejected', () => {
    const res = phoneSchema.safeParse({ phone: '90012345678' })
    expect(res.success ? '' : res.error.issues[0].message).toContain('deutsche Handynummern')
  })
})

describe('helpers', () => {
  it('reduces input to national digits without leading zeros', () => {
    expect(toNationalDigits('0151 1234-5678')).toBe('15112345678')
  })
  it('builds the E.164 number', () => {
    expect(toE164('15112345678')).toBe('+4915112345678')
  })
})
