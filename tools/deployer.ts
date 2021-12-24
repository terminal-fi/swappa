#!/usr/bin/env node
import * as dotenv from "dotenv";
import { program } from "commander";
import fs from "fs";
import path from "path";
import Web3 from "web3";

import SwappaRouterV1Json from "../build/contracts/SwappaRouterV1.json";
import PairUniswapV2 from "../build/contracts/PairUniswapV2.json";
import PairMento from "../build/contracts/PairMento.json";
import PairAToken from "../build/contracts/PairAToken.json";
import PairStableSwap from "../build/contracts/PairStableSwap.json";
import PairSavingsCELO from "../build/contracts/PairSavingsCELO.json";
import PairATokenV2 from "../build/contracts/PairATokenV2.json";

dotenv.config();

process.on("unhandledRejection", (reason, _promise) => {
  // @ts-ignore
  console.error("Unhandled Rejection at:", reason.stack || reason);
  process.exit(0);
});

program
  .option(
    "-n --network <name>",
    "Network to deploy to. Options: ganache, alfajores, baklava, mainnet",
    "ganache"
  )
  .parse();

const networks: { [key: string]: string } = {
  ganache: "http://127.0.0.1:7545",
  alfajores: "https://alfajores-forno.celo-testnet.org",
  baklava: "http://127.0.0.1:8546",
  mainnet: "http://127.0.0.1:8545",
};

let from: string;

// Relative path to the deploy folder changes depending on if it is run directly or using ts-node.
const contractsPath = path.join(__dirname, "deployed");

function contractAddress(network: string, contractName: string) {
  const fpath = path.join(
    contractsPath,
    `${network}.${contractName}.addr.json`
  );
  if (!fs.existsSync(fpath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(fpath).toString());
  return data.address;
}

function storeContractAddress(
  network: string,
  contractName: string,
  contractAddress: string
) {
  fs.writeFileSync(
    path.join(contractsPath, `${network}.${contractName}.addr.json`),
    JSON.stringify({ address: contractAddress })
  );
}

async function readAddressOrDeployContract(
  web3: Web3,
  network: string,
  contractName: string,
  contractData: string
) {
  let address = contractAddress(network, contractName);
  if (!address) {
    console.info("DEPLOYING:", contractName, "...");
    const gasPrice = await web3.eth.getGasPrice();
    const params = {
      data: contractData,
      gasPrice,
      from,
    };
    const gas = await web3.eth.estimateGas(params);
    const receipt = await web3.eth.sendTransaction({ ...params, gas });
    address = receipt.contractAddress;
    if (!address) {
      throw new Error("Contract address not found?");
    }
    storeContractAddress(network, contractName, address);
  }
  console.info("DEPLOYED:", contractName, "ADDRESS:", address);
  return address;
}

async function main() {
  const opts = program.opts();
  const networkURL = networks[opts.network];
  if (!networkURL) {
    throw new Error(`Unsupported network: ${opts.network}`);
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error("User has not specified a PRIVATE_KEY in .env");
  }

  const web3 = new Web3(networkURL);
  const { address } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);
  from = address;

  await readAddressOrDeployContract(
    web3,
    opts.network,
    "SwappaRouterV1",
    SwappaRouterV1Json.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairUniswapV2",
    PairUniswapV2.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairMento",
    PairMento.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairAToken",
    PairAToken.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairStableSwap",
    PairStableSwap.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairSavingsCELO",
    PairSavingsCELO.bytecode
  );
  await readAddressOrDeployContract(
    web3,
    opts.network,
    "PairATokenV2",
    PairATokenV2.bytecode
  );
}

main();
