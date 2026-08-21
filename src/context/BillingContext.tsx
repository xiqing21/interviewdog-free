import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BillingEntitlement, CommercialPlanId } from '../types';
import { COMMERCIAL_MODE } from '../config/commercial';
import * as billingService from '../services/billingService';
import { useAuth } from '../hooks/useAuth';

export interface BillingContextValue {
  entitlement: BillingEntitlement | null;
  loading: boolean;
  error: string | null;
  remainingSeconds: number;
  hasAccess: boolean;
  refreshBilling: () => Promise<BillingEntitlement | null>;
  consumeSeconds: (seconds: number) => Promise<void>;
  startCheckout: (planId: CommercialPlanId) => Promise<void>;
  redeemCardKey: (code: string) => Promise<{ message: string; minutes: number }>;
}

export const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<BillingEntitlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBilling = useCallback(async (): Promise<BillingEntitlement | null> => {
    if (!COMMERCIAL_MODE || !user) {
      setEntitlement(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const nextEntitlement = await billingService.ensureEntitlement();
      setEntitlement(nextEntitlement);
      return nextEntitlement;
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取账户额度失败');
      return null;
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

  const redeemCardKey = useCallback(async (code: string): Promise<{ message: string; minutes: number }> => {
    setLoading(true);
    setError(null);
    try {
      const result = await billingService.redeemCardKey(code);
      setEntitlement(result.entitlement);
      return { message: result.message, minutes: result.minutes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '卡密兑换失败';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const remainingSeconds = billingService.remainingSeconds(entitlement);
  const hasAccess = !COMMERCIAL_MODE || Boolean(user && remainingSeconds > 0);

  const value = useMemo<BillingContextValue>(() => ({
    entitlement,
    loading,
    error,
    remainingSeconds: user ? remainingSeconds : 0,
    hasAccess,
    refreshBilling,
    consumeSeconds,
    startCheckout,
    redeemCardKey,
  }), [consumeSeconds, entitlement, error, hasAccess, loading, redeemCardKey, refreshBilling, remainingSeconds, startCheckout, user]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
