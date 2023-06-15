import { NEGATIVE_ONE, ZERO } from "../../constants";

export abstract class LiquidityMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static addDelta(x: bigint, y: bigint): bigint {
    if (y < ZERO) {
      return x - (y * NEGATIVE_ONE);
    } else {
      return x + y;
    }
  }
}
