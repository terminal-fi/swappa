// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/stCelo/IRebasedStakedCelo.sol";
import "./ISwappaPairV1.sol";

contract PairRStCelo is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address rebaseAddr, uint8 inputType) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));

		if (inputType == 1) {
			// rstCelo -> stCelo
			uint stCeloAmount = IRebasedStakedCelo(rebaseAddr).toStakedCelo(inputAmount);
			IRebasedStakedCelo(rebaseAddr).withdraw(stCeloAmount);
		} else {
			// stCelo -> rstCelo
			require(ERC20(input).approve(rebaseAddr, inputAmount));
			IRebasedStakedCelo(rebaseAddr).deposit(inputAmount);
		}
		uint outputAmount = ERC20(output).balanceOf(address(this));
		require(ERC20(output).transfer(to, outputAmount), "PairRStCelo: Transfer Failed");
	}

	function parseData(bytes memory data) private pure returns (address rebaseAddr, uint8 inputType) {
		require(data.length == 21, "PairRStCelo: invalid data!");
		inputType = uint8(data[20]);
		assembly {
			rebaseAddr := mload(add(data, 20))
		}
	}

	function getOutputAmount(
		address,
		address,
		uint amountIn,
		bytes calldata data
	) external override returns (uint amountOut) {
		(address rebaseAddr, uint8 inputType) = parseData(data);
		if (inputType == 1) {
			// rstCelo -> stCelo
			return IRebasedStakedCelo(rebaseAddr).toStakedCelo(amountIn);
		} else {
			// stCelo -> rstCelo
			return IRebasedStakedCelo(rebaseAddr).toRebasedStakedCelo(amountIn);
		}
	}

	receive() external payable {}
}