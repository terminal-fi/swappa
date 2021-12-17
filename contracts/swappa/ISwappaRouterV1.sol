// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

interface ISwappaRouterV1 {
	function getOutputAmount(
		address[] calldata path,
		address[] calldata pairs,
		bytes[] calldata extras,
		uint256 inputAmount
	) external view returns (uint256 outputAmount);

	function swapExactInputForOutput(
		address[] calldata path,
		address[] calldata pairs,
		bytes[] calldata extras,
		uint256 inputAmount,
		uint256 minOutputAmount,
		address to,
		uint deadline
	) external returns (uint256 outputAmount);

	function swapExactInputForOutputWithPrecheck(
		address[] calldata path,
		address[] calldata pairs,
		bytes[] calldata extras,
		uint256 inputAmount,
		uint256 minOutputAmount,
		address to,
		uint deadline
	) external returns (uint256 outputAmount);
}
