pragma solidity >=0.6.8 <0.8.0;
pragma experimental ABIEncoderV2;

import {PairMentoV2} from "../contracts/swappa/PairMentoV2.sol";
import {Test, console2 as console} from "../lib/forge-std/src/Test.sol";
import {PrecompileHandler} from "./PrecompileHandler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract swapTest is Test {
    PairMentoV2 public mentov2;
    address trader;
    PrecompileHandler public ph;

    event BucketsUpdated(
        bytes32 indexed exchangeId,
        uint256 bucket0,
        uint256 bucket1
    );  
    address public constant CELO_ADDRESS =
        0xdDc9bE57f553fe75752D61606B94CBD7e0264eF8;
    address public constant CUSD_ADDRESS =
        0x62492A644A588FD904270BeD06ad52B9abfEA1aE;
    bytes32 public constant exchangeId =
        bytes32(
            0x3135b662c38265d0655177091f1b647b4fef511103d06c016efdf18b46930d2c
        );

    function setUp() public {
        ph = new PrecompileHandler();
        mentov2 = new PairMentoV2();
        trader = makeAddr("trader");

        vm.deal(address(mentov2), 1 ether);
    }

    function test_swap() public {
        uint256 pairV2CeloBalance = IERC20(CELO_ADDRESS).balanceOf(
            address(mentov2)
        );
        uint256 pairV2CusdBalance = IERC20(CUSD_ADDRESS).balanceOf(
            address(mentov2)
        );

        assertTrue(pairV2CeloBalance == 1 ether);
        assertTrue(pairV2CusdBalance == 0);

        uint256 amountOut = mentov2.getOutputAmount(
            CELO_ADDRESS,
            CUSD_ADDRESS,
            1 ether,
            abi.encodePacked(
                address(0x6723749339e320E1EFcd9f1B0D997ecb45587208),
                address(0xFF9a3da00F42839CD6D33AD7adf50bCc97B41411),
                exchangeId
            )
        );

        mentov2.swap(
            CELO_ADDRESS,
            CUSD_ADDRESS,
            trader,
            abi.encodePacked(
                address(0x6723749339e320E1EFcd9f1B0D997ecb45587208),
                address(0xFF9a3da00F42839CD6D33AD7adf50bCc97B41411),
                exchangeId
            )
        );
        pairV2CeloBalance = IERC20(CELO_ADDRESS).balanceOf(
            address(mentov2)
        );

        uint256 traderV2CusdBalance = IERC20(CUSD_ADDRESS).balanceOf(
            address(trader)
        );
        pairV2CusdBalance = IERC20(CUSD_ADDRESS).balanceOf(
            address(mentov2)
        );
        
        assertTrue(traderV2CusdBalance == amountOut);
        assertEq(pairV2CeloBalance, 0);
        assertEq(pairV2CusdBalance, 0);
    }
    
}
