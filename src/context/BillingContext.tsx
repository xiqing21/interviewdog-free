import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BillingEntitlement, CommercialPlanId } from '../types';
import { COMMERCIAL_MODE, FREE_TRIAL_MINUTES } from '../config/commercial';
import * as billingService from '../services/billingService';
import { useAuth } from '../hooks/useAuth';

export interface BillingContextValue {
  entitlement: BillingEntitlement | null;
  loading: boolean;
  error: string | null;
  remainingSeconds: number;
  hasAccess: boolean;
  refreshBilling: () => Promise<void>;
  consumeSeconds: (seconds: number) => Promise<void>;
  startCheckout: (planId: CommercialPlanId) => Promise<void>;
}

export const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<BillingEntitlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBilling = useCallback(async () => {
    if (!COMMERCIAL_MODE || !user) {
      setEntitlement(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEntitlement(await billingService.ensureEntitlement());
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取账户额度失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  const consumeSeconds = useCallback(async (seconds: number) => {
    if (!COMMERCIAL_MODE || !user || seconds <= 0) return;
    try {
      const updated = await billingService.consumeSeconds(seconds);
      if (updated) setEntitlement(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步用量失败');
    }
  }, [user]);

  const startCheckout = useCallback(async (planId: CommercialPlanId) => {
    setLoading(true);
    setError(null);
    try {
      const url = await billingService.createCheckoutSession(planId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建支付订单失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const remainingSeconds = billingService.remainingSeconds(entitlement);
  const hasAccess = !COMMERCIAL_MODE || remainingSeconds > 0;

  const value = useMemo<BillingContextValue>(() => ({
    entitlement,
    loading,
    error,
    remainingSeconds: user ? remainingSeconds : FREE_TRIAL_MINUTES * 60,
    hasAccess,
    refreshBilling,
    consumeSeconds,
    startCheckout,
  }), [consumeSeconds, entitlement, error, hasAccess, loading, refreshBilling, remainingSeconds, startCheckout, user]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
