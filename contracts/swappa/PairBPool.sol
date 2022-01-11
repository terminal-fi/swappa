// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/balancer/IBPool.sol";
import "./ISwappaPairV1.sol";

contract PairBPool is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		address poolAddr = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(
			ERC20(input).approve(poolAddr, inputAmount),
			"PairBPool: approve failed!");
		(uint outputAmount,) = IBPool(poolAddr).swapExactAmountIn(
			input,
			inputAmount,
			output,
			0, // minAmountOut
			~uint256(0) // maxPrice
		);
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairBPool: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address poolAddr) {
		require(data.length == 20, "PairBPool: invalid data!");
	assembly {
	  poolAddr := mload(add(data, 20))
	}
	}

	function getOutputAmount(
		address input,
		address output,
		uint amountIn,
		bytes calldata data
	) external view override returns (uint amountOut) {
		IBPool pool = IBPool(parseData(data));
		amountOut = pool.calcOutGivenIn(
			pool.getBalance(input),
			pool.getDenormalizedWeight(input),
			pool.getBalance(output),
			pool.getDenormalizedWeight(output),
			amountIn,
			pool.getSwapFee()
		);
	}
}
