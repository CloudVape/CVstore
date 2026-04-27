import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  priceCents: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "vapevault-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((curr) => {
      const existing = curr.find((i) => i.productId === product.id);
      if (existing) {
        return curr.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...curr,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          imageUrl: product.imageUrl,
          priceCents: product.priceCents,
          quantity,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((curr) => curr.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity < 1) {
      setItems((curr) => curr.filter((i) => i.productId !== productId));
      return;
    }
    setItems((curr) => curr.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, itemCount, subtotalCents, addItem, removeItem, updateQuantity, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
