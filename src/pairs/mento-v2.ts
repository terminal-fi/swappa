import { Mento, Exchange } from "@mento-protocol/mento-sdk";
import {
  IBiPoolManager__factory,
  IBiPoolManager,
  ISortedOracles__factory,
  ISortedOracles
} from "@mento-protocol/mento-core-ts";
import { BigNumber } from "bignumber.js";
import { FixedNumber } from "@ethersproject/bignumber";
import { ethers } from "ethers";

import { Address, Pair, Snapshot, BigNumberString } from "../pair";
import { selectAddress } from "../utils";
// these are just placeholder addresses I've added, pairmentov2 has not been deployed yet
import { address as mainnetPairMentoV2Address } from "../../tools/deployed/mainnet.PairMentoV2.addr.json";
import { address as baklavaPairMentoV2Address } from "../../tools/deployed/baklava.PairMentoV2.addr.json";

enum PricingFunctionType {
  ConstantProduct,
  ConstantSum,
}

const FIXED1 = new BigNumber(1000000000000000000000000); // 10^24

type TGetAmountOut = (
  bucketIn: BigNumber,
  bucketOut: BigNumber,
  spread: BigNumber,
  inputAmount: BigNumber
) => BigNumber;

const GET_AMOUNT_OUT: Record<PricingFunctionType, TGetAmountOut> = {
  [PricingFunctionType.ConstantProduct]: (
    bucketA,
    bucketB,
    spread,
    inputAmount
  ) => {
  if (inputAmount.isZero()) return new BigNumber(0);
    spread = new BigNumber(FIXED1).minus(spread)
    const numerator = bucketB.multipliedBy(spread).multipliedBy(inputAmount)
    const denominator = bucketA.plus(inputAmount).multipliedBy(spread)
    const outputAmount = numerator.div(denominator);
    if(bucketB.lt(outputAmount)) throw new Error("Output amount can't be greater than bucket out") 
    return outputAmount
  },
  [PricingFunctionType.ConstantSum]: (
    bucketA,
    bucketB,
    spread,
    inputAmount
  ) => {
    if (inputAmount.isZero()) return new BigNumber(0);
    spread = new BigNumber(FIXED1).minus(spread)
    const outputAmount = spread.multipliedBy(inputAmount).div(new BigNumber(FIXED1));
    if (bucketB.lt(outputAmount)) throw new Error("Output amount can't be greater than bucket out") 
    return outputAmount
  },
};
interface PairMentoV2Snapshot extends Snapshot {
  pricingFunction: PricingFunctionType | null;
  bucketA: BigNumberString;
  bucketB: BigNumberString;
}

export class PairMentoV2 extends Pair {
  public poolExchange!: IBiPoolManager.PoolExchangeStructOutput;
  private swapFee: BigNumberString = "";
  private pricingFunction: PricingFunctionType | null = null;
  private bucketA: BigNumberString = "";
  private bucketB: BigNumberString = "";

  constructor(
    chainId: number,
    private provider: ethers.providers.Provider,
    private mento: Mento,
    private exchange: Exchange
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
    // Query for the PoolExchange structure and save it on the class.
    this.poolExchange = await this.getPoolExchange();
    return {
      pairKey: this.exchange.id,
      tokenA: this.exchange.assets[0],
      tokenB: this.exchange.assets[1],
    };
  }

