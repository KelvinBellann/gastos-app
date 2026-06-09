import { render, screen, fireEvent } from '@testing-library/react'
import MoneyInput from './MoneyInput'

describe('MoneyInput Component', () => {
  it('renders with label', () => {
    const mockOnChange = jest.fn()
    render(
      <MoneyInput label="Test Label" value={0} onChange={mockOnChange} />
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('displays value formatted correctly', () => {
    const mockOnChange = jest.fn()
    render(
      <MoneyInput label="Salário" value={250000} onChange={mockOnChange} />
    )
    const input = screen.getByDisplayValue('2.500,00')
    expect(input).toBeInTheDocument()
  })

  it('handles empty value correctly', () => {
    const mockOnChange = jest.fn()
    render(<MoneyInput label="Test" value={0} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('0,00')
    expect(input.value).toBe('')
  })

  it('calls onChange with cents when user types', () => {
    const mockOnChange = jest.fn()
    render(<MoneyInput label="Test" value={0} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('0,00')

    fireEvent.change(input, { target: { value: '100' } })
    expect(mockOnChange).toHaveBeenCalledWith(100)
  })

  it('removes non-numeric characters from input', () => {
    const mockOnChange = jest.fn()
    render(<MoneyInput label="Test" value={0} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('0,00')

    fireEvent.change(input, { target: { value: 'R$1.000,50' } })
    expect(mockOnChange).toHaveBeenCalledWith(100050)
  })

  it('handles zero value correctly', () => {
    const mockOnChange = jest.fn()
    render(<MoneyInput label="Test" value={0} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('0,00')

    fireEvent.change(input, { target: { value: '0' } })
    expect(mockOnChange).toHaveBeenCalledWith(0)
  })

  it('updates display when value prop changes', () => {
    const mockOnChange = jest.fn()
    const { rerender } = render(
      <MoneyInput label="Test" value={10000} onChange={mockOnChange} />
    )

    expect(screen.getByDisplayValue('100,00')).toBeInTheDocument()

    rerender(<MoneyInput label="Test" value={50000} onChange={mockOnChange} />)
    expect(screen.getByDisplayValue('500,00')).toBeInTheDocument()
  })

  it('calls onChange with empty string when clearing input', () => {
    const mockOnChange = jest.fn()
    render(
      <MoneyInput label="Test" value={10000} onChange={mockOnChange} />
    )
    const input = screen.getByDisplayValue('100,00')

    fireEvent.change(input, { target: { value: '' } })
    expect(mockOnChange).toHaveBeenCalledWith('')
  })

  it('is disabled when disabled prop is true', () => {
    const mockOnChange = jest.fn()
    render(
      <MoneyInput
        label="Test"
        value={0}
        onChange={mockOnChange}
        disabled={true}
      />
    )
    const input = screen.getByPlaceholderText('0,00')
    expect(input).toBeDisabled()
  })

  it('formats large values correctly', () => {
    const mockOnChange = jest.fn()
    render(
      <MoneyInput label="Test" value={123456789} onChange={mockOnChange} />
    )
    // 123456789 cents = 1.234.567,89 reais
    expect(screen.getByDisplayValue('1.234.567,89')).toBeInTheDocument()
  })
})
