// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISwappaPairV1.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/ILendingPoolAddressesProvider.sol";

interface IAToken {
	function redeem(uint256 _amount) external;
}

contract PairAToken is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address providerAddr, uint8 inputType) = parseData(data);
		uint inputAmount = IERC20(input).balanceOf(address(this));
		if (inputType == 1) {
			// Redeem AToken.
			IAToken(input).redeem(inputAmount);
		} else if (inputType == 2) {
			// Deposit CELO.
			address lendingPoolAddr = ILendingPoolAddressesProvider(providerAddr).getLendingPool();
			ILendingPool(lendingPoolAddr).deposit{value: inputAmount}(
				0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,
				inputAmount,
				0x0);
		} else if (inputType == 3) {
			// Deposit non CELO AToken.
			address lendingPoolAddr = ILendingPoolAddressesProvider(providerAddr).getLendingPool();
			address lendingPoolCoreAddr = ILendingPoolAddressesProvider(providerAddr).getLendingPoolCore();
			require(
				IERC20(input).approve(lendingPoolCoreAddr, inputAmount),
				"PairAToken: approve failed!");
			ILendingPool(lendingPoolAddr).deposit(input, inputAmount, 0x0);
		}
		uint outputAmount = IERC20(output).balanceOf(address(this));
		require(
			IERC20(output).transfer(to, outputAmount),
			"PairAToken: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address providerAddr, uint8 inputType) {
		require(data.length == 21, "PairAToken: invalid data!");
		inputType = uint8(data[20]);
    assembly {
      providerAddr := mload(add(data, 20))
    }
	}

	receive() external payable {}
}