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

import { newIBiPoolManager } from "../../types/web3-v1-contracts/IBiPoolManager"
import { Address, Pair, Snapshot, BigNumberString } from "../pair";
import { selectAddress } from "../utils";
import { address as mainnetPairMentoV2Address } from "../../tools/deployed/mainnet.PairMentoV2.addr.json";
import { ERC20, newERC20 } from "../../types/web3-v1-contracts/ERC20";
import { IReserve, newIReserve } from "../../types/web3-v1-contracts/IReserve";

enum PricingFunctionType {
  ConstantProduct = "ConstantProduct",
  ConstantSum = "ConstantSum",
}

const FIXED1 = new BigNumber(1000000000000000000000000); // 10^24
interface PairMentoV2Snapshot extends Snapshot {
  spread: BigNumberString;
  updateFrequency: BigNumberString;
  pricingModule: PricingFunctionType;
  tokenPrecisionMultipliers: [BigNumberString, BigNumberString],
  decimals: [number, number],
  isCollateralA: boolean,
  isCollateralB: boolean,

  bucket0: BigNumberString;
  bucket1: BigNumberString;
  tokenMaxIn: [BigNumberString, BigNumberString],
  tokenMaxOut: [BigNumberString, BigNumberString],
  tradingEnabled: boolean,
  reserveBalanceA: string,
  reserveBalanceB: string,
  errAtoB: boolean,
  errBtoA: boolean,
}

export class PairMentoV2 extends Pair {
  private poolExchange!: IBiPoolManager.PoolExchangeStructOutput;

  private spread: BigNumber = new BigNumber(0);
  private updateFrequency: BigNumber = new BigNumber(0);
  private pricingModule!: PricingFunctionType;
  private tokenPrecisionMultipliers: [BigNumber, BigNumber] = [new BigNumber(0), new BigNumber(0)]
  private decimals: [number, number] = [0, 0]
  private isCollateralA: boolean = false
  private isCollateralB: boolean = false

  private bucket0: BigNumber = new BigNumber(0);
  private bucket1: BigNumber = new BigNumber(0);
  private tokenMaxIn = [new BigNumber(0), new BigNumber(0)]
  private tokenMaxOut = [new BigNumber(0), new BigNumber(0)]
  private tradingEnabled: boolean = false
  private reserveBalanceA: string = ""
  private reserveBalanceB: string = ""
  private errAtoB: boolean = false
  private errBtoA: boolean = false

  private provider: providers.Provider;
  private biPoolManager: IBiPoolManager
  private reserve: IReserve
  private erc20A: ERC20
  private erc20B: ERC20

  constructor(
    chainId: number,
    private web3: Web3,
    private mento: Mento,
    private exchange: Exchange,
    private sortedOraclesAddress: string,
    reserveAddress: string,
  ) {
    super(web3, selectAddress(chainId, {mainnet: mainnetPairMentoV2Address }))
    this.provider = new ethers.providers.Web3Provider(web3.currentProvider as any);
    this.biPoolManager = IBiPoolManager__factory.connect(this.exchange.providerAddr, this.provider);
    this.reserve = newIReserve(this.web3 as any, reserveAddress)
    this.erc20A = newERC20(this.web3, this.exchange.assets[0])
    this.erc20B = newERC20(this.web3, this.exchange.assets[1])
  }

