// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ISwappaPairV1.sol";

interface IExchange {
	function stable() external returns (address);
	function sell(uint256 sellAmount, uint256 minBuyAmount, bool sellGold) external returns (uint256);
}

contract PairMento is ISwappaPairV1 {
	using SafeMath for uint;

	function swap(
		address input,
		address output,
		address to,
		bytes calldata data
	) external override {
		(address exchangeAddr, uint minInputAmount) = parseData(data);
		uint inputAmount = ERC20(input).balanceOf(address(this));
		require(inputAmount >= minInputAmount, "PairMento: insufficient input amount");
		require(
			ERC20(input).approve(exchangeAddr, inputAmount),
			"PairMento: approve failed!");
		IExchange exchange = IExchange(exchangeAddr);
		bool sellGold = (exchange.stable() != input);
		uint outputAmount = exchange.sell(inputAmount, 0, sellGold);
		require(
			ERC20(output).transfer(to, outputAmount),
			"PairMento: transfer failed!");
	}

	function parseData(bytes memory data) private pure returns (address exchangeAddr, uint minInputAmount) {
		require(data.length == 20 || data.length == 20 + 32, "PairMento: invalid data!");
    assembly {
      exchangeAddr := mload(add(data, 0x20))
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