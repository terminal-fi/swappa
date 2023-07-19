// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/stCelo/IManager.sol";
import "./ISwappaPairV1.sol";

contract PairStCelo is ISwappaPairV1 {
	using SafeMath for uint;

	address constant CELO_ADDRESS = 0x471EcE3750Da237f93B8E339c536989b8978a438;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		require(input == CELO_ADDRESS, "PairStCelo: Incorrect Input");
		address payable managerAddr = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		IManager(managerAddr).deposit{value: inputAmount}();
		uint outputAmount = ERC20(output).balanceOf(address(this));
		require(ERC20(output).transfer(to, outputAmount), "PairStCelo: Transfer Failed");
	}

	function parseData(bytes memory data) private pure returns (address payable managerAddr) {
		require(data.length == 20, "PairStCelo: invalid data!");
		assembly {
			managerAddr := mload(add(data, 20))
		}
	}

	function getOutputAmount(
		address input,
		address,
		uint amountIn,
		bytes calldata data
	) external override returns (uint amountOut) {
		if (input == CELO_ADDRESS) {
			address payable managerAddr = parseData(data);
			return IManager(managerAddr).toStakedCelo(amountIn);
		} else {
			return 0;
		}
	}

	receive() external payable {}
}