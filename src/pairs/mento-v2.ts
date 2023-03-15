import { Mento, Exchange } from "@mento-protocol/mento-sdk";
import {
  IBiPoolManager__factory,
  IBiPoolManager,
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

const FIXED1 = new BigNumber("1000000000000000000"); // 10^18

function newFixed(x: BigNumber): BigNumber {
  return x.times(FIXED1);
}

type TGetAmountOut = (
  bucketIn: BigNumber,
  bucketOut: BigNumber,
  spread: BigNumber,
  inputAmount: BigNumber
) => BigNumber;
// type TGetAmountIn = (
//   bucketIn: BigNumber,
//   bucketOut: BigNumber,
//   spread: BigNumber,
//   outputAmount: BigNumber
// ) => BigNumber;

const GET_AMOUNT_OUT: Record<PricingFunctionType, TGetAmountOut> = {
  [PricingFunctionType.ConstantProduct]: (
    bucketA,
    bucketB,
    spread,
    inputAmount
  ) => {
    console.log("Called :)")
    if (inputAmount.isZero()) return new BigNumber(0);

    // look into this again, as I'm not sure
    // const spreadFraction =

    const netAmountIn = FIXED1.minus(spread).multipliedBy(
      newFixed(inputAmount)
    );

    const numerator = netAmountIn.multipliedBy(newFixed(bucketB));
    const denominator = newFixed(bucketA).plus(netAmountIn);
    return numerator.div(denominator);
  },
  [PricingFunctionType.ConstantSum]: (
    bucketA,
    bucketB,
    spread,
    inputAmount
  ) => {
    // Implement constant sum like getAmountOut in ConstantSumPricingModule
    if (inputAmount.isZero()) return new BigNumber(0);

    // const spreadFraction = FIXED1.minus(spread)
    let amountOut = FIXED1.minus(spread)
      .multipliedBy(newFixed(inputAmount))
      .div(FIXED1);
    if (amountOut.isGreaterThan(bucketB))
      throw new Error("amountOut cant be greater than the tokenOutPool size");
    return amountOut;
  },
};

// const GET_AMOUNT_IN: Record<PricingFunctionType, TGetAmountIn> = {
//   [PricingFunctionType.ConstantProduct]: (
//     bucketA,
//     bucketB,
//     spread,
//     outputAmount
//   ) => {
//     // Implement constant product like getAmountIn in ConstantProductPricingModule
//     if (outputAmount.isZero()) return new BigNumber(0);

//     //   const spreadFraction
//     const numerator = newFixed(outputAmount.multipliedBy(bucketA));
//     const denominator = newFixed(bucketB.minus(outputAmount)).multipliedBy(
//       FIXED1.minus(spread)
//     );

//     return numerator.dividedBy(denominator);
//   },
//   [PricingFunctionType.ConstantSum]: (
//     bucketA,
//     bucketB,
//     spread,
//     outputAmount
//   ) => {
//     // Implement constant sum like getAmountIn in ConstantSumPricingModule
//     if (outputAmount > bucketB) {
//       throw new Error(
//         "outputAmount cant be greater then the tokenOutPool size"
//       );
//     }
//     if (outputAmount.isEqualTo(0)) return new BigNumber(0);

//     const denominator = FIXED1.minus(spread);
//     const numerator = newFixed(outputAmount);

//     return numerator.dividedBy(denominator);
//   },
// };

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
  }

  // this needs to be worked on 
  private mentoBucketsAfterUpdate = async () => {
    this.poolExchange = await this.getPoolExchange()
    const [bucket0, bucket1] = [new BigNumber(this.poolExchange!.bucket0._hex), new BigNumber(this.poolExchange!.bucket1._hex)]
    return {bucket0, bucket1}
  } 

  protected swapExtraData(): string {
    const broker = this.mento.getBroker();
    return `${broker.address}${this.exchange.providerAddr}${this.exchange.id}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber) {
    // Determine if it's constant sum or constant product by looking at the pricingModule in the PoolExchange struct
    // and use a hardcoded list of addresses.
    // 0x7586680Dd2e4F977C33cDbd597fa2490e342CbA2 constant product on baklava
    // 0x1D74cFaa39049698DbA4550ca487b8FAf09f3c81 constant sum on baklava
    const pricingModulesBaklava: string[] = [
      "0x7586680Dd2e4F977C33cDbd597fa2490e342CbA2",
      "0x1D74cFaa39049698DbA4550ca487b8FAf09f3c81",
    ];
    const pricingModulesMainnet: string[] = [
      "0x0c07126d0CB30E66eF7553Cc7C37143B4f06DddB",
      "0x366DB2cd12f6bbF4333C407A462aD25e3c383F34",
    ];
    // this.poolExchange = await this.getPoolExchange();
    // console.log(this.poolExchange);
      
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

    console.log("pricingFunctionType", pricingFunctionType)

    const getAmountOut = GET_AMOUNT_OUT[pricingFunctionType];

    // cUSD/CELO pool
    // asset0 == address(cUSD) bucket0 = 10000
    // asset1 == address(CELO) bucket1 = 5000

    // outputAmount(cUSD, 20) -> getAmountOut(bucket0, bucket1, spread, 20)

    // outputAmount(CELO, 20) -> getAmountOut(bucket1, bucket0, spread, 20)
    const spread = new BigNumber(this.poolExchange.config.spread.value._hex);
    console.log("spread", spread)
    let bucketOut;
    let bucketIn;

    // if inputToken == poolExchange.asset0 => bucketIn = bucket0, bucketOut = bucket1
    // else bucketIn = bucket1, bucketOut = bucket0
    if (inputToken == this.poolExchange.asset0) {
      bucketIn = this.poolExchange.bucket0;
      bucketOut = this.poolExchange.bucket1;
      console.log("inputToken is asset0")
    } else {
      console.log("inputToken is asset1")
      console.log(this.poolExchange.asset1)
      console.log(this.poolExchange.asset0)
      bucketIn = this.poolExchange.bucket1;
      bucketOut = this.poolExchange.bucket0;
    }
    
    const amountOut = getAmountOut(
      new BigNumber(bucketIn._hex),
      new BigNumber(bucketOut._hex),
      spread,
      inputAmount
    ).integerValue(BigNumber.ROUND_DOWN);
    console.log(amountOut)
    return amountOut
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
