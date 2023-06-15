pragma solidity 0.6.8;

interface IManager {
    function deposit() external payable;

    function toStakedCelo(uint256 celoAmount) external view returns (uint256);
    function toCelo(uint256 stCeloAmount) external view returns (uint256);
}