#!/usr/bin/env node
import { program } from "commander";
import fs from "fs";
import path from "path";
import { ContractKit, newKit } from "@celo/contractkit";

import SwappaRouterV1Json from "../build/contracts/SwappaRouterV1.json";
import PairUniswapV2 from "../build/contracts/PairUniswapV2.json";
import PairMento from "../build/contracts/PairMento.json";
import PairAToken from "../build/contracts/PairAToken.json";
import PairStableSwap from "../build/contracts/PairStableSwap.json";
import PairSavingsCELO from "../build/contracts/PairSavingsCELO.json";
import PairATokenV2 from "../build/contracts/PairATokenV2.json";

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
  .option("--from <address>", "Deployer address")
  .parse();

const networks: { [key: string]: string } = {
  // "ganache": "http://127.0.0.1:7545",
  // "alfajores": "https://alfajores-forno.celo-testnet.org",
  baklava: "http://127.0.0.1:8546",
  mainnet: "http://127.0.0.1:8545",
};

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
  kit: ContractKit,
  network: string,
  contractName: string,
  contractData: string
) {
  let address = contractAddress(network, contractName);
  if (!address) {
    console.info("DEPLOYING:", contractName, "...");
    const receipt = await (
      await kit.sendTransaction({ data: contractData })
    ).waitReceipt();
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

  const kit = newKit(networkURL);
  kit.defaultAccount = opts.from;

  await readAddressOrDeployContract(
    kit,
    opts.network,
    "SwappaRouterV1",
    SwappaRouterV1Json.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairUniswapV2",
    PairUniswapV2.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairMento",
    PairMento.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairAToken",
    PairAToken.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairStableSwap",
    PairStableSwap.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairSavingsCELO",
    PairSavingsCELO.bytecode
  );
  await readAddressOrDeployContract(
    kit,
    opts.network,
    "PairATokenV2",
    PairATokenV2.bytecode
  );
}

main();
