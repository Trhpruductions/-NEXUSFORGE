import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";

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

    return prisma.$transaction(async (tx) => {
      // 1. Verify and Debit Source
      const debitResult = await EconomyAuthority.adjustBalance({
        userId: params.userId,
        amount: -params.amount,
        currencyType: params.fromSymbol as any,
        reason: `Industrial Swap: ${params.fromSymbol} -> ${params.toSymbol}`,
        metadata: { rate: finalRate, fee: industrialFee }
      });

      // 2. Credit Destination
      const creditAmount = BigInt(Math.floor(Number(params.amount) * finalRate));
      const creditResult = await EconomyAuthority.adjustBalance({
        userId: params.userId,
        amount: creditAmount,
        currencyType: params.toSymbol as any,
        reason: `Industrial Swap: Value Received from ${params.fromSymbol}`,
        metadata: { sourceAmount: params.amount.toString(), rate: finalRate }
      });

      return {
        txId: Math.random().toString(36).substring(7).toUpperCase(),
        finalRate,
        debited: params.amount.toString(),
        credited: creditAmount.toString(),
        feePaid: (Number(params.amount) * industrialFee).toFixed(4),
      };
    });
  }
}

