import { ethers } from 'ethers';
import { OrderRequest, OrderResponse } from '../types';
import { logger } from './logger';

const CLOB_API = 'https://clob.polymarket.com';
const CHAIN_ID = 137; // Polygon mainnet

// Polymarket CTF Exchange contract address on Polygon
const EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

// EIP-712 types for Polymarket order
const ORDER_TYPE = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

const DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: EXCHANGE_ADDRESS,
};

// Signature type: 0 = EOA, 2 = POLY_PROXY
const SIGNATURE_TYPE = 0;

interface PolymarketOrderPayload {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;   // 0 = BUY, 1 = SELL
  signatureType: number;
  signature: string;
}

interface PlaceOrderRequest {
  order: PolymarketOrderPayload;
  owner: string;
  orderType: 'GTC' | 'FOK' | 'GTD';
}

export class OrderExecutor {
  private wallet: ethers.Wallet | null = null;
  private address = '';
  private dryRun: boolean;
  private nonceCounter = 0;

  constructor(private privateKey: string, address: string) {
    this.address = address.toLowerCase();
    this.dryRun = !privateKey || privateKey === 'mock' || privateKey.startsWith('mock-');

    if (!this.dryRun) {
      try {
        this.wallet = new ethers.Wallet(privateKey);
        const derivedAddress = this.wallet.address.toLowerCase();
        if (derivedAddress !== this.address) {
          logger.warn('Derived wallet address does not match configured address', {
            derived: derivedAddress,
            configured: this.address,
          });
          this.address = derivedAddress;
        }
        logger.info('Order executor initialized', { address: this.address });
      } catch (e) {
        logger.error('Failed to initialize wallet — running in dry-run mode', { error: e });
        this.dryRun = true;
      }
    } else {
      logger.warn('Order executor running in DRY-RUN mode — no real orders will be placed');
    }
  }

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    if (this.dryRun) {
      return this.simulateFill(req);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.executeOrder(req);
        return result;
      } catch (e) {
        lastError = e as Error;
        logger.warn(`Order attempt ${attempt}/3 failed`, { error: (e as Error).message });
        if (attempt < 3) {
          await sleep(200 * attempt);
        }
      }
    }

    return {
      orderId: '',
      status: 'FAILED',
      errorMessage: lastError?.message ?? 'Unknown error after 3 attempts',
    };
  }

  private async executeOrder(req: OrderRequest): Promise<OrderResponse> {
    if (!this.wallet) throw new Error('Wallet not initialized');

    // Convert USDC amounts to micro-USDC (6 decimals)
    const USDC_DECIMALS = 6;
    const PRICE_DECIMALS = 2; // Polymarket prices have 2 decimal places

    const priceRounded = Math.round(req.price * 100) / 100;
    const sizeUSDC = req.size; // size in USDC

    let makerAmount: bigint;
    let takerAmount: bigint;

    // For BUY: makerAmount = USDC spent, takerAmount = shares received
    // For SELL: makerAmount = shares sold, takerAmount = USDC received
    if (req.side === 'BUY') {
      makerAmount = BigInt(Math.round(sizeUSDC * 10 ** USDC_DECIMALS));
      takerAmount = BigInt(Math.round((sizeUSDC / priceRounded) * 10 ** USDC_DECIMALS));
    } else {
      const sharesAmount = sizeUSDC / priceRounded;
      makerAmount = BigInt(Math.round(sharesAmount * 10 ** USDC_DECIMALS));
      takerAmount = BigInt(Math.round(sizeUSDC * 10 ** USDC_DECIMALS));
    }

    const salt = this.generateSalt();
    const sideNum = req.side === 'BUY' ? 0 : 1;
    const expiration = req.expiration ?? 0;

    const orderData = {
      salt,
      maker: this.address,
      signer: this.address,
      taker: ethers.ZeroAddress,
      tokenId: BigInt(req.tokenId),
      makerAmount,
      takerAmount,
      expiration: BigInt(expiration),
      nonce: BigInt(this.nonceCounter++),
      feeRateBps: BigInt(0),
      side: sideNum,
      signatureType: SIGNATURE_TYPE,
    };

    const signature = await this.wallet.signTypedData(DOMAIN, ORDER_TYPE, orderData);

    const payload: PlaceOrderRequest = {
      order: {
        salt: salt.toString(),
        maker: this.address,
        signer: this.address,
        taker: ethers.ZeroAddress,
        tokenId: req.tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: expiration.toString(),
        nonce: orderData.nonce.toString(),
        feeRateBps: '0',
        side: sideNum,
        signatureType: SIGNATURE_TYPE,
        signature,
      },
      owner: this.address,
      orderType: req.orderType,
    };

    const res = await fetch(`${CLOB_API}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'POLY_ADDRESS': this.address,
        'POLY_SIGNATURE': await this.getL2Auth(),
        'POLY_TIMESTAMP': Date.now().toString(),
        'POLY_NONCE': (this.nonceCounter - 1).toString(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`CLOB API ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      orderID?: string;
      status?: string;
      takingAmount?: string;
      makingAmount?: string;
      error?: string;
    };

    if (data.error) throw new Error(data.error);

    return {
      orderId: data.orderID ?? '',
      status: data.status === 'matched' ? 'MATCHED' : 'LIVE',
      fillPrice: data.takingAmount ? parseFloat(data.takingAmount) / 10 ** USDC_DECIMALS : undefined,
      fillSize: data.makingAmount ? parseFloat(data.makingAmount) / 10 ** USDC_DECIMALS : undefined,
    };
  }

  // L2 auth: sign timestamp to prove ownership
  private async getL2Auth(): Promise<string> {
    if (!this.wallet) return '';
    const ts = Math.floor(Date.now() / 1000).toString();
    const msgHash = ethers.solidityPackedKeccak256(['string'], [ts]);
    return this.wallet.signMessage(ethers.getBytes(msgHash));
  }

  private generateSalt(): bigint {
    // Use timestamp + random for uniqueness
    const ts = BigInt(Date.now());
    const rand = BigInt(Math.floor(Math.random() * 1_000_000));
    return ts * 1_000_000n + rand;
  }

  private simulateFill(req: OrderRequest): OrderResponse {
    // Simulate a fill for dry-run / testing mode
    const fillPrice = req.price;
    const mockOrderId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    logger.info('[DRY-RUN] Simulated order fill', {
      tokenId: req.tokenId.substring(0, 16),
      side: req.side,
      price: fillPrice,
      size: req.size,
      orderId: mockOrderId,
    });

    return {
      orderId: mockOrderId,
      status: 'MATCHED',
      fillPrice,
      fillSize: req.size,
    };
  }

  async getBalance(): Promise<number> {
    if (this.dryRun) return 1000; // mock balance

    try {
      const res = await fetch(`${CLOB_API}/balance-allowance?asset_type=USDC`, {
        headers: {
          'POLY_ADDRESS': this.address,
          'POLY_SIGNATURE': await this.getL2Auth(),
          'POLY_TIMESTAMP': Date.now().toString(),
          'POLY_NONCE': this.nonceCounter.toString(),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return 0;
      const data = await res.json() as { balance?: string };
      return parseFloat(data.balance ?? '0');
    } catch (e) {
      logger.warn('Failed to fetch balance', { error: e });
      return 0;
    }
  }

  isDryRun(): boolean {
    return this.dryRun;
  }

  getAddress(): string {
    return this.address;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
