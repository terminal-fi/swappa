// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "../interfaces/uniswap/IUniswapV2Pair.sol";
import "../interfaces/uniswap/IUniswapV2Factory.sol";

contract RegistryHelperUniswapV2 {

    struct PairState {
        uint reserve0;
        uint reserve1;
    }

    struct PairInfo {
        IUniswapV2Pair pair;
        address token0;
        address token1;
        PairState state;
    }

    function findPairs(
        IUniswapV2Factory factory,
        address[] calldata tokenWhitelist,
        uint offset,
        uint limit
    ) external view returns (PairInfo[] memory result) {
        uint allPairsUpTo = factory.allPairsLength();

        if (allPairsUpTo > offset + limit) {
            allPairsUpTo = offset + limit;
        }

        // allocate a buffer array with the upper bound of the number of pairs returned
        PairInfo[] memory buffer = new PairInfo[](limit);
        uint found = 0;
        for (uint i = offset; i < allPairsUpTo; i++) {
            IUniswapV2Pair uniPair = IUniswapV2Pair(factory.allPairs(i));
            address token0 = uniPair.token0();
            address token1 = uniPair.token1();

            // allow all pairs if the whitelist is empty
            bool isOnWhitelist = tokenWhitelist.length == 0;
            for (uint j = 0; j < tokenWhitelist.length; j++) {
                address w = tokenWhitelist[i];
                if (token0 == w || token1 == w) {
                    isOnWhitelist = true;
                    break;
                }
            }

            if (isOnWhitelist) {
                (uint reserve0, uint reserve1, ) = uniPair.getReserves();
                // only add to the buffer if the pair is on the whitelist
                buffer[found++] = PairInfo(uniPair, token0, token1, PairState(reserve0, reserve1));
            }
        }

        // copy the valid pairs from the buffer into the result
        result = new PairInfo[](found);
        for (uint i = 0; i < found; i++) {
            result[i] = buffer[i];
        }
    }

    function refreshPairs(
        IUniswapV2Pair[] calldata pairs
    ) external view returns (PairState[] memory result) {
        result = new PairState[](pairs.length);
        for (uint i = 0; i < pairs.length; i++) {
            (uint reserve0, uint reserve1, ) = pairs[i].getReserves();
            result[i] = PairState(reserve0, reserve1);
        }
    }
}