  public async refresh() {
    // temporary placeholder till _init gets called 
    this.poolExchange = await this.getPoolExchange();
    // lastBucketUpdate, referenceRateResetFrequency spread
    const [lastBucketUpdate, updateFrequency, spread] = [
      this.poolExchange.lastBucketUpdate._hex,
      this.poolExchange.config.referenceRateResetFrequency._hex,
      this.poolExchange.config.spread.value._hex,
    ];
    const tillUpdateSecs = new BigNumber(lastBucketUpdate).plus(new BigNumber(updateFrequency)).minus(Date.now() / 1000)
    let buckets: {bucket0: BigNumber, bucket1: BigNumber}
    if(tillUpdateSecs.gt(0) && tillUpdateSecs.lte(5)) {
      buckets = await this.mentoBucketsAfterUpdate()
    } else {
      const [bucket0, bucket1] = [new BigNumber(this.poolExchange!.bucket0._hex), new BigNumber(this.poolExchange!.bucket1._hex)]
      buckets = {bucket0, bucket1}
    }
    
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
    const bucket0 = new BigNumber(this.poolExchange.config.stablePoolResetSize._hex)
    const [exchangeRateNumerator, exchangeRateDenominator] = await this.getOracleExchangeRate(this.poolExchange.config.referenceRateFeedID)
    const bucket1 = exchangeRateDenominator.multipliedBy(new BigNumber(bucket0)).dividedBy(exchangeRateNumerator)
    return {bucket0, bucket1}
  } 

  protected getOracleExchangeRate = async (rateFeedID: Address): Promise<[BigNumber, BigNumber]> => {
    const sortedOracles = ISortedOracles__factory.connect(
      this.exchange.providerAddr,
      this.provider
    );
    const [rateNumerator, rateDenominator] = await sortedOracles.medianRate(rateFeedID)
    if (rateDenominator.lt(0)) throw new Error("exchange rate denominator must be greater than 0")
    return [new BigNumber(rateNumerator._hex), new BigNumber(rateDenominator._hex)]
  }

  public swapExtraData(): string {
    const broker = this.mento.getBroker();
    return `${broker.address}${this.exchange.providerAddr}${this.exchange.id}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber) {
    const pricingModulesBaklava: string[] = [
      "0x7586680Dd2e4F977C33cDbd597fa2490e342CbA2",
      "0x1D74cFaa39049698DbA4550ca487b8FAf09f3c81",
    ];
    // const pricingModulesMainnet: string[] = [
    //   "0x0c07126d0CB30E66eF7553Cc7C37143B4f06DddB",
    //   "0x366DB2cd12f6bbF4333C407A462aD25e3c383F34",
    // ];
      
    let pricingFunctionType: PricingFunctionType;
    if (this.poolExchange.pricingModule == pricingModulesBaklava[0]) {
      pricingFunctionType = PricingFunctionType.ConstantProduct;
      this.pricingFunction = pricingFunctionType
    } else if(this.poolExchange.pricingModule == pricingModulesBaklava[1]) {
      pricingFunctionType = PricingFunctionType.ConstantSum;
      this.pricingFunction = pricingFunctionType
    } 
    else {
      throw new Error("Pricing module doesn't exist")
    }

    const getAmountOut = GET_AMOUNT_OUT[pricingFunctionType];

    const spread = new BigNumber(this.poolExchange.config.spread.value._hex);
    let bucketOut;
    let bucketIn;

    // if inputToken == poolExchange.asset0 => bucketIn = bucket0, bucketOut = bucket1
    // else bucketIn = bucket1, bucketOut = bucket0
    if (inputToken == this.poolExchange.asset0) {
      bucketIn = this.poolExchange.bucket0;
      bucketOut = this.poolExchange.bucket1;
    } else {
      bucketIn = this.poolExchange.bucket1;
      bucketOut = this.poolExchange.bucket0;
    }
  
    return getAmountOut(
      new BigNumber(bucketIn._hex),
      new BigNumber(bucketOut._hex),
      spread,
      inputAmount
    )
  }

  // PairMentoV2Snapshot return type
  public snapshot(): PairMentoV2Snapshot {
    return {
      pricingFunction: this.pricingFunction,
      bucketA: this.bucketA,
      bucketB: this.bucketB,
    };
  }

  public async restore(snapshot: PairMentoV2Snapshot): Promise<void> {
    this.pricingFunction = snapshot.pricingFunction;
    this.bucketA = snapshot.bucketA;
    this.bucketB = snapshot.bucketB;
  }

  private async getPoolExchange() {
    // For this version we will expect that the provider is a BiPoolManager
    const biPoolManager = IBiPoolManager__factory.connect(
      this.exchange.providerAddr,
      this.provider
    );
    return await biPoolManager.getPoolExchange(this.exchange.id);
  }
}
