// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ISymmetricSwap {
	function paused() external view returns (bool);
	function swap(
		address from,
		address to,
		uint256 amount
	) external;
}
