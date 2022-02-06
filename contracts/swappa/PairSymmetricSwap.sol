// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/symmetric/ISymmetricSwap.sol";
import "./ISwappaPairV1.sol";

contract PairSymmetricSwap is ISwappaPairV1 {
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
			"PairSymmetricSwap: approve failed!");
		ISymmetricSwap(swapPoolAddr).swap(
			input,
			output,
			inputAmount);
		require(
			ERC20(output).transfer(to, inputAmount),
			"PairSymmetricSwap: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address swapPoolAddr) {
		require(data.length == 20, "PairSymmetricSwap: invalid data!");
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
