// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/stableswap/ISwap.sol";
import "./ISwappaPairV1.sol";

contract PairStableSwap is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		address swapPoolAddr = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(
			ERC20(input).approve(swapPoolAddr, inputAmount),
			"PairStableSwap: approve failed!");
		ISwap swapPool = ISwap(swapPoolAddr);
		uint outputAmount;
		// TODO(zviadm): This will need to change to support multi-token pools.
		if (swapPool.getToken(0) == input) {
			outputAmount = swapPool.swap(0, 1, inputAmount, 0, block.timestamp);
		} else {
			outputAmount = swapPool.swap(1, 0, inputAmount, 0, block.timestamp);
		}
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairStableSwap: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address swapPoolAddr) {
		require(data.length == 20, "PairStableSwap: invalid data!");
    assembly {
      swapPoolAddr := mload(add(data, 20))
    }
	}

	function getOutputAmount(
		address input,
		address output,
		uint amountIn,
		bytes calldata data
	) external view override returns (uint amountOut) {
		address swapPoolAddr = parseData(data);
		ISwap swapPool = ISwap(swapPoolAddr);
		// TODO(zviadm): This will need to change to support multi-token pools.
		if (swapPool.getToken(0) == input) {
			return swapPool.calculateSwap(0, 1, amountIn);
		} else {
			return swapPool.calculateSwap(1, 0, amountIn);
		}
	}

	receive() external payable {}
}