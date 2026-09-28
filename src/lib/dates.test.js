import { toISODate, parseISODate, isValidISODate, formatDatePT } from "./dates";

describe("dates", () => {
  test("toISODate usa o fuso local, nao UTC", () => {
    // 23h30 local: toISOString() daria o dia seguinte em qualquer fuso a oeste de UTC
    const d = new Date(2026, 8, 27, 23, 30);
    expect(toISODate(d)).toBe("2026-09-27");
  });

  test("parseISODate devolve o dia certo no fuso local", () => {
    const d = parseISODate("2026-09-27");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(27);
  });

  test("parseISODate rejeita data inexistente e entrada invalida", () => {
    expect(parseISODate("2024-02-31")).toBeNull();
    expect(parseISODate("2024-13-01")).toBeNull();
    expect(parseISODate("")).toBeNull();
    expect(parseISODate(null)).toBeNull();
    expect(parseISODate("abc")).toBeNull();
  });

  test("isValidISODate", () => {
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(isValidISODate("2023-02-29")).toBe(false);
  });

  test("formatDatePT formata em pt-BR e devolve vazio para nulo", () => {
    expect(formatDatePT("2026-09-27")).toBe("27/09/2026");
    expect(formatDatePT(null)).toBe("");
    expect(formatDatePT(undefined)).toBe("");
  });
});
