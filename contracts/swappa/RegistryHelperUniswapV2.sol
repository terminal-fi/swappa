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
        uint offset,
        uint limit
    ) external view returns (PairInfo[] memory result) {
        uint allPairsUpTo = factory.allPairsLength();

        if (allPairsUpTo > offset + limit) {
            // limit the number of pairs returned
            allPairsUpTo = offset + limit;
        } else if (allPairsUpTo < offset) {
            // there are no more pairs
            return result;
        }

        // allocate a buffer array with the upper bound of the number of pairs returned
        result = new PairInfo[](allPairsUpTo - offset);
        for (uint i = offset; i < allPairsUpTo; i++) {
            IUniswapV2Pair uniPair = IUniswapV2Pair(factory.allPairs(i));
            address token0 = uniPair.token0();
            address token1 = uniPair.token1();
            (uint reserve0, uint reserve1, ) = uniPair.getReserves();
            result[i - offset] = PairInfo(uniPair, token0, token1, PairState(reserve0, reserve1));
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
