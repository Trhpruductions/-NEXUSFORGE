import { randomUUID } from "node:crypto";
import { EconomyAuthority, type CurrencyType } from "./economy-authority.js";

export interface CryptoAssetStats {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volatility: number;
  supplyLimit: bigint;
  currentSupply: bigint;
}

export class CryptoAuthority {
  private static assets: Map<string, CryptoAssetStats> = new Map([
    ["NF_ETH", { symbol: "NF_ETH", name: "Nexus Ethereum", price: 2840.52, marketCap: 1200000, volatility: 0.05, supplyLimit: 100000000n, currentSupply: 4200000n }],
    ["NF_BTC", { symbol: "NF_BTC", name: "Nexus Bitcoin", price: 64200.18, marketCap: 8500000, volatility: 0.02, supplyLimit: 21000000n, currentSupply: 1200000n }],
    ["FORGE", { symbol: "FORGE", name: "Forge Token", price: 1.42, marketCap: 500000, volatility: 0.15, supplyLimit: 1000000000n, currentSupply: 85000000n }],
  ]);

  /**
   * Retrieves live industrial stats for a crypto asset.
   */
  static async getAssetStats(symbol: string): Promise<CryptoAssetStats> {
    const asset = this.assets.get(symbol);
    if (!asset) throw new Error(`Asset ${symbol} not found in Nexus Registry.`);
    
    // Simulate industrial flux
    return {
      ...asset,
      price: +(asset.price + (Math.random() * asset.price * 0.001 - asset.price * 0.0005)).toFixed(2),
    };
  }

  /**
   * Lists all tradeable industrial assets.
   */
  static async listAssets() {
    const list: CryptoAssetStats[] = [];
    for (const [symbol] of this.assets) {
      list.push(await this.getAssetStats(symbol));
    }
    return list;
  }

  /**
   * Executes an atomic swap between industrial assets.
   * Ensures zero-leakage and verified finality.
   */
  static async executeIndustrialSwap(params: {
    userId: string;
    fromSymbol: string;
    toSymbol: string;
    amount: bigint;
  }) {
    const fromAsset = await this.getAssetStats(params.fromSymbol);
    const toAsset = await this.getAssetStats(params.toSymbol);

    // Calculate industrial rate: (PriceFrom / PriceTo) * (1 - IndustrialFee)
    const industrialFee = 0.005; // 0.5% protocol fee
    const rawRate = fromAsset.price / toAsset.price;
    const finalRate = rawRate * (1 - industrialFee);

    // Exact integer maths (the rate is fixed to 9 decimal places), and both legs in ONE
    // transaction: before, the debit and credit were separate, so a failure in between
    // took the coins without paying out.
    const RATE_SCALE = 1_000_000_000n;
    const scaledRate = BigInt(Math.floor(finalRate * Number(RATE_SCALE)));
    const creditAmount = (params.amount * scaledRate) / RATE_SCALE;
    if (creditAmount <= 0n) {
      throw new Error("That amount is too small to swap.");
    }
    const txId = randomUUID();

    return EconomyAuthority.serializable(async (tx, retryCount) => {
      await EconomyAuthority.applyChange(tx, {
        userId: params.userId,
        amount: -params.amount,
        currencyType: params.fromSymbol as CurrencyType,
        reason: `Swap: ${params.fromSymbol} -> ${params.toSymbol}`,
        referenceId: `swap:${txId}`,
        metadata: { rate: finalRate, fee: industrialFee },
      }, retryCount);
      await EconomyAuthority.applyChange(tx, {
        userId: params.userId,
        amount: creditAmount,
        currencyType: params.toSymbol as CurrencyType,
        reason: `Swap: received from ${params.fromSymbol}`,
        referenceId: `swap:${txId}`,
        metadata: { sourceAmount: params.amount.toString(), rate: finalRate },
      }, retryCount);

      return {
        txId,
        finalRate,
        debited: params.amount.toString(),
        credited: creditAmount.toString(),
        feePaid: (Number(params.amount) * industrialFee).toFixed(4),
      };
    });
  }
}

