// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "../interfaces/balancer/IBPool.sol";
import "../interfaces/balancer/IBRegistry.sol";

contract RegistryHelperBalancer {

    struct TokenState {
        address token;
        uint balance;
        uint denormalizedWeight;
    }

    struct PoolInfo {
        IBPool pool;
        uint swapFee;
        TokenState[] tokenStates;
    }

    function findPools(
        IBRegistry registry,
        address[] calldata fromTokens,
        address[] calldata toTokens
    ) external view returns (PoolInfo[] memory result) {
        require(fromTokens.length == toTokens.length,
            "fromTokens and toTokens must be of equal length");

        IBPool[] memory foundPools = new IBPool[](fromTokens.length * 5);
        uint found = 0;

        for (uint i = 0; i < fromTokens.length; i++) {
            // only take up the best 5 pools for a particular pair
            address[] memory pools =
                registry.getBestPoolsWithLimit(fromTokens[i], toTokens[i], 5);
            for (uint j = 0; j < pools.length; j++) {
                IBPool pool = IBPool(pools[j]);
                if (!pool.isFinalized()) {
                    continue;
                }

                bool addPool = true;
                for (uint k = 0; k < found; k++) {
                    if (foundPools[k] == pool) {
                        // already seen this pool, skip
                        addPool = false;
                        break;
                    }
                }
                if (addPool) {
                    // add this newly found pool
                    foundPools[found++] = pool;
                }
            }
        }

        result = new PoolInfo[](found);
        for (uint i = 0; i < found; i++) {
            IBPool pool = foundPools[i];
            result[i] = this.getPoolInfo(pool);
        }
    }

    function refreshPools(
        IBPool[] calldata pools
    ) external view returns (PoolInfo[] memory result) {
        result = new PoolInfo[](pools.length);
        for (uint i = 0; i < pools.length; i++) {
            result[i] = this.getPoolInfo(pools[i]);
        }
    }

    function getPoolInfo(IBPool pool) external view returns (PoolInfo memory result) {
        address[] memory poolTokens = pool.getCurrentTokens();
        TokenState[] memory tokenStates = new TokenState[](poolTokens.length);
        // collect information about all of the tokens in the pool
        for (uint j = 0; j < poolTokens.length; j++) {
            address token = poolTokens[j];
            tokenStates[j] = TokenState(
                token,
                pool.getBalance(token),
                pool.getDenormalizedWeight(token)
            );
        }

        result = PoolInfo(
            pool,
            pool.getSwapFee(),
            tokenStates
        );
    }
}
