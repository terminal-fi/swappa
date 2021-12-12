// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
		(address providerAddr, uint8 inputType, uint minInputAmount) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(inputAmount >= minInputAmount, "PairATokenV2: insufficient input amount");
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
				ERC20(input).approve(lendingPoolCoreAddr, inputAmount),
				"PairAToken: approve failed!");
			ILendingPool(lendingPoolAddr).deposit(input, inputAmount, 0x0);
		}
		require(
			ERC20(output).transfer(to, inputAmount),
			"PairAToken: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address providerAddr, uint8 inputType, uint minInputAmount) {
		require(data.length == 21 || data.length == 21 + 32, "PairAToken: invalid data!");
		inputType = uint8(data[20]);
    assembly {
      providerAddr := mload(add(data, 0x20))
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