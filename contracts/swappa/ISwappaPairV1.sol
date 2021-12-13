// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ISwappaPairV1 {
	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external;

	function getOutputAmount(
		address input,
		uint amountIn,
		bytes calldata data
	) external view returns (uint amountOut);
}