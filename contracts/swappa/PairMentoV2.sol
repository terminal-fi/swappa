// SPDX-License-Identifier: MIT
pragma solidity 0.6.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ISwappaPairV1.sol";

interface IBroker {
    function swapIn(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut);

    function getAmountOut(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}

contract PairMentoV2 is ISwappaPairV1 {
    function swap(
        address input,
        address output,
        address to,
        bytes calldata data
    ) external override {
        (
            address _broker,
            address exchangeProvider,
            bytes32 exchangeId
        ) = parseData(data);
        uint inputAmount = ERC20(input).balanceOf(address(this));
        require(
            ERC20(input).approve(_broker, inputAmount),
            "PairMentoV2: approve failed!"
        );
        IBroker broker = IBroker(_broker);
        require(
            broker.swapIn(
                exchangeProvider,
                exchangeId,
                input,
                output,
                inputAmount,
                0
            ) > 0,
            "PairMentoV2: swap failed!"
        );
    }

    function parseData(
        bytes memory data
    )
        public
        pure
        returns (address broker, address exchangeProvider, bytes32 exchangeId)
    {
        require(data.length == 72, "PairMentoV2: invalid data!");
        assembly {
            broker := mload(add(data, 20))
            exchangeProvider := mload(add(data, 40))
            exchangeId := mload(add(data, 72))
        }
    }

    function getOutputAmount(
        address input,
        address output,
        uint256 amountIn,
        bytes calldata data
    ) external view override returns (uint amountOut) {
        (
            address _broker,
            address exchangeProvider,
            bytes32 exchangeId
        ) = parseData(data);
        IBroker broker = IBroker(_broker);
        return
            broker.getAmountOut(
                exchangeProvider,
                exchangeId,
                input,
                output,
                amountIn
            );
    }

    receive() external payable {}
}