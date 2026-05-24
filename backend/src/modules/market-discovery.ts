import { EventEmitter } from 'events';
import { PolymarketMarketInfo, MarketId } from '../types';
import { logger } from './logger';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const REFRESH_INTERVAL = 60 * 1000; // refresh every 1 minute (markets change every 5/15 min)

const MARKET_INTERVALS: Record<MarketId, number> = {
  BTC_5MIN: 300,   // 5 minutes in seconds
  BTC_15MIN: 900,  // 15 minutes in seconds
};

const MARKET_SLUG_PREFIXES: Record<MarketId, string> = {
  BTC_5MIN: 'btc-updown-5m',
  BTC_15MIN: 'btc-updown-15m',
};

interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  active: boolean;
  closed: boolean;
  endDate: string;
  tokens?: Array<{ token_id: string; outcome: string; price: number }>;
  clobTokenIds?: string[];
}

export class MarketDiscovery extends EventEmitter {
  private markets: Map<MarketId, PolymarketMarketInfo> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  // ─── Slug-based discovery (most reliable) ────────────────────────────────

  private getCurrentSlug(marketId: MarketId): string {
    const intervalSec = MARKET_INTERVALS[marketId];
    const nowSec = Math.floor(Date.now() / 1000);
    // Polymarket slugs use: floor(now / interval) * interval - interval
    // i.e. the slug = start of the PREVIOUS window (market is created 1 window early)
    // Verified from real slugs:
    //   14:30-14:45 ET window → slug ends in 1779560100 = floor(18:30UTC/900)*900 - 900
    //   14:45-15:00 ET window → slug ends in 1779561000 = floor(18:45UTC/900)*900 - 900
    const windowSlug = Math.floor(nowSec / intervalSec) * intervalSec - intervalSec;
    return `${MARKET_SLUG_PREFIXES[marketId]}-${windowSlug}`;
  }

  // Also try the next slug in case we are right at the boundary
  private getNextSlug(marketId: MarketId): string {
    const intervalSec = MARKET_INTERVALS[marketId];
    const nowSec = Math.floor(Date.now() / 1000);
    const windowSlug = Math.floor(nowSec / intervalSec) * intervalSec;
    return `${MARKET_SLUG_PREFIXES[marketId]}-${windowSlug}`;
  }

  private async fetchBySlug(marketId: MarketId): Promise<PolymarketMarketInfo | null> {
    const slug = this.getCurrentSlug(marketId);
    const url = `${GAMMA_API}/markets?slug=${slug}`;

    const slugsToTry = [slug, this.getNextSlug(marketId)];

    for (const trySlug of slugsToTry) {
      try {
        const res = await fetch(`${GAMMA_API}/markets?slug=${trySlug}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = await res.json() as GammaMarket[];
        const markets = Array.isArray(data) ? data : [];
        const market = markets.find(m => m.slug === trySlug && !m.closed)
          ?? markets.find(m => !m.closed);

        if (market) {
          if (trySlug !== slug) {
            logger.debug(`Used boundary slug ${trySlug} instead of ${slug}`);
          }
          return this.parseMarket(market, marketId);
        }
      } catch (e) {
        logger.warn(`Failed to fetch slug ${trySlug}`, { error: e });
      }
    }

    logger.warn(`No market found for any slug`, { tried: slugsToTry });
    return null;
  }

  private parseMarket(market: GammaMarket, marketType: MarketId): PolymarketMarketInfo | null {
    let upTokenId = '';
    let downTokenId = '';

    if (market.tokens && market.tokens.length >= 2) {
      for (const token of market.tokens) {
        const outcome = token.outcome.toLowerCase();
        if (outcome === 'yes' || outcome === 'up') upTokenId = token.token_id;
        if (outcome === 'no' || outcome === 'down') downTokenId = token.token_id;
      }
    } else if (market.clobTokenIds && market.clobTokenIds.length >= 2) {
      upTokenId = market.clobTokenIds[0]!;
      downTokenId = market.clobTokenIds[1]!;
    }

    if (!upTokenId || !downTokenId || !market.conditionId) {
      logger.warn('Could not parse token IDs from market', { slug: market.slug });
      return null;
    }

    return {
      conditionId: market.conditionId,
      question: market.question,
      upTokenId,
      downTokenId,
      active: true,
      endDate: market.endDate,
      marketType,
    };
  }

  // ─── Main discovery ────────────────────────────────────────────────────────

  async discoverMarkets(): Promise<void> {
    logger.info('Discovering Polymarket BTC markets via slug...');

    let found = 0;
    for (const marketId of ['BTC_5MIN', 'BTC_15MIN'] as MarketId[]) {
      const info = await this.fetchBySlug(marketId);
      if (info) {
        const old = this.markets.get(marketId);
        this.markets.set(marketId, info);
        found++;
        if (!old || old.conditionId !== info.conditionId) {
          logger.info(`Market found [${marketId}]`, {
            slug: this.getCurrentSlug(marketId),
            question: info.question.substring(0, 60),
            upToken: info.upTokenId.substring(0, 12) + '...',
            downToken: info.downTokenId.substring(0, 12) + '...',
          });
        }
      } else {
        logger.warn(`Could not find market [${marketId}] slug=${this.getCurrentSlug(marketId)}`);
      }
    }

    if (found > 0) {
      this.emit('markets_updated', this.getAllMarkets());
    } else {
      logger.warn('No markets found via slug — falling back to mock mode');
      this.setupMockMarkets();
    }
  }

  private setupMockMarkets(): void {
    this.markets.set('BTC_5MIN', {
      conditionId: 'mock-5min-condition',
      question: '[MOCK] Will BTC go UP in the next 5 minutes?',
      upTokenId: 'mock-5min-up-token',
      downTokenId: 'mock-5min-down-token',
      active: false,
      endDate: '',
      marketType: 'BTC_5MIN',
    });
    this.markets.set('BTC_15MIN', {
      conditionId: 'mock-15min-condition',
      question: '[MOCK] Will BTC go UP in the next 15 minutes?',
      upTokenId: 'mock-15min-up-token',
      downTokenId: 'mock-15min-down-token',
      active: false,
      endDate: '',
      marketType: 'BTC_15MIN',
    });
    this.emit('markets_updated', this.getAllMarkets());
  }

  // ─── Auto-refresh ─────────────────────────────────────────────────────────

  startAutoRefresh(): void {
    // Refresh every minute — catches market rollovers quickly
    this.refreshTimer = setInterval(async () => {
      const oldMarkets = new Map(this.markets);
      await this.discoverMarkets();

      for (const [id, market] of this.markets) {
        const old = oldMarkets.get(id);
        if (!old || old.conditionId !== market.conditionId) {
          logger.info(`Market rolled over [${id}]`, { new: market.conditionId });
          this.emit('market_rollover', { marketId: id, market });
        }
      }
    }, REFRESH_INTERVAL);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getMarket(marketId: MarketId): PolymarketMarketInfo | undefined {
    return this.markets.get(marketId);
  }

  getAllMarkets(): PolymarketMarketInfo[] {
    return Array.from(this.markets.values());
  }

  isMockMode(): boolean {
    return Array.from(this.markets.values()).some(m => m.conditionId.startsWith('mock-'));
  }
}
