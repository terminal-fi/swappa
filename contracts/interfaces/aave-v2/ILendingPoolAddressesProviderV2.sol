// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ILendingPoolAddressesProviderV2 {
  function getLendingPool() external view returns (address);
}
