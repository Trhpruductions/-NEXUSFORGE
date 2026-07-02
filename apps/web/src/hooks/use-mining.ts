"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";

export interface MiningRig {
  rigId: string;
  name: string;
  hashRate: number;
  efficiency: number;
  status: string;
  currentYield: string;
  nextTemperatureRisk: number;
}

export function useMining() {
  const { accessToken, hydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rigs, setRigs] = useState<MiningRig[]>([]);
  const [isHarvesting, setIsHarvesting] = useState(false);

  const fetchRigs = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const response = await api.get("/api/mining/rigs");
      setRigs(response.data.rigs || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const harvestAll = async () => {
    if (!accessToken) return null;
    try {
      setIsHarvesting(true);
      const response = await api.post("/api/mining/harvest-all");
      await fetchRigs(); // Refresh telemetry after harvest
      return response.data.harvested;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      return null;
    } finally {
      setIsHarvesting(false);
    }
  };



  useEffect(() => {
    if (hydrated && accessToken) {
      fetchRigs();
      const interval = setInterval(fetchRigs, 10000); // Polling telemetry every 10s
      return () => clearInterval(interval);
    }
  }, [fetchRigs, hydrated, accessToken]);

  return { 
    rigs, 
    loading, 
    error, 
    isHarvesting, 
    harvestAll,
    refresh: fetchRigs 
  };
}

