"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";

export interface EconomyAccount {
  currencyType: string;
  balance: string;
  lifetimeEarnings: string;
  lastSyncAt: string;
}

export function useEconomy(userId?: string) {
  const { accessToken, hydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<EconomyAccount | null>(null);

  useEffect(() => {
    if (!userId || !hydrated || !accessToken) {
      if (hydrated && !accessToken) {
        setLoading(false);
      }
      return;
    }

    const fetchEconomy = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/economy/${userId}`);
        const accounts = response.data;
        // Primary account selection
        const primary = Array.isArray(accounts) 
          ? accounts.find((a: any) => a.currencyType === 'NC') || accounts[0]
          : accounts;
        setData(primary);
      } catch (err: any) {
        setError(err);
        // Fallback for demonstration
        setData({
          currencyType: 'NC',
          balance: '245000',
          lifetimeEarnings: '1250000',
          lastSyncAt: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEconomy();
  }, [userId, accessToken, hydrated]);

  return { data, loading, error };
}

