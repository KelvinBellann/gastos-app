// Test MoneyInput formatting logic
describe('MoneyInput Formatting Logic', () => {
  function formatCents(cents) {
    if (!cents) return ""
    const reais = Math.floor(cents / 100)
    const centavos = cents % 100
    return `${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`
  }

  it('formats zero correctly', () => {
    expect(formatCents(0)).toBe("")
  })

  it('formats single digit cents', () => {
    expect(formatCents(5)).toBe("0,05")
  })

  it('formats exact reais', () => {
    expect(formatCents(10000)).toBe("100,00")
  })

  it('formats with cents', () => {
    expect(formatCents(10050)).toBe("100,50")
  })

  it('formats large values with thousand separator', () => {
    expect(formatCents(250000)).toBe("2.500,00")
  })

  it('handles very large values', () => {
    expect(formatCents(123456789)).toBe("1.234.567,89")
  })

  it('handles null', () => {
    expect(formatCents(null)).toBe("")
  })

  it('handles undefined', () => {
    expect(formatCents(undefined)).toBe("")
  })
})

describe('MoneyInput Input Parsing Logic', () => {
  function handleChange(value) {
    const onlyNumbers = value.replace(/\D/g, "")
    const cents = parseInt(onlyNumbers) || 0
    return cents
  }

  it('parses simple number', () => {
    expect(handleChange("100")).toBe(100)
  })

  it('parses formatted input', () => {
    expect(handleChange("1.500,50")).toBe(150050)
  })

  it('removes all non-numeric', () => {
    expect(handleChange("R$ 100,00")).toBe(10000)
  })

  it('handles empty string', () => {
    expect(handleChange("")).toBe(0)
  })

  it('handles zero', () => {
    expect(handleChange("0")).toBe(0)
  })

  it('handles special characters', () => {
    expect(handleChange("R$ 2.500,99")).toBe(250099)
  })
})