  protected async _init(): Promise<{
    pairKey: string | null;
    tokenA: string;
    tokenB: string;
  }> {
    this.poolExchange = await this.biPoolManager.getPoolExchange(this.exchange.id);
    const managerW3 = newIBiPoolManager(this.web3, this.exchange.providerAddr)
    this.tokenPrecisionMultipliers = await Promise.all([
      managerW3.methods.tokenPrecisionMultipliers(this.exchange.assets[0]).call().then((v) => new BigNumber(v)),
      managerW3.methods.tokenPrecisionMultipliers(this.exchange.assets[1]).call().then((v) => new BigNumber(v)),
    ])
    const [
      decimalsA,
      decimalsB,
      isCollateralA,
      isCollateralB,
    ] = await Promise.all([
      this.erc20A.methods.decimals().call(),
      this.erc20B.methods.decimals().call(),
      this.reserve.methods.isCollateralAsset(this.exchange.assets[0]).call(),
      this.reserve.methods.isCollateralAsset(this.exchange.assets[1]).call(),
    ])
    this.isCollateralA = isCollateralA
    this.isCollateralB = isCollateralB
    this.decimals = [Number.parseInt(decimalsA), Number.parseInt(decimalsB)]
    this.pricingModule = await this.getPricingModuleName(this.poolExchange.pricingModule);
    return {
      pairKey: this.exchange.id,
      tokenA: this.exchange.assets[0],
      tokenB: this.exchange.assets[1],
    };
  }

  public async refresh() {
    const [
      poolExchange,
      tradingLimits,
      tradingEnabled,
      reserveBalanceA,
      reserveBalanceB,
      checkAtoB,
      checkBtoA,
    ] = await Promise.all([
      this.biPoolManager.getPoolExchange(this.exchange.id),
      this.mento.getTradingLimits(this.exchange.id),
      this.mento.isTradingEnabled(this.exchange.id),
      this.erc20A.methods.balanceOf(this.reserve.options.address).call(),
      this.erc20B.methods.balanceOf(this.reserve.options.address).call(),
      this.outputAmountAsync(this.tokenA, new BigNumber(1)).catch(() => { return new BigNumber(-1) }),
      this.outputAmountAsync(this.tokenB, new BigNumber(1)).catch(() => { return new BigNumber(-1) }),
    ])
    // MentoV2 can have some unexpected errors, thus we first perform a check
    // for a very small amount to make sure any kind of trading is possible in the
    // first place.
    // Example Err: https://github.com/mento-protocol/mento-core/blob/d174c8a9810514e0ea0ddd67463854a2bfe80b32/contracts/swap/BiPoolManager.sol#L514
    this.errAtoB = checkAtoB.eq(-1)
    this.errBtoA = checkBtoA.eq(-1)

    this.poolExchange = poolExchange
    this.spread = new BigNumber(this.poolExchange.config.spread.value._hex);
    this.updateFrequency = new BigNumber(this.poolExchange.config.referenceRateResetFrequency._hex);
    const lastBucketUpdate = new BigNumber(this.poolExchange.lastBucketUpdate._hex);
    const tillUpdateSecs = lastBucketUpdate
      .plus(this.updateFrequency)
      .minus(Date.now() / 1000);
    if (tillUpdateSecs.lte(5)) {
      const buckets = await this.mentoBucketsAfterUpdate();
      this.bucket0 = buckets.bucket0
      this.bucket1 = buckets.bucket1
    } else {
      ;[this.bucket0, this.bucket1] = [
        new BigNumber(this.poolExchange.bucket0._hex),
        new BigNumber(this.poolExchange.bucket1._hex),
      ];
    }

    const maxU256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    this.tokenMaxIn = [new BigNumber(maxU256), new BigNumber(maxU256)]
    this.tokenMaxOut = [new BigNumber(maxU256), new BigNumber(maxU256)]
    tradingLimits.forEach((l) => {
      const idx = l.asset === this.tokenA ? 0 : 1
      const maxIn = new BigNumber(l.maxIn).shiftedBy(this.decimals[idx])
      const maxOut = new BigNumber(l.maxOut).shiftedBy(this.decimals[idx])
      if (this.tokenMaxIn[idx].gt(maxIn)) {
        this.tokenMaxIn[idx] = maxIn
      }
      if (this.tokenMaxOut[idx].gt(maxOut)) {
        this.tokenMaxOut[idx] = maxOut
      }
    })
    this.tradingEnabled = tradingEnabled
    this.reserveBalanceA = reserveBalanceA
    this.reserveBalanceB = reserveBalanceB
  }

