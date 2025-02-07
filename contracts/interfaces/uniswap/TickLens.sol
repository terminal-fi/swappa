// SPDX-License-Identifier: MIT
pragma solidity >=0.4.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "./IUniswapV3Pool.sol";
import "./TickMath.sol";

library TickLens {
    struct PopulatedTick {
        int24 tick;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    // getPoolTicks returns populated ticks from the Uniswapv3 pool.
    // To keep things reasonably performant it only tries to fetch 5 populated tick words.
    // populatedTicks are not sorted, thus it is up to the user to sort them appropriately.
    function getPoolTicks(
        IUniswapV3Pool pool,
        int16 maxLoopN
    )
        internal
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint128 liquidity,
            PopulatedTick[] memory populatedTicks0,
            PopulatedTick[] memory populatedTicks1,
            PopulatedTick[] memory populatedTicks2,
            PopulatedTick[] memory populatedTicks3,
            PopulatedTick[] memory populatedTicks4
        )
    {
        (
            sqrtPriceX96,
            tick, // uint16 observationIndex
            // uint16 observationCardinality
            // uint16 observationCardinalityNext
            // uint8 feeProtocol
            // bool unlocked
            ,
            ,
            ,
            ,

        ) = pool.slot0();
        liquidity = pool.liquidity();

        int24 tickSpacing = pool.tickSpacing();
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity

        // current word position within bitmap
        int16 tickBitmapIndex = int16(compressed >> 8);

        // get the populated ticks near current tick.
        int16 boundTickBitmapIndex = tickBitmapIndex + maxLoopN / 2;
        int16 nextBitmapIndex = tickBitmapIndex;
        (populatedTicks0, nextBitmapIndex) = nextPopulatedTick(
            pool,
            nextBitmapIndex,
            boundTickBitmapIndex
        );
        (populatedTicks1, nextBitmapIndex) = nextPopulatedTick(
            pool,
            nextBitmapIndex,
            boundTickBitmapIndex
        );
        (populatedTicks2, nextBitmapIndex) = nextPopulatedTick(
            pool,
            nextBitmapIndex,
            boundTickBitmapIndex
        );

        boundTickBitmapIndex = tickBitmapIndex - maxLoopN / 2;
        nextBitmapIndex = tickBitmapIndex - 1;
        (populatedTicks3, nextBitmapIndex) = prevPopulatedTick(
            pool,
            nextBitmapIndex,
            boundTickBitmapIndex
        );
        (populatedTicks4, nextBitmapIndex) = prevPopulatedTick(
            pool,
            nextBitmapIndex,
            boundTickBitmapIndex
        );
    }

    function nextPopulatedTick(
        IUniswapV3Pool pool,
        int16 tickBitmapIndex,
        int16 maxTickBitmapIndex
    )
        internal
        view
        returns (PopulatedTick[] memory populatedTicks, int16 nextBitmapIndex)
    {
        for (
            nextBitmapIndex = tickBitmapIndex;
            nextBitmapIndex <= maxTickBitmapIndex && populatedTicks.length == 0;
            nextBitmapIndex += 1
        ) {
            uint256 bitmap = pool.tickBitmap(nextBitmapIndex);
            if (bitmap > 0) {
                populatedTicks = getPopulatedTicksInWord(
                    pool,
                    nextBitmapIndex,
                    bitmap
                );
            }
        }
    }

    function prevPopulatedTick(
        IUniswapV3Pool pool,
        int16 tickBitmapIndex,
        int16 minTickBitmapIndex
    )
        internal
        view
        returns (PopulatedTick[] memory populatedTicks, int16 nextBitmapIndex)
    {
        for (
            nextBitmapIndex = tickBitmapIndex;
            nextBitmapIndex >= minTickBitmapIndex && populatedTicks.length == 0;
            nextBitmapIndex -= 1
        ) {
            uint256 bitmap = pool.tickBitmap(nextBitmapIndex);
            if (bitmap > 0) {
                populatedTicks = getPopulatedTicksInWord(
                    pool,
                    nextBitmapIndex,
                    bitmap
                );
            }
        }
    }

    function getPopulatedTicksInWord(
        IUniswapV3Pool pool,
        int16 tickBitmapIndex,
        uint256 bitmap
    ) internal view returns (PopulatedTick[] memory populatedTicks) {
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
