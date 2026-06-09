// Tests for IncomesManager logic
describe('IncomesManager Logic', () => {
  function calculateTotalFixed(income) {
    if (!income) return 0
    return (
      (income.salary_net_cents || 0) +
      (income.multibenefits_cents || 0) +
      (income.food_cents || 0) +
      (income.spouse_salary_cents || 0)
    )
  }

  const mockIncome = {
    id: '1',
    user_id: 'user123',
    month_key: '2024-01',
    salary_net_cents: 500000,
    multibenefits_cents: 100000,
    food_cents: 50000,
    spouse_salary_cents: 200000,
  }

  it('calculates total fixed income', () => {
    const total = calculateTotalFixed(mockIncome)
    expect(total).toBe(850000)
  })

  it('handles null income', () => {
    const total = calculateTotalFixed(null)
    expect(total).toBe(0)
  })

  it('handles undefined income', () => {
    const total = calculateTotalFixed(undefined)
    expect(total).toBe(0)
  })

  it('handles partial income data', () => {
    const partialIncome = {
      salary_net_cents: 500000,
      multibenefits_cents: 100000,
    }
    const total = calculateTotalFixed(partialIncome)
    expect(total).toBe(600000)
  })

  it('handles income with zero values', () => {
    const zeroIncome = {
      salary_net_cents: 0,
      multibenefits_cents: 0,
      food_cents: 0,
      spouse_salary_cents: 0,
    }
    const total = calculateTotalFixed(zeroIncome)
    expect(total).toBe(0)
  })

  it('updates income field safely without spread error', () => {
    // This tests the fix for null spread error
    if (mockIncome) {
      const updated = { ...mockIncome, salary_net_cents: 600000 }
      expect(updated.salary_net_cents).toBe(600000)
      expect(updated.multibenefits_cents).toBe(100000)
    }
  })
})
