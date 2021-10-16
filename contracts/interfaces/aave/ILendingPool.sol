// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

interface ILendingPool {
	function getReserveData(address _reserve)
		external
		view
		returns (
				uint256 totalLiquidity,
				uint256 availableLiquidity,
				uint256 totalBorrowsStable,
				uint256 totalBorrowsVariable,
				uint256 liquidityRate,
				uint256 variableBorrowRate,
				uint256 stableBorrowRate,
				uint256 averageStableBorrowRate,
				uint256 utilizationRate,
				uint256 liquidityIndex,
				uint256 variableBorrowIndex,
				address aTokenAddress,
				uint40 lastUpdateTimestamp
		);

	function getReserves() external view returns (address[] memory);

	function deposit(address _reserve, uint256 _amount, uint16 _referralCode) external payable;
}
