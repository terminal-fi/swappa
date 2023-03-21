import { Mento, Exchange } from "@mento-protocol/mento-sdk";
import {
  IPricingModule__factory,
  IBiPoolManager__factory,
  IBiPoolManager,
  ISortedOracles__factory,
} from "@mento-protocol/mento-core-ts";
import { BigNumber } from "bignumber.js";
import { ethers } from "ethers";

import { Address, Pair, Snapshot, BigNumberString } from "../pair";
import { selectAddress } from "../utils";
// these are just placeholder addresses I've added, pairmentov2 has not been deployed yet
import { address as mainnetPairMentoV2Address } from "../../tools/deployed/mainnet.PairMentoV2.addr.json";
import { address as baklavaPairMentoV2Address } from "../../tools/deployed/baklava.PairMentoV2.addr.json";

enum PricingFunctionType {
  ConstantProduct = "ConstantProduct",
  ConstantSum = "ConstantSum",
}

const FIXED1 = new BigNumber(1000000000000000000000000); // 10^24
interface PairMentoV2Snapshot extends Snapshot {
  swapFee: BigNumberString;
  pricingModule: PricingFunctionType;
  bucket0: BigNumberString;
  bucket1: BigNumberString;
}

export class PairMentoV2 extends Pair {
  public poolExchange!: IBiPoolManager.PoolExchangeStructOutput;
  private swapFee: BigNumber = new BigNumber(0);
  private pricingModule!: PricingFunctionType;
  private bucket0: BigNumber = new BigNumber(0);
  private bucket1: BigNumber = new BigNumber(0);

  constructor(
    chainId: number,
    private provider: ethers.providers.Provider,
    private mento: Mento,
    private exchange: Exchange,
    private sortedOraclesAddress: string
  ) {
    super(
      selectAddress(chainId, {
        baklava: baklavaPairMentoV2Address,
        mainnet: mainnetPairMentoV2Address,
      })
    );
  }

  protected async _init(): Promise<{
    pairKey: string | null;
    tokenA: string;
    tokenB: string;
  }> {
    this.poolExchange = await this.getPoolExchange();
    return {
      pairKey: this.exchange.id,
      tokenA: this.exchange.assets[0],
      tokenB: this.exchange.assets[1],
    };
  }

  public async refresh() {
    const [lastBucketUpdate, updateFrequency, spread] = [
      new BigNumber(this.poolExchange.lastBucketUpdate._hex),
      new BigNumber(this.poolExchange.config.referenceRateResetFrequency._hex),
      new BigNumber(this.poolExchange.config.spread.value._hex),
    ];
    this.swapFee = spread.div(FIXED1);
    this.pricingModule = await this.getPricingModuleName(
      this.poolExchange.pricingModule
    );
    const tillUpdateSecs = lastBucketUpdate
      .plus(updateFrequency)
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
    this.bucket0 = buckets.bucket0.decimalPlaces(0, 1);
    this.bucket1 = buckets.bucket1.decimalPlaces(0, 1);
  }

  public swapExtraData(): string {
    const broker = this.mento.getBroker();
    return `${broker.address}${this.exchange.providerAddr.replace(
      "0x",
      ""
    )}${this.exchange.id.replace("0x", "")}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber) {
    const spread = new BigNumber(this.poolExchange.config.spread.value._hex);
    const getAmountOut = GET_AMOUNT_OUT[this.pricingModule];
    const [tokenInBucketSize, tokenOutBucketSize] =
      this.matchBuckets(inputToken);

    const amountOut = getAmountOut(
      tokenInBucketSize,
      tokenOutBucketSize,
      spread,
      inputAmount
    );
    return amountOut;
  }

  public snapshot(): PairMentoV2Snapshot {
    return {
      swapFee: this.swapFee.toFixed(),
      pricingModule: this.pricingModule,
      bucket0: this.bucket0.toPrecision(),
      bucket1: this.bucket1.toPrecision(),
    };
  }

  public async restore(snapshot: PairMentoV2Snapshot): Promise<void> {
    this.swapFee = new BigNumber(snapshot.swapFee);
    this.pricingModule = snapshot.pricingModule;
    this.bucket0 = new BigNumber(snapshot.bucket0);
    this.bucket1 = new BigNumber(snapshot.bucket1);
  }

  private async getPoolExchange() {
    // For this version we will expect that the provider is a BiPoolManager
    const biPoolManager = IBiPoolManager__factory.connect(
      this.exchange.providerAddr,
      this.provider
    );
    return await biPoolManager.getPoolExchange(this.exchange.id);
  }

  private mentoBucketsAfterUpdate = async () => {
    /*
    Just like in mento.ts but use the PoolExchange in order to read:
    lastBucketUpdate, updateFrequency and spread
    also the bucket0 and bucket1.
    Refreshed the PoolExchange structure first.
    In the mentoBucketsAfter updated the referenced logic changes to:

    function getUpdatedBuckets(PoolExchange memory exchange) internal view returns (uint256 bucket0, uint256 bucket1) {
      bucket0 = exchange.config.stablePoolResetSize;
      uint256 exchangeRateNumerator;
      uint256 exchangeRateDenominator;
      (exchangeRateNumerator, exchangeRateDenominator) = getOracleExchangeRate(exchange.config.referenceRateFeedID);
  
      bucket1 = exchangeRateDenominator.mul(bucket0).div(exchangeRateNumerator);
    }
    */
    const bucket0 = new BigNumber(
      this.poolExchange.config.stablePoolResetSize._hex
    );
    const [exchangeRateNumerator, exchangeRateDenominator] =
      await this.getOracleExchangeRate(
        this.poolExchange.config.referenceRateFeedID
      );
    const bucket1 = exchangeRateDenominator
      .multipliedBy(new BigNumber(bucket0))
      .dividedBy(exchangeRateNumerator);
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
    if (rateDenominator.lte(0))
      throw new Error("exchange rate denominator must be greater than 0");
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
    if (name in PricingFunctionType) {
      return name as unknown as PricingFunctionType;
    } else {
      throw "Pricing type not supported";
    }
  }

  private matchBuckets(inputToken: Address): any {
    if (inputToken == this.poolExchange.asset0) {
      return [this.bucket0, this.bucket1];
    } else {
      return [this.bucket1, this.bucket0];
    }
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
    if (inputAmount.isZero()) return new BigNumber(0);
    spread = new BigNumber(new BigNumber(FIXED1).minus(spread)).div(FIXED1);
    const numerator = tokenOutBucketSize
      .multipliedBy(spread)
      .multipliedBy(inputAmount);
    const denominator = tokenInBucketSize.plus(
      inputAmount.multipliedBy(spread)
    );
    const outputAmount = numerator.div(denominator);
    if (tokenOutBucketSize.lt(outputAmount))
      throw new Error("Output amount can't be greater than bucket out");
    return outputAmount.decimalPlaces(0, 1);
  },
  [PricingFunctionType.ConstantSum]: (
    tokenInBucketSize,
    tokenOutBucketSize,
    spread,
    inputAmount
  ) => {
    if (inputAmount.isZero()) return new BigNumber(0);
    spread = new BigNumber(FIXED1).minus(spread);
    const outputAmount = spread
      .multipliedBy(inputAmount)
      .div(new BigNumber(FIXED1));
    if (tokenOutBucketSize.lt(outputAmount))
      throw new Error("Output amount can't be greater than bucket out");
    return outputAmount.decimalPlaces(0, 1);
  },
};

/*
TODO:
- add bridged USDC 

*/
