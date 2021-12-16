// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
		(address pairAddr, uint feeK) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(
			ERC20(input).transfer(pairAddr, inputAmount),
			"PairUniswapV2: transfer failed!");
		IUniswapV2Pair pair = IUniswapV2Pair(pairAddr);
		(uint reserve0, uint reserve1,) = pair.getReserves();
		if (pair.token0() == input) {
			uint outputAmount = getAmountOut(inputAmount, reserve0, reserve1, feeK);
			pair.swap(0, outputAmount, to, new bytes(0));
		} else {
			uint outputAmount = getAmountOut(inputAmount, reserve1, reserve0, feeK);
			pair.swap(outputAmount, 0, to, new bytes(0));
		}
	}

	function parseData(bytes memory data) private pure returns (address pairAddr, uint fee) {
		require(data.length == 21, "PairUniswapV2: invalid data!");
		fee = uint(1000).sub(uint8(data[20]));
    assembly {
      pairAddr := mload(add(data, 20))
    }
	}

	function getOutputAmount(
		address input,
		address output,
		uint amountIn,
		bytes calldata data
	) external view override returns (uint amountOut) {
		(address pairAddr, uint feeK) = parseData(data);
		IUniswapV2Pair pair = IUniswapV2Pair(pairAddr);
		(uint reserve0, uint reserve1,) = pair.getReserves();
		(uint reserveIn, uint reserveOut) = pair.token0() == input ? (reserve0, reserve1) : (reserve1, reserve0);
		return getAmountOut(amountIn, reserveIn, reserveOut, feeK);
	}

	function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut, uint feeK) internal pure returns (uint amountOut) {
		uint amountInWithFee = amountIn.mul(feeK);
		uint numerator = amountInWithFee.mul(reserveOut);
		uint denominator = reserveIn.mul(1000).add(amountInWithFee);
		amountOut = numerator / denominator;
  	}

	receive() external payable {}
}