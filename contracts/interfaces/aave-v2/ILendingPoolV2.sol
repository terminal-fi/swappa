// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {DataTypes} from './DataTypes.sol';

interface ILendingPoolV2 {
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);

  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external;

  function getReservesList() external view returns (address[] memory);
	function getReserveData(address asset) external view returns (DataTypes.ReserveData memory);
}
