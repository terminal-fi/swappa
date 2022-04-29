// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/curve/ICurve.sol";
import "./ISwappaPairV1.sol";

contract PairCurve is ISwappaPairV1 {
	using SafeMath for uint256;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		address swapPoolAddr = parseData(data);
		uint256 inputAmount = ERC20(input).balanceOf(address(this));
		require(
			ERC20(input).approve(swapPoolAddr, inputAmount),
			"PairCurve: approve failed!"
		);
		ICurve swapPool = ICurve(swapPoolAddr);
		(int128 fromIdx, int128 toIdx) = getInputOutputIdx(
			swapPool,
			input,
			output
		);
		uint256 outputAmount = swapPool.exchange(
			fromIdx,
			toIdx,
			inputAmount,
			0
		);
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairCurve: transfer failed!"
		);
	}

	function parseData(bytes memory data)
		private
		pure
		returns (address swapPoolAddr)
	{
		require(data.length == 20, "PairCurve: invalid data!");
		assembly {
			swapPoolAddr := mload(add(data, 20))
		}
	}

	function getOutputAmount(
		address input,
		address output,
		uint256 amountIn,
		bytes calldata data
	) external view override returns (uint256 amountOut) {
		address swapPoolAddr = parseData(data);
		ICurve swapPool = ICurve(swapPoolAddr);
		(int128 fromIdx, int128 toIdx) = getInputOutputIdx(
			swapPool,
			input,
			output
		);
		return swapPool.get_dy(fromIdx, toIdx, amountIn);
	}

	function getInputOutputIdx(
		ICurve swapPool,
		address input,
		address output
	) private view returns (int128 fromIdx, int128 toIdx) {
		uint8 idx;
		// curve pool contain at most 4 coins
		for (idx = 0; idx < 4; idx++) {
			if (swapPool.coins(idx) == input) {
				fromIdx = idx;
			} else if (swapPool.coins(idx) == output) {
				toIdx = idx;
			}
		}
	}
}
