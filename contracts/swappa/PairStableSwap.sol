// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/stableswap/ISwap.sol";
import "./ISwappaPairV1.sol";

contract PairStableSwap is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address swapPoolAddr, uint minInputAmount) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(inputAmount >= minInputAmount, "PairStableSwap: insufficient input amount");
		require(
			ERC20(input).approve(swapPoolAddr, inputAmount),
			"PairStableSwap: approve failed!");
		ISwap swapPool = ISwap(swapPoolAddr);
		uint outputAmount;
		if (swapPool.getToken(0) == input) {
			outputAmount = swapPool.swap(0, 1, inputAmount, 0, block.timestamp);
		} else {
			outputAmount = swapPool.swap(1, 0, inputAmount, 0, block.timestamp);
		}
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairStableSwap: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address swapPoolAddr, uint minInputAmount) {
		require(data.length == 20 || data.length == 20 + 32, "PairStableSwap: invalid data!");
    assembly {
      swapPoolAddr := mload(add(data, 0x20))
    }
		if (data.length == 20) {
			minInputAmount = 0;
		} else {
			assembly {
				// 0x20 is the first slot of array containing the length
				// offset by 20 bytes for address
				// minimal input amount start 0x34
				minInputAmount := mload(add(data, 0x34))
			}
		}
	}

	receive() external payable {}
}