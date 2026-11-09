// Vale-alimentacao: valor por dia util, com desconto em folha sobre o total do mes
export const FOOD_DAILY_CENTS = 3971;
export const FOOD_DISCOUNT_PCT = 3;

// Feriados nacionais de data fixa. Carnaval e Corpus Christi sao ponto facultativo e
// feriado local depende da cidade: nesses casos o numero de dias e ajustado na tela.
const FIXED_HOLIDAYS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Domingo de Pascoa (Meeus/Jones/Butcher), para achar a Sexta-feira Santa
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(year, Math.floor(n / 31) - 1, (n % 31) + 1);
}

export function businessDaysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const easter = easterSunday(year);
  const goodFriday = new Date(year, easter.getMonth(), easter.getDate() - 2).getTime();

  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const holiday = date.getTime() === goodFriday || FIXED_HOLIDAYS.includes(`${pad(month)}-${pad(day)}`);
    if (!weekend && !holiday) count++;
  }
  return count;
}

export function foodAllowanceCents(days) {
  const gross = FOOD_DAILY_CENTS * days;
  return gross - Math.round((gross * FOOD_DISCOUNT_PCT) / 100);
}

export function isValidFoodDays(text) {
  return /^\d{1,2}$/.test(text) && Number(text) <= 31;
}
