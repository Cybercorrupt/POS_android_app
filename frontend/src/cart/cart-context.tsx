import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { computeTotals, type CartLine, type SaleTotals } from "@/src/db/repo/sales";
import type { DiscountType, Product } from "@/src/db/types";

export interface CartItem extends CartLine {
  max_stock: number;
}

interface CartApi {
  items: CartItem[];
  customerId: string | null;
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  count: number;
  totals: SaleTotals;
  addProduct: (product: Product) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (type: DiscountType, value: number) => void;
  setTax: (percent: number) => void;
}

const CartContext = createContext<CartApi | null>(null);

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>("nominal");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);

  const addProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        const qty = Math.min(existing.qty + 1, product.current_stock);
        return prev.map((i) => (i.product_id === product.id ? { ...i, qty } : i));
      }
      if (product.current_stock <= 0) return prev;
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          price: product.sell_price,
          qty: 1,
          max_stock: product.current_stock,
        },
      ];
    });
  }, []);

  const increment = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, qty: Math.min(i.qty + 1, i.max_stock) } : i)),
    );
  }, []);

  const decrement = useCallback((productId: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, qty: Math.max(0, Math.min(qty, i.max_stock)) } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setCustomerId(null);
    setDiscountType("nominal");
    setDiscountValue(0);
    setTaxPercent(0);
  }, []);

  const setDiscount = useCallback((type: DiscountType, value: number) => {
    setDiscountType(type);
    setDiscountValue(Math.max(0, value));
  }, []);

  const setTax = useCallback((percent: number) => setTaxPercent(Math.max(0, percent)), []);

  const totals = useMemo(
    () => computeTotals(items, discountType, discountValue, taxPercent),
    [items, discountType, discountValue, taxPercent],
  );

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  const value = useMemo<CartApi>(
    () => ({
      items,
      customerId,
      discountType,
      discountValue,
      taxPercent,
      count,
      totals,
      addProduct,
      increment,
      decrement,
      setQty,
      remove,
      clear,
      setCustomer: setCustomerId,
      setDiscount,
      setTax,
    }),
    [items, customerId, discountType, discountValue, taxPercent, count, totals, addProduct, increment, decrement, setQty, remove, clear, setDiscount, setTax],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
