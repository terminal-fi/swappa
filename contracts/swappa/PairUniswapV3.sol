// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/uniswap/IUniswapV3Pool.sol";
import "../interfaces/uniswap/IUniswapV3SwapCallback.sol";
import "../interfaces/uniswap/IQuoterV2.sol";
import "../interfaces/uniswap/SafeCast.sol";
import "../interfaces/uniswap/TickLens.sol";
import "../interfaces/uniswap/TickMath.sol";
import "./ISwappaPairV1.sol";


contract PairUniswapV3 is ISwappaPairV1, IUniswapV3SwapCallback {
	using SafeMath for uint256;
	using SafeCast for uint256;

	function swap(
		address input,
		address,
		address to,
		bytes calldata data
	) external override {
		address pairAddr = parseData(data);
		uint256 inputAmount = ERC20(input).balanceOf(address(this));
		IUniswapV3Pool pair = IUniswapV3Pool(pairAddr);
		bool zeroForOne = pair.token0() == input;
		// calling swap will trigger the uniswapV3SwapCallback
		pair.swap(
			to,
			zeroForOne,
			inputAmount.toInt256(),
			zeroForOne
				? TickMath.MIN_SQRT_RATIO + 1
				: TickMath.MAX_SQRT_RATIO - 1,
			new bytes(0)
		);
	}

	function uniswapV3SwapCallback(
		int256 amount0Delta,
		int256 amount1Delta,
		bytes calldata
	) external override {
		ERC20 token;
		uint256 amount;
		if (amount0Delta > 0) {
			amount = uint256(amount0Delta);
			token = ERC20(IUniswapV3Pool(msg.sender).token0());
		} else if (amount1Delta > 0) {
			amount = uint256(amount1Delta);
			token = ERC20(IUniswapV3Pool(msg.sender).token1());
		}
		require(
			token.transfer(msg.sender, amount),
			"PairUniswapV3: transfer failed!"
		);
	}

	function parseData(bytes memory data)
		private
		pure
		returns (address pairAddr)
	{
		require(data.length == 20, "PairUniswapV3: invalid data!");
		assembly {
			pairAddr := mload(add(data, 20))
		}
	}

	function getOutputAmount(
		address input,
		address output,
		uint256 amountIn,
		bytes calldata data
	) external override returns (uint256 amountOut) {
		address pairAddr = parseData(data);
		IUniswapV3Pool pair = IUniswapV3Pool(pairAddr);
		IQuoterV2 quoter = IQuoterV2(0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8);
		(amountOut,,,) = quoter.quoteExactInputSingle(IQuoterV2.QuoteExactInputSingleParams({
			tokenIn: input,
			tokenOut: output,
			fee: pair.fee(),
			amountIn: amountIn,
			sqrtPriceLimitX96: 0}));
	}

	function getPoolTicks(IUniswapV3Pool pool, int16 maxLoopN)
		public
		view
		returns (
			uint160 sqrtPriceX96,
			int24 tick,
			uint128 liquidity,
			TickLens.PopulatedTick[] memory populatedTicks0,
			TickLens.PopulatedTick[] memory populatedTicks1,
			TickLens.PopulatedTick[] memory populatedTicks2,
			TickLens.PopulatedTick[] memory populatedTicks3,
			TickLens.PopulatedTick[] memory populatedTicks4
		)
	{
		return TickLens.getPoolTicks(pool, maxLoopN);
	}
}