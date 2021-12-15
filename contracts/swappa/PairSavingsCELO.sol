// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ISwappaPairV1.sol";

interface ISavingsCELO {
	function deposit() external payable returns (uint256 toMint);
	function celoToSavings(uint256 celoAmount) external view returns (uint256);
	function savingsToCELO(uint256 savingsAmount) external view returns (uint256);
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

	function getOutputAmount(
		address input,
		uint amountIn,
		bytes calldata data
	) external view override returns (uint amountOut) {
		address savingsCELOAddr = parseData(data);
		if (input == 0x2879BFD5e7c4EF331384E908aaA3Bd3014b703fA) {
			// Savings CELO
			return ISavingsCELO(savingsCELOAddr).savingsToCELO(amountIn);
		} else if (input == 0x471EcE3750Da237f93B8E339c536989b8978a438) {
			// CELO
			return ISavingsCELO(savingsCELOAddr).celoToSavings(amountIn);
		} else {
			return 0;
		}
	}

	receive() external payable {}
}
