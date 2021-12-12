// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ISwappaPairV1.sol";

interface ISavingsCELO {
	function deposit() external payable returns (uint256 toMint);
}

contract PairSavingsCELO is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address savingsCELOAddr, uint minInputAmount) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(inputAmount >= minInputAmount, "PairSavingsCELO: insufficient input amount");
		uint outputAmount = ISavingsCELO(savingsCELOAddr).deposit{value: inputAmount}();
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairSavingsCELO: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address savingsCELOAddr, uint minInputAmount) {
		require(data.length == 20 || data.length == 20 + 32, "PairSavingsCELO: invalid data!");
    assembly {
      savingsCELOAddr := mload(add(data, 0x20))
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
