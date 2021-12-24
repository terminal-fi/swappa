import { ContractKit, StableToken } from "@celo/contractkit";
import Web3 from "web3";
import { ExchangeWrapper } from "@celo/contractkit/lib/wrappers/Exchange";
import BigNumber from "bignumber.js";
import { PairXYeqK } from "../pair";
import { address as pairMentoAddress } from "../../tools/deployed/mainnet.PairMento.addr.json";
import { ReserveWrapper } from "@celo/contractkit/lib/wrappers/Reserve";
import { SortedOraclesWrapper } from "@celo/contractkit/lib/wrappers/SortedOracles";
import { selectAddress } from "../utils";

export class PairMento extends PairXYeqK {
  allowRepeats = false;

  private exchange?: ExchangeWrapper;
  private reserve?: ReserveWrapper;
  private sortedOracles?: SortedOraclesWrapper;

  constructor(private kit: ContractKit, private stableToken: StableToken) {
    super();
  }

  protected async _init() {
    const celo = await this.kit.contracts.getGoldToken();
    const cSTB = await this.kit.contracts.getStableToken(this.stableToken);
    this.exchange = await this.kit.contracts.getExchange(this.stableToken);
    this.reserve = await this.kit.contracts.getReserve();
    this.sortedOracles = await this.kit.contracts.getSortedOracles();
    return {
      pairKey: this.exchange.address,
      tokenA: celo.address,
      tokenB: cSTB.address,
      swappaPairAddress: await selectAddress(this.kit.web3 as unknown as Web3, {
        mainnet: pairMentoAddress,
      }),
    };
  }

  public async refresh(): Promise<void> {
    const [lastUpdateSecs, updateFrequencySecs, spread] = await Promise.all([
      this.exchange!.lastBucketUpdate(),
      this.exchange!.updateFrequency(),
      this.exchange!.spread(),
    ]);
    const tillUpdateSecs = lastUpdateSecs
      .plus(updateFrequencySecs)
      .minus(Date.now() / 1000);
    let buckets: { bucketCELO: BigNumber; bucketSTB: BigNumber };
    if (tillUpdateSecs.gt(0) && tillUpdateSecs.lte(5)) {
      // Next block will likely have bucket update. `getBuyAndSellBuckets` will be inaccurate
      // because block timestamp in next block will be 0-5 seconds in future.
      buckets = await this.mentoBucketsAfterUpdate();
    } else {
      const [bucketCELO, bucketSTB] = await this.exchange!.getBuyAndSellBuckets(
        false
      );
      buckets = { bucketCELO, bucketSTB };
    }
    this.refreshBuckets(
      new BigNumber(1).minus(spread),
      buckets.bucketCELO,
      buckets.bucketSTB
    );
  }

  private mentoBucketsAfterUpdate = async () => {
    // ## from Exchange.sol:
    // function getUpdatedBuckets() private view returns (uint256, uint256) {
    // 	uint256 updatedGoldBucket = getUpdatedGoldBucket();
    // 	uint256 exchangeRateNumerator;
    // 	uint256 exchangeRateDenominator;
    // 	(exchangeRateNumerator, exchangeRateDenominator) = getOracleExchangeRate();
    // 	uint256 updatedStableBucket = exchangeRateNumerator.mul(updatedGoldBucket).div(
    // 		exchangeRateDenominator
    // 	);
    // 	return (updatedGoldBucket, updatedStableBucket);
    // }
    //
    // function getUpdatedGoldBucket() private view returns (uint256) {
    // 	uint256 reserveGoldBalance = getReserve().getUnfrozenReserveGoldBalance();
    // 	return reserveFraction.multiply(FixidityLib.newFixed(reserveGoldBalance)).fromFixed();
    // }
    const stableContract = this.kit.celoTokens.getContract(this.stableToken);
    const [reserveGoldBalance, reserveFraction, oracleRate] = await Promise.all(
      [
        this.reserve!.getUnfrozenReserveCeloBalance(),
        this.exchange!.reserveFraction(),
        this.sortedOracles!.medianRate(stableContract),
      ]
    );
    const bucketCELO = reserveGoldBalance
      .multipliedBy(reserveFraction)
      .integerValue(BigNumber.ROUND_DOWN);
    const bucketSTB = bucketCELO
      .multipliedBy(oracleRate.rate)
      .integerValue(BigNumber.ROUND_DOWN);
    return { bucketCELO, bucketSTB };
  };

  protected swapExtraData() {
    return this.exchange!.address;
  }
}
