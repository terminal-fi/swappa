import { Mento, Exchange } from "@mento-protocol/mento-sdk";
import {
  IPricingModule__factory,
  IBiPoolManager__factory,
  IBiPoolManager,
  ISortedOracles__factory,
} from "@mento-protocol/mento-core-ts";
import { BigNumber } from "bignumber.js";
import { ethers, providers } from "ethers";
import Web3 from "web3"

import { IBiPoolManager as IBiPoolManagerW3, ABI as IBiPoolManagerABI } from "../../types/web3-v1-contracts/IBiPoolManager"
import { Address, Pair, Snapshot, BigNumberString } from "../pair";
import { selectAddress } from "../utils";
import { address as mainnetPairMentoV2Address } from "../../tools/deployed/mainnet.PairMentoV2.addr.json";

enum PricingFunctionType {
  ConstantProduct = "ConstantProduct",
  ConstantSum = "ConstantSum",
}

const FIXED1 = new BigNumber(1000000000000000000000000); // 10^24
interface PairMentoV2Snapshot extends Snapshot {
  spread: BigNumberString;
  updateFrequency: BigNumberString;
  pricingModule: PricingFunctionType;
  bucket0: BigNumberString;
  bucket1: BigNumberString;
  tokenPrecisionMultipliers: BigNumberString[],
}

export class PairMentoV2 extends Pair {
  private poolExchange!: IBiPoolManager.PoolExchangeStructOutput;
  private spread: BigNumber = new BigNumber(0);
  private updateFrequency: BigNumber = new BigNumber(0);
  private pricingModule!: PricingFunctionType;
  private bucket0: BigNumber = new BigNumber(0);
  private bucket1: BigNumber = new BigNumber(0);
  private tokenPrecisionMultipliers: BigNumber[] = []

  private provider: ethers.providers.Provider;
  private biPoolManager: IBiPoolManager

  constructor(
    chainId: number,
    private web3: Web3,
    private mento: Mento,
    private exchange: Exchange,
    private sortedOraclesAddress: string
  ) {
    super(web3, selectAddress(chainId, {mainnet: mainnetPairMentoV2Address }))
    this.provider = new providers.Web3Provider(web3.currentProvider as any);
    this.biPoolManager = IBiPoolManager__factory.connect(this.exchange.providerAddr, this.provider);
  }

  protected async _init(): Promise<{
    pairKey: string | null;
    tokenA: string;
    tokenB: string;
  }> {
    this.poolExchange = await this.biPoolManager.getPoolExchange(this.exchange.id);
    const managerW3 = new this.web3.eth.Contract(IBiPoolManagerABI, this.exchange.providerAddr) as unknown as IBiPoolManagerW3
    this.tokenPrecisionMultipliers = await Promise.all(
      this.exchange.assets.map((asset) => managerW3.methods.tokenPrecisionMultipliers(asset).call().then((v) => new BigNumber(v))))
    this.pricingModule = await this.getPricingModuleName(this.poolExchange.pricingModule);
    return {
      pairKey: this.exchange.id,
      tokenA: this.exchange.assets[0],
      tokenB: this.exchange.assets[1],
    };
  }

  public async refresh() {
    this.poolExchange = await this.biPoolManager.getPoolExchange(this.exchange.id);
    this.spread = new BigNumber(this.poolExchange.config.spread.value._hex);
    this.updateFrequency = new BigNumber(this.poolExchange.config.referenceRateResetFrequency._hex);
    const lastBucketUpdate = new BigNumber(this.poolExchange.lastBucketUpdate._hex);
    const tillUpdateSecs = lastBucketUpdate
      .plus(this.updateFrequency)
      .minus(Date.now() / 1000);
    let buckets: { bucket0: BigNumber; bucket1: BigNumber };
    if (tillUpdateSecs.lte(5)) {
      buckets = await this.mentoBucketsAfterUpdate();
    } else {
      const [bucket0, bucket1] = [
        new BigNumber(this.poolExchange.bucket0._hex),
        new BigNumber(this.poolExchange.bucket1._hex),
      ];
      buckets = { bucket0, bucket1 };
    }
    this.bucket0 = buckets.bucket0
    this.bucket1 = buckets.bucket1
  }

