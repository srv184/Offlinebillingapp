import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CartItem } from '@/types';
import { DraftRepository } from '@/repositories/DraftRepository';
import { BillingService } from '@/services/BillingService';

interface BillingCartContextValue {
  loaded: boolean;
  customerName: string;
  items: CartItem[];
  setCustomerName: (name: string) => void;
  addItem: (item: Omit<CartItem, 'draftItemId'>) => void;
  updateItem: (draftItemId: string, patch: Partial<Omit<CartItem, 'draftItemId'>>) => void;
  removeItem: (draftItemId: string) => void;
  clearCart: () => Promise<void>;
  totals: { totalQuantity: number; totalAmount: number };
}

const BillingCartContext = createContext<BillingCartContextValue | undefined>(undefined);

/**
 * Backs the active cart with SQLite (draft_bills / draft_bill_items) so
 * that navigating away from Billing -- or the app being killed outright --
 * never silently destroys an in-progress bill (sections 7, 39, and the
 * "Application killed during billing" edge case in section 47).
 */
export function BillingCartProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [customerName, setCustomerNameState] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const draft = await DraftRepository.getActiveDraft();
      if (draft) {
        setCustomerNameState(draft.customerName);
        setItems(draft.items);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((name: string, currentItems: CartItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      DraftRepository.saveActiveDraft(name, currentItems).catch(() => {
        /* best-effort local scratch persistence; the in-memory state is
           still correct for the current session even if this write fails */
      });
    }, 300);
  }, []);

  const setCustomerName = useCallback(
    (name: string) => {
      setCustomerNameState(name);
      persist(name, items);
    },
    [items, persist]
  );

  const addItem = useCallback(
    (item: Omit<CartItem, 'draftItemId'>) => {
      const newItem: CartItem = { ...item, draftItemId: DraftRepository.newDraftItemId() };
      setItems((prev) => {
        const next = [...prev, newItem];
        persist(customerName, next);
        return next;
      });
    },
    [customerName, persist]
  );

  const updateItem = useCallback(
    (draftItemId: string, patch: Partial<Omit<CartItem, 'draftItemId'>>) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.draftItemId === draftItemId ? { ...i, ...patch } : i));
        persist(customerName, next);
        return next;
      });
    },
    [customerName, persist]
  );

  const removeItem = useCallback(
    (draftItemId: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.draftItemId !== draftItemId);
        persist(customerName, next);
        return next;
      });
    },
    [customerName, persist]
  );

  const clearCart = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCustomerNameState('');
    setItems([]);
    await DraftRepository.clearActiveDraft();
  }, []);

  const totals = BillingService.calculateBillTotals(items);

  return (
    <BillingCartContext.Provider
      value={{ loaded, customerName, items, setCustomerName, addItem, updateItem, removeItem, clearCart, totals }}
    >
      {children}
    </BillingCartContext.Provider>
  );
}

export function useBillingCart(): BillingCartContextValue {
  const ctx = useContext(BillingCartContext);
  if (!ctx) throw new Error('useBillingCart must be used within a BillingCartProvider');
  return ctx;
}
