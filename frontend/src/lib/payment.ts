import type { IconName } from "@/src/components/ui/icon";
import type { PaymentMethod, PaymentStatus } from "@/src/db/types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: IconName }[] = [
  { value: "cash", label: "Tunai", icon: "cash" },
  { value: "transfer", label: "Transfer", icon: "bank-transfer" },
  { value: "qris", label: "QRIS", icon: "qrcode" },
  { value: "debit", label: "Debit/Kartu", icon: "credit-card-outline" },
  { value: "ewallet", label: "E-wallet", icon: "wallet-outline" },
];

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function paymentMethodIcon(method: PaymentMethod): IconName {
  return PAYMENT_METHODS.find((m) => m.value === method)?.icon ?? "cash";
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return status === "lunas" ? "Lunas" : "Belum Lunas";
}
