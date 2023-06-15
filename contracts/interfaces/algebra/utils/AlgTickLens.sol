// SPDX-License-Identifier: MIT
pragma solidity >=0.4.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "../IAlgebraPool.sol";

library AlgTickLens {

    struct PopulatedTick {
        int24 tick;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    function getSpotTicks(IAlgebraPool pool)
        internal
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            PopulatedTick[] memory populatedTicksTwiceAbove,
            PopulatedTick[] memory populatedTicksAbove,
            PopulatedTick[] memory populatedTicksSpot,
            PopulatedTick[] memory populatedTicksBelow,
            PopulatedTick[] memory populatedTicksTwiceBelow
        )
    {
        // get the populated ticks above and below the current spot tick
        (
            sqrtPriceX96,
            tick,
            , // uint16 observationIndex
            , // uint16 observationCardinality
            , // uint16 observationCardinalityNext
            , // uint8 feeProtocol
            // bool unlocked
        ) = pool.globalState();

        int24 tickSpacing = pool.tickSpacing();
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity

        // current word position within bitmap
        int16 tickBitmapIndex = int16(compressed >> 8);

        // get the populated ticks at, above, and below the current word
        populatedTicksSpot = getPopulatedTicksInWord(pool, tickBitmapIndex);
        populatedTicksTwiceAbove = getPopulatedTicksInWord(
            pool,
            tickBitmapIndex + 2
        );
        populatedTicksTwiceBelow = getPopulatedTicksInWord(
            pool,
            tickBitmapIndex - 2
        );
        populatedTicksAbove = getPopulatedTicksInWord(
            pool,
            tickBitmapIndex + 1
        );
        populatedTicksBelow = getPopulatedTicksInWord(
            pool,
            tickBitmapIndex - 1
        );
    }

    function getPopulatedTicksInWord(IAlgebraPool pool, int16 tickBitmapIndex)
        internal
        view
        returns (PopulatedTick[] memory populatedTicks)
    {
        // fetch bitmap
        uint256 bitmap = pool.tickTable(tickBitmapIndex);

        // calculate the number of populated ticks
        uint256 numberOfPopulatedTicks;
        for (uint256 i = 0; i < 256; i++) {
            if (bitmap & (1 << i) > 0) numberOfPopulatedTicks++;
        }

        // fetch populated tick data
        int24 tickSpacing = pool.tickSpacing();
        populatedTicks = new PopulatedTick[](numberOfPopulatedTicks);
        for (uint256 i = 0; i < 256; i++) {
            if (bitmap & (1 << i) > 0) {
                int24 populatedTick = ((int24(tickBitmapIndex) << 8) +
                    int24(i)) * tickSpacing;
                (uint128 liquidityGross, int128 liquidityNet, , , , , , ) = pool
                    .ticks(populatedTick);
                populatedTicks[--numberOfPopulatedTicks] = PopulatedTick({
                    tick: populatedTick,
                    liquidityNet: liquidityNet,
                    liquidityGross: liquidityGross
                });
            }
        }
    }
}