  public swapExtraData(): string {
    return `${this.mento.getBroker().address}${this.exchange.providerAddr.substring(2)}${this.exchange.id.substring(2)}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber) {
    const [tokenMaxIn, tokenMaxOut] =
      (inputToken === this.tokenA) ? [this.tokenMaxIn[0], this.tokenMaxOut[1]] : [this.tokenMaxIn[1], this.tokenMaxOut[0]]
    const errTrade = (inputToken === this.tokenA) ? this.errAtoB : this.errBtoA
    if (!this.tradingEnabled || inputAmount.gt(tokenMaxIn) || this.bucket0.eq(0) || errTrade) {
      return new BigNumber(0)
    }
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
    const outputAmount = amountOut.idiv(outputMultiplier);
    if (outputAmount.gt(tokenMaxOut)) {
      return new BigNumber(0)
    }
    const [isOutputCollateral, reserveBalance] =
      inputToken === this.tokenA ? [this.isCollateralB, this.reserveBalanceB] : [this.isCollateralA, this.reserveBalanceA]
    if (isOutputCollateral && outputAmount.gte(reserveBalance)) {
      return new BigNumber(0)
    }
    return outputAmount
  }

  public inputAmount(outputToken: Address, outputAmount: BigNumber) {
    const [tokenMaxIn, tokenMaxOut] =
      (outputToken === this.tokenB) ? [this.tokenMaxIn[0], this.tokenMaxOut[1]] : [this.tokenMaxIn[1], this.tokenMaxOut[0]]
    const errTrade = (outputToken === this.tokenB) ? this.errAtoB : this.errBtoA
    if (!this.tradingEnabled || outputAmount.gt(tokenMaxOut) || this.bucket0.eq(0) || errTrade) {
      return new BigNumber(0)
    }
    const [isOutputCollateral, reserveBalance] =
      outputToken === this.tokenB ? [this.isCollateralB, this.reserveBalanceB] : [this.isCollateralA, this.reserveBalanceA]
    if (isOutputCollateral && outputAmount.gte(reserveBalance)) {
      return new BigNumber(0)
    }
    const getAmountIn = GET_AMOUNT_IN[this.pricingModule];
    const [tokenInBucketSize, tokenOutBucketSize] =
      (outputToken === this.tokenB) ? [this.bucket0, this.bucket1] : [this.bucket1, this.bucket0];
    const [inputMultiplier, outputMultiplier] =
      (outputToken === this.tokenB) ?
      [this.tokenPrecisionMultipliers[0], this.tokenPrecisionMultipliers[1]] :
      [this.tokenPrecisionMultipliers[1], this.tokenPrecisionMultipliers[0]]
    const scaledOutputAmount = outputAmount.multipliedBy(outputMultiplier)
    const amountIn = getAmountIn(
      tokenInBucketSize,
      tokenOutBucketSize,
      this.spread,
      scaledOutputAmount,
    );
    const inputAmount = amountIn.idiv(inputMultiplier);
    if (inputAmount.gt(tokenMaxIn)) {
      return new BigNumber(0)
    }
    return inputAmount
  }

  public snapshot(): PairMentoV2Snapshot {
    return {
      spread: this.spread.toFixed(),
      updateFrequency: this.updateFrequency.toFixed(),
      pricingModule: this.pricingModule,
      tokenPrecisionMultipliers: [
        this.tokenPrecisionMultipliers[0].toFixed(),
        this.tokenPrecisionMultipliers[1].toFixed(),
      ],
      decimals: this.decimals,
      isCollateralA: this.isCollateralA,
      isCollateralB: this.isCollateralB,

      bucket0: this.bucket0.toFixed(),
      bucket1: this.bucket1.toFixed(),
      tokenMaxIn: [this.tokenMaxIn[0].toFixed(), this.tokenMaxIn[1].toFixed()],
      tokenMaxOut: [this.tokenMaxOut[0].toFixed(), this.tokenMaxOut[1].toFixed()],
      tradingEnabled: this.tradingEnabled,
      reserveBalanceA: this.reserveBalanceA,
      reserveBalanceB: this.reserveBalanceB,
      errAtoB: this.errAtoB,
      errBtoA: this.errBtoA,
    };
  }

  public async restore(snapshot: PairMentoV2Snapshot): Promise<void> {
    this.spread = new BigNumber(snapshot.spread)
    this.updateFrequency = new BigNumber(snapshot.updateFrequency)
    this.pricingModule = snapshot.pricingModule
    this.tokenPrecisionMultipliers = [
      new BigNumber(snapshot.tokenPrecisionMultipliers[0]),
      new BigNumber(snapshot.tokenPrecisionMultipliers[1]),
    ]
    this.decimals = snapshot.decimals
    this.isCollateralA = snapshot.isCollateralA
    this.isCollateralB = snapshot.isCollateralB

    this.bucket0 = new BigNumber(snapshot.bucket0)
    this.bucket1 = new BigNumber(snapshot.bucket1)
    this.tokenMaxIn = [
      new BigNumber(snapshot.tokenMaxIn[0]),
      new BigNumber(snapshot.tokenMaxIn[1]),
    ]
    this.tokenMaxOut = [
      new BigNumber(snapshot.tokenMaxOut[0]),
      new BigNumber(snapshot.tokenMaxOut[1]),
    ]
    this.tradingEnabled = snapshot.tradingEnabled
    this.reserveBalanceA = snapshot.reserveBalanceA
    this.reserveBalanceB = snapshot.reserveBalanceB
    this.errAtoB = snapshot.errAtoB
    this.errBtoA = snapshot.errBtoA
  }

  private mentoBucketsAfterUpdate = async () => {
    /*
    https://github.com/mento-protocol/mento-core/blob/fa21cb57dc0bc28c2a54b184f4355f53b84521f9/contracts/swap/BiPoolManager.sol#L526C12-L526C32
    function oracleHasValidMedian(PoolExchange memory exchange) internal view returns (bool) {
      (bool isReportExpired, ) = sortedOracles.isOldestReportExpired(exchange.config.referenceRateFeedID);
      bool enoughReports = (sortedOracles.numRates(exchange.config.referenceRateFeedID) >=
        exchange.config.minimumReports);
      bool medianReportRecent = sortedOracles.medianTimestamp(exchange.config.referenceRateFeedID) >
        now.sub(exchange.config.referenceRateResetFrequency);
      return !isReportExpired && enoughReports && medianReportRecent;
    }
    */
    const sortedOracles = ISortedOracles__factory.connect(
      this.sortedOraclesAddress,
      this.provider
    );

    const [
      isOldestReportExpired,
      numRates,
      medianTimestamp,
      medianRate,
    ] = await Promise.all([
      sortedOracles.isOldestReportExpired(this.poolExchange.config.referenceRateFeedID),
      sortedOracles.numRates(this.poolExchange.config.referenceRateFeedID),
      sortedOracles.medianTimestamp(this.poolExchange.config.referenceRateFeedID),
      sortedOracles.medianRate(this.poolExchange.config.referenceRateFeedID),
    ])

    const isReportExpired = isOldestReportExpired[0];
    const enoughReports = numRates.gte(this.poolExchange.config.minimumReports)
    const medianReportRecent = medianTimestamp.gt(
      Math.floor((Date.now() / 1000) - this.poolExchange.config.referenceRateResetFrequency.toNumber()))
    const hasValidMedian = !isReportExpired && enoughReports && medianReportRecent

    if (!hasValidMedian) {
      if (this.pricingModule === PricingFunctionType.ConstantSum) {
        return {bucket0: new BigNumber(0), bucket1: new BigNumber(0)}
      }
      return {
        bucket0: new BigNumber(this.poolExchange.bucket0._hex),
        bucket1: new BigNumber(this.poolExchange.bucket1._hex),
      }
    }

    /*
    ## From BiPoolManager.sol:
    https://github.com/mento-protocol/mento-core/blob/c843b386ae12a6987022842e6b52cc23340555f2/contracts/BiPoolManager.sol#L461
    function getUpdatedBuckets(PoolExchange memory exchange) internal view returns (uint256 bucket0, uint256 bucket1) {
      bucket0 = exchange.config.stablePoolResetSize;
      uint256 exchangeRateNumerator;
      uint256 exchangeRateDenominator;
      (exchangeRateNumerator, exchangeRateDenominator) = getOracleExchangeRate(exchange.config.referenceRateFeedID);

      bucket1 = exchangeRateDenominator.mul(bucket0).div(exchangeRateNumerator);
    }
    */
    const bucket0 = new BigNumber(this.poolExchange.config.stablePoolResetSize._hex)
    const [rateNumerator, rateDenominator] = medianRate
    if (rateDenominator.lte(0)){
      throw new Error("exchange rate denominator must be greater than 0")
    }
    const bucket1 = bucket0.multipliedBy(rateDenominator._hex).idiv(rateNumerator._hex)
    return { bucket0, bucket1 }
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
    // https://github.com/mento-protocol/mento-core/blob/c2e344ebd5f3018253cf26cb39a50f81d8db7c21/contracts/swap/ConstantProductPricingModule.sol#L28
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
    // https://github.com/mento-protocol/mento-core/blob/c2e344ebd5f3018253cf26cb39a50f81d8db7c21/contracts/swap/ConstantSumPricingModule.sol#L29
    if (inputAmount.isZero()){
      return new BigNumber(0);
    }
    const outputAmount =
      FIXED1.minus(spread).multipliedBy(inputAmount).multipliedBy(tokenOutBucketSize)
      .idiv(tokenInBucketSize.multipliedBy(FIXED1));
    return outputAmount
  },
};

type TGetAmountIn = (
  tokenInBucketSize: BigNumber,
  tokenOutBucketSize: BigNumber,
  spread: BigNumber,
  outputAmount: BigNumber
) => BigNumber;

PricingFunctionType;
const GET_AMOUNT_IN: Record<PricingFunctionType, TGetAmountIn> = {
  [PricingFunctionType.ConstantProduct]: (
    tokenInBucketSize,
    tokenOutBucketSize,
    spread,
    outputAmount
  ) => {
    // https://github.com/mento-protocol/mento-core/blob/c2e344ebd5f3018253cf26cb39a50f81d8db7c21/contracts/swap/ConstantProductPricingModule.sol#L60
    if (outputAmount.isZero()) {
      return new BigNumber(0);
    }
    const numerator = outputAmount.multipliedBy(tokenInBucketSize).multipliedBy(FIXED1)
    const denominator = tokenOutBucketSize.minus(outputAmount).multipliedBy(FIXED1.minus(spread))
    return numerator.idiv(denominator)
  },
  [PricingFunctionType.ConstantSum]: (
    tokenInBucketSize,
    tokenOutBucketSize,
    spread,
    outputAmount
  ) => {
    // https://github.com/mento-protocol/mento-core/blob/c2e344ebd5f3018253cf26cb39a50f81d8db7c21/contracts/swap/ConstantSumPricingModule.sol#L59
    if (outputAmount.isZero()){
      return new BigNumber(0);
    }
    const inputAmount = outputAmount.multipliedBy(tokenInBucketSize).multipliedBy(FIXED1)
      .idiv(tokenOutBucketSize.multipliedBy(FIXED1.minus(spread)))
    return inputAmount
  },
};

