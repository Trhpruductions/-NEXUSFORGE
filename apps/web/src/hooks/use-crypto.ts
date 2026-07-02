import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";

export interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volatility: number;
  supplyLimit: string;
  currentSupply: string;
}

export function useCrypto() {
  const { accessToken, hydrated } = useAuthStore();
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!accessToken) return;
    try {
      const resp = await api.get("/api/crypto/assets");
      setAssets(resp.data.assets || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const executeSwap = async (fromSymbol: string, toSymbol: string, amount: string) => {
    if (!accessToken) return null;
    try {
      const resp = await api.post("/api/crypto/swap", { fromSymbol, toSymbol, amount });
      return resp.data;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      return null;
    }
  };



  useEffect(() => {
    if (hydrated && accessToken) {
      fetchAssets();
      const interval = setInterval(fetchAssets, 5000); // 5s tick for industrial feel
      return () => clearInterval(interval);
    }
  }, [fetchAssets, hydrated, accessToken]);

  return { assets, loading, error, executeSwap, refresh: fetchAssets };
}

