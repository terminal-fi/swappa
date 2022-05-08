// SPDX-License-Identifier: MIT
pragma solidity >=0.4.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/uniswap/IUniswapV3Pool.sol";
import "../interfaces/uniswap/Quoter.sol";
import "../interfaces/uniswap/SafeCast.sol";
import "../interfaces/uniswap/TickMath.sol";
import "./ISwappaPairV1.sol";

contract PairUniswapV3 is ISwappaPairV1 {
    using SafeMath for uint256;
    using SafeCast for uint256;

    function swap(
        address input,
        address output,
        address to,
        bytes calldata data
    ) external override {
        address pairAddr = parseData(data);
        uint256 inputAmount = ERC20(input).balanceOf(address(this));
        require(
            ERC20(input).transfer(pairAddr, inputAmount),
            "PairUniswapV3: transfer failed!"
        );
        IUniswapV3Pool pair = IUniswapV3Pool(pairAddr);
        bool zeroForOne = pair.token0() == input;
        pair.swap(
            to,
            zeroForOne,
            inputAmount.toInt256(),
            zeroForOne
                ? TickMath.MIN_SQRT_RATIO + 1
                : TickMath.MAX_SQRT_RATIO - 1,
            new bytes(0)
        );
    }

    function parseData(bytes memory data)
        private
        pure
        returns (address pairAddr)
    {
        require(data.length == 20, "PairUniswapV3: invalid data!");
        assembly {
            pairAddr := mload(add(data, 20))
        }
    }

    function getOutputAmount(
        address input,
        address output,
        uint256 amountIn,
        bytes calldata data
    ) external view override returns (uint256 amountOut) {
        address pairAddr = parseData(data);
        IUniswapV3Pool pair = IUniswapV3Pool(pairAddr);
        bool zeroForOne = pair.token0() == input;
        // amount0, amount1 are delta of the pair reserves
        (int256 amount0, int256 amount1) = Quoter.quote(
            pair,
            zeroForOne,
            amountIn.toInt256(),
            zeroForOne
                ? TickMath.MIN_SQRT_RATIO + 1
                : TickMath.MAX_SQRT_RATIO - 1
        );
        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function getInputAmount(
        address input,
        address output,
        uint256 amountOut,
        bytes calldata data
    ) external view returns (uint256 amountIn) {
        address pairAddr = parseData(data);
        IUniswapV3Pool pair = IUniswapV3Pool(pairAddr);
        bool zeroForOne = pair.token0() == input;
        // amount0, amount1 are delta of the pair reserves
        (int256 amount0, int256 amount1) = Quoter.quote(
            pair,
            zeroForOne,
            -amountOut.toInt256(),
            zeroForOne
                ? TickMath.MIN_SQRT_RATIO + 1
                : TickMath.MAX_SQRT_RATIO - 1
        );
        return uint256(zeroForOne ? amount0 : amount1);
    }
}