  public swapExtraData(): string {
    const broker = this.mento.getBroker();
    return `${broker.address}${this.exchange.providerAddr.substring(2)}${this.exchange.id.substring(2)}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber) {
    const getAmountOut = GET_AMOUNT_OUT[this.pricingModule];
    const [tokenInBucketSize, tokenOutBucketSize] =
      (inputToken === this.tokenA) ? [this.bucket0, this.bucket1] : [this.bucket1, this.bucket0];

    const [inputMultiplier, outputMultiplier] =
      (inputToken === this.tokenA) ?
      [this.tokenPrecisionMultipliers[0], this.tokenPrecisionMultipliers[1]] :
      [this.tokenPrecisionMultipliers[1], this.tokenPrecisionMultipliers[0]]
    const scaledInputAmount = inputAmount.multipliedBy(inputMultiplier)
    const amountOut = getAmountOut(
      tokenInBucketSize,
      tokenOutBucketSize,
      this.spread,
      scaledInputAmount,
    );
    return amountOut.idiv(outputMultiplier);
  }

  public snapshot(): PairMentoV2Snapshot {
    return {
      spread: this.spread.toFixed(),
      updateFrequency: this.updateFrequency.toFixed(),
      pricingModule: this.pricingModule,
      bucket0: this.bucket0.toFixed(),
      bucket1: this.bucket1.toFixed(),
      tokenPrecisionMultipliers: this.tokenPrecisionMultipliers.map((v) => v.toFixed()),
    };
  }

  public async restore(snapshot: PairMentoV2Snapshot): Promise<void> {
    this.spread = new BigNumber(snapshot.spread);
    this.updateFrequency = new BigNumber(snapshot.updateFrequency);
    this.pricingModule = snapshot.pricingModule;
    this.bucket0 = new BigNumber(snapshot.bucket0);
    this.bucket1 = new BigNumber(snapshot.bucket1);
    this.tokenPrecisionMultipliers = snapshot.tokenPrecisionMultipliers.map((v) => new BigNumber(v))
  }

  private mentoBucketsAfterUpdate = async () => {
    /*
    ## From BiPoolManager.sol:
    function getUpdatedBuckets(PoolExchange memory exchange) internal view returns (uint256 bucket0, uint256 bucket1) {
      bucket0 = exchange.config.stablePoolResetSize;
      uint256 exchangeRateNumerator;
      uint256 exchangeRateDenominator;
      (exchangeRateNumerator, exchangeRateDenominator) = getOracleExchangeRate(exchange.config.referenceRateFeedID);

      bucket1 = exchangeRateDenominator.mul(bucket0).div(exchangeRateNumerator);
    }
    */
    let bucket0 = new BigNumber(
      this.poolExchange.config.stablePoolResetSize._hex
    );
    const [exchangeRateNumerator, exchangeRateDenominator] =
      await this.getOracleExchangeRate(
        this.poolExchange.config.referenceRateFeedID
      );
    let bucket1 = exchangeRateDenominator
      .multipliedBy(new BigNumber(bucket0))
      .idiv(exchangeRateNumerator);
    return { bucket0, bucket1 };
  };

  protected getOracleExchangeRate = async (
    rateFeedID: Address
  ): Promise<[BigNumber, BigNumber]> => {
    const sortedOracles = ISortedOracles__factory.connect(
      this.sortedOraclesAddress,
      this.provider
    );
    const [rateNumerator, rateDenominator] = await sortedOracles.medianRate(
      rateFeedID
    );
    if (rateDenominator.lte(0)){
      throw new Error("exchange rate denominator must be greater than 0");
    }
    return [
      new BigNumber(rateNumerator._hex),
      new BigNumber(rateDenominator._hex),
    ];
  };

  private async getPricingModuleName(
    address: Address
  ): Promise<PricingFunctionType> {
    const pricingModule = IPricingModule__factory.connect(
      address,
      this.provider
    );
    const name = await pricingModule.name();
    if(!(name in PricingFunctionType)) {
      throw "Pricing type not supported";
    }
    return PricingFunctionType[name as keyof typeof PricingFunctionType];
  }
}

type TGetAmountOut = (
  tokenInBucketSize: BigNumber,
  tokenOutBucketSize: BigNumber,
  spread: BigNumber,
  inputAmount: BigNumber
) => BigNumber;

PricingFunctionType;
const GET_AMOUNT_OUT: Record<PricingFunctionType, TGetAmountOut> = {
  [PricingFunctionType.ConstantProduct]: (
    tokenInBucketSize,
    tokenOutBucketSize,
    spread,
    inputAmount
  ) => {
    // https://github.com/mento-protocol/mento-core/blob/9879bdb4d5e22da2eacb0c3629fd8a032d2d7f9a/contracts/swap/ConstantProductPricingModule.sol#L28
    if (inputAmount.isZero()) {
      return new BigNumber(0);
    }
    const netAmountIn = FIXED1.minus(spread).multipliedBy(inputAmount)
    const numerator = netAmountIn.multipliedBy(tokenOutBucketSize)
    const denominator = tokenInBucketSize.multipliedBy(FIXED1).plus(netAmountIn)
    const outputAmount = numerator.idiv(denominator);
    return outputAmount
  },
  [PricingFunctionType.ConstantSum]: (
    tokenInBucketSize,
    tokenOutBucketSize,
    spread,
    inputAmount
  ) => {
    // https://github.com/mento-protocol/mento-core/blob/c843b386ae12a6987022842e6b52cc23340555f2/contracts/ConstantSumPricingModule.sol#L36C5-L36C5
    if (inputAmount.isZero()){
      return new BigNumber(0);
    }
    const spreadFraction = FIXED1.minus(spread)
    const outputAmount = spreadFraction.multipliedBy(inputAmount).idiv(FIXED1)
    if (outputAmount.gt(tokenOutBucketSize)) {
      return new BigNumber(0)
    }
    return outputAmount
  },
};
