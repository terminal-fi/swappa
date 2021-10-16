// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISwappaPairV1.sol";

contract SwappaRouterV1 {
	event Swap(
		address indexed sender,
		address to,
		address indexed input,
		address indexed output,
		uint256 inputAmount,
		uint256 outputAmount
	);

	modifier ensure(uint deadline) {
		require(deadline >= block.timestamp, 'SwappaRouter: Expired!');
		_;
	}

	function swapExactInputForOutput(
		address[] calldata path,
		address[] calldata pairs,
		bytes[] calldata extras,
		uint256 inputAmount,
		uint256 minOutputAmount,
		address to,
		uint deadline
	) external ensure(deadline) returns (uint256 outputAmount) {
		require(path.length == pairs.length + 1 , "SwappaRouter: Path and Pairs mismatch!");
		require(pairs.length == extras.length, "SwappaRouter: Pairs and Extras mismatch!");
		require(pairs.length > 0, "SwappaRouter: Must have at least one pair!");

		require(
			IERC20(path[0]).transferFrom(msg.sender, pairs[0], inputAmount),
			"SwappaRouter: Initial transferFrom failed!");
		for (uint i; i < pairs.length; i++) {
			(address pairInput, address pairOutput) = (path[i], path[i + 1]);
			address next = i < pairs.length - 1 ? pairs[i+1] : address(this);
			bytes memory data = extras[i];
			ISwappaPairV1(pairs[i]).swap(pairInput, pairOutput, next, data);
		}
		// Perform final output check in the router as a final safeguard to make sure
		// minOutputAmount restriction is honored no matter what.
		address output = path[path.length - 1];
		outputAmount = IERC20(output).balanceOf(address(this));
		require(
			outputAmount >= minOutputAmount, "SwappaRouter: Insufficient output amount!");
		require(
			IERC20(output).transfer(to, outputAmount),
			"SwappaRouter: Final transfer failed!");
		emit Swap(msg.sender, to, path[0], output, inputAmount, outputAmount);
	}

	receive() external payable {}
}