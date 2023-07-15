pragma solidity 0.6.8;

interface IRebasedStakedCelo {
    function deposit(uint256 stCeloAmount) external;
    function withdraw(uint256 stCeloAmount) external;

    function toStakedCelo(uint256 rstCeloAmount) external view returns (uint256);
    function toRebasedStakedCelo(uint256 stCeloAmount) external view returns (uint256); 
}