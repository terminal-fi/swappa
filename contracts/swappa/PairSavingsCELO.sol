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
		address savingsCELOAddr = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		uint outputAmount = ISavingsCELO(savingsCELOAddr).deposit{value: inputAmount}();
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairSavingsCELO: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address savingsCELOAddr) {
		require(data.length == 20, "PairSavingsCELO: invalid data!");
    assembly {
      savingsCELOAddr := mload(add(data, 20))
    }
	}

	receive() external payable {}
}
