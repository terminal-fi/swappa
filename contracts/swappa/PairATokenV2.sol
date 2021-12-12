// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/aave-v2/ILendingPoolV2.sol";
import "./ISwappaPairV1.sol";

contract PairATokenV2 is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address poolAddr, uint8 inputType, uint minInputAmount) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(inputAmount >= minInputAmount, "PairATokenV2: insufficient input amount");
		if (inputType == 1) {
			// AToken -> Underlying.
			ILendingPoolV2(poolAddr).withdraw(output, inputAmount, to);
		} else if (inputType == 2) {
			// Underlying -> AToken.
			require(
				ERC20(input).approve(poolAddr, inputAmount),
				"PairATokenV2: approve failed!");
			ILendingPoolV2(poolAddr).deposit(input, inputAmount, to, 0x0);
		}
	}

	function parseData(bytes memory data) private pure returns (address poolAddr, uint8 inputType, uint minInputAmount) {
		require(data.length == 21 || data.length == 21 + 32, "PairATokenV2: invalid data!");
		inputType = uint8(data[20]);
    assembly {
      poolAddr := mload(add(data, 0x20))
    }
		if (data.length == 21) {
			minInputAmount = 0;
		} else {
			assembly {
				// 0x20 is the first slot of array containing the length
				// offset by 20 bytes for address and 1 byte for fee
				// minimal input amount start 0x35
				minInputAmount := mload(add(data, 0x35))
			}
		}
	}

	receive() external payable {}
}