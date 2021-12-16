// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ISwap {
	function paused() external view returns (bool);
	function getToken(uint8 index) external view returns (address);
	function getBalances() external view returns (uint256[] memory);
	function getSwapFee() external view returns (uint256);
	function getAPrecise() external view returns (uint256);

	function swap(
		uint8 tokenIndexFrom,
		uint8 tokenIndexTo,
		uint256 dx,
		uint256 minDy,
		uint256 deadline
	) external returns (uint256);

	function calculateSwap(
		uint8 tokenIndexFrom,
		uint8 tokenIndexTo,
		uint256 dx
	) external view returns (uint256);
}
