// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface IOpenSumSwap {
	function paused() external view returns (bool);
	function getToken(uint8 index) external view returns (address);
	function getBalances() external view returns (uint256[] memory);
	function swap(
		address tokenFrom,
		address tokenTo,
		uint256 amountIn,
		uint256 minAmountOut,
		uint256 deadline
	) external returns (uint256);
}
