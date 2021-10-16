// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/uniswap/IUniswapV2Pair.sol";
import "./ISwappaPairV1.sol";

contract PairUniswapV2 is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		address pairAddr = parseData(data);
		uint inputAmount = IERC20(input).balanceOf(address(this));
		require(
			IERC20(input).approve(pairAddr, 0),
			"PairUniswapV2: approve reset failed!");
		require(
			IERC20(input).approve(pairAddr, inputAmount),
			"PairUniswapV2: approve failed!");
		IUniswapV2Pair pair = IUniswapV2Pair(pairAddr);
		(uint reserve0, uint reserve1,) = pair.getReserves();
		if (pair.token0() == input) {
			uint outputAmount = getAmountOut(inputAmount, reserve0, reserve1);
			pair.swap(0, outputAmount, to, new bytes(0));
		} else {
			uint outputAmount = getAmountOut(inputAmount, reserve1, reserve0);
			pair.swap(outputAmount, 0, to, new bytes(0));
		}
	}

	function parseData(bytes memory data) private pure returns (address pairAddr) {
		require(data.length == 20, "PairUniswapV2: invalid data!");
    assembly {
      pairAddr := mload(add(data, 20))
    }
	}

	function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
		uint amountInWithFee = amountIn.mul(997);
		uint numerator = amountInWithFee.mul(reserveOut);
		uint denominator = reserveIn.mul(1000).add(amountInWithFee);
		amountOut = numerator / denominator;
  }
}