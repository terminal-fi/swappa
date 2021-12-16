// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ISwappaPairV1 {
	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external;

	// Get the output amount in output token for a given amountIn of the input token, with the encoded extra data.
	// Output amount is undefined if input token is invalid for the swap pair.
	function getOutputAmount(
		address input,
		address output,
		uint amountIn,
		bytes calldata data
	) external view returns (uint amountOut);
}