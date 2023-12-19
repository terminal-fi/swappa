// SPDX-License-Identifier: GPL-3.0-or-later
pragma experimental ABIEncoderV2;

interface IBroker {
	function reserve () external view returns (address);
}