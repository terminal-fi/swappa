// SPDX-License-Identifier: GPL-3.0-or-later
pragma experimental ABIEncoderV2;

interface IBiPoolManager {
	function tokenPrecisionMultipliers (address) external view returns (uint256);
}