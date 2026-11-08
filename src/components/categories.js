import {
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  Bus,
  Car,
  Cat,
  CreditCard,
  Hamburger,
  HandCoins,
  Heartbeat,
  House,
  Lightning,
  Money,
  Pill,
  PixLogo,
  ShoppingCart,
  Shuffle,
  Tag,
} from "@phosphor-icons/react";

// Os valores (value) sao os gravados nos dados; mudar quebra o historico
export const CATEGORIES = [
  { value: "fixos", label: "Fixos", Icon: House },
  { value: "mercado", label: "Mercado", Icon: ShoppingCart },
  { value: "aleatorios", label: "Aleatórios", Icon: Shuffle },
  { value: "emprestado", label: "Emprestado", Icon: HandCoins },
  { value: "gatos", label: "Gatos", Icon: Cat },
  { value: "lanches", label: "Lanches", Icon: Hamburger },
  { value: "dinheiro", label: "Dinheiro", Icon: Money },
  { value: "carro", label: "Carro", Icon: Car },
  { value: "farmacia", label: "Farmácia", Icon: Pill },
  { value: "assinaturas", label: "Assinaturas", Icon: ArrowsClockwise },
  { value: "banco", label: "Banco", Icon: Bank },
  { value: "contas", label: "Contas", Icon: Lightning },
  { value: "transporte", label: "Transporte", Icon: Bus },
  { value: "saude", label: "Saúde", Icon: Heartbeat },
  { value: "transferencias", label: "Transferências", Icon: ArrowsLeftRight },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export function getCategory(value) {
  return CATEGORY_MAP[value] || { value, label: value || "Sem categoria", Icon: Tag };
}

export const PAYMENT_METHODS = [
  { value: "debit", label: "Débito", Icon: Bank },
  { value: "pix", label: "Pix", Icon: PixLogo },
  { value: "credit", label: "Crédito", Icon: CreditCard },
];

export function getPaymentLabel(expense) {
  if (expense.payment_method === "fixed") return "Fixo";
  if (expense.payment_method === "credit") return `Crédito ${expense.installments}x`;
  if (expense.payment_method === "pix") return "Pix";
  return "Débito";
}
