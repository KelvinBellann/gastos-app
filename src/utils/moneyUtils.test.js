// Test utilities for money conversions
describe('Money Conversion Utilities', () => {
  function formatBRLFromCents(cents) {
    const value = (cents || 0) / 100
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function parseBRLToCents(input) {
    const clean = String(input)
      .replace(/[^\d,.-]/g, '')
      .replace('.', '')
      .replace(',', '.')
    const num = Number(clean)
    if (Number.isNaN(num)) return null
    return Math.round(num * 100)
  }

  describe('formatBRLFromCents', () => {
    it('converts cents to BRL format', () => {
      expect(formatBRLFromCents(10000)).toBe('R$ 100,00')
    })

    it('handles zero cents', () => {
      expect(formatBRLFromCents(0)).toBe('R$ 0,00')
    })

    it('handles null/undefined', () => {
      expect(formatBRLFromCents(null)).toBe('R$ 0,00')
      expect(formatBRLFromCents(undefined)).toBe('R$ 0,00')
    })

    it('formats large values', () => {
      expect(formatBRLFromCents(123456789)).toBe('R$ 1.234.567,89')
    })

    it('handles odd cent values', () => {
      expect(formatBRLFromCents(12345)).toBe('R$ 123,45')
    })
  })

  describe('parseBRLToCents', () => {
    it('converts BRL string to cents', () => {
      expect(parseBRLToCents('100,00')).toBe(10000)
    })

    it('removes currency symbols', () => {
      expect(parseBRLToCents('R$ 100,00')).toBe(10000)
    })

    it('handles decimal format with periods', () => {
      expect(parseBRLToCents('1.234,56')).toBe(123456)
    })

    it('returns null for invalid input', () => {
      expect(parseBRLToCents('abc')).toBeNull()
      expect(parseBRLToCents('R$ abc')).toBeNull()
    })

    it('handles zero', () => {
      expect(parseBRLToCents('0,00')).toBe(0)
      expect(parseBRLToCents('0')).toBe(0)
    })

    it('handles string conversion', () => {
      expect(parseBRLToCents(100)).toBe(10000)
    })

    it('rounds correctly', () => {
      expect(parseBRLToCents('100,005')).toBe(10001)
    })
  })

  describe('Roundtrip conversion', () => {
    it('converts cents to BRL and back', () => {
      const original = 50000
      const formatted = formatBRLFromCents(original)
      const extracted = formatted.replace('R$ ', '')
      const back = parseBRLToCents(extracted)
      expect(back).toBe(original)
    })

    it('handles multiple currencies', () => {
      const testValues = [0, 100, 1000, 10000, 100000, 1000000]
      testValues.forEach(value => {
        const formatted = formatBRLFromCents(value)
        const extracted = formatted.replace('R$ ', '')
        const back = parseBRLToCents(extracted)
        expect(back).toBe(value)
      })
    })
  })
})
