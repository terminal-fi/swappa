// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/stableswap/IOpenSumSwap.sol";
import "./ISwappaPairV1.sol";

contract PairOpenSumSwap is ISwappaPairV1 {
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
			"PairOpenSumSwap: approve failed!");
		uint outputAmount = IOpenSumSwap(swapPoolAddr).swap(
			input,
			output,
			inputAmount,
			inputAmount,
			block.timestamp);
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairOpenSumSwap: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address swapPoolAddr) {
		require(data.length == 20, "PairOpenSumSwap: invalid data!");
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
		// no fees are taken
		return amountIn;
	}
}
