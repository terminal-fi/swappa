import Web3V1Celo from '@celo/typechain-target-web3-v1-celo'
import { execSync } from 'child_process'
import path from 'path'
import { tsGenerator } from 'ts-generator'

const ROOT_DIR = path.normalize(path.join(__dirname, '../'))

async function generateContractTypes() {
  console.log('contractkit: Generating Types')
	const typesDir = path.join("types", "web3-v1-contracts")
  execSync(`rm -rf ${typesDir}`, {cwd: ROOT_DIR})
  const web3Generator = new Web3V1Celo({
    cwd: ROOT_DIR,
    rawConfig: {
      files: `${ROOT_DIR}/build/contracts/*.json`,
      outDir: typesDir,
    },
  })

  await tsGenerator({ cwd: ROOT_DIR, loggingLvl: 'info' }, web3Generator)
  // HAX: remove `receive` functions from ABI because web3 doesn't recognize them.
  const extraFlag = process.platform === "darwin" ? "''" : ""
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "SwappaRouterV1.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairUniswapV2.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairMento.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairAToken.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairStableSwap.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairSavingsCELO.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairATokenV2.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairStCelo.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairRStCelo.ts")}`, {cwd: ROOT_DIR})
  execSync(`sed -e '/type\:\ \"receive\"/d' -i ${extraFlag} ${path.join(typesDir, "PairMentoV2.ts")}`, {cwd: ROOT_DIR})
}

generateContractTypes()
.catch((err) => {
  console.error(err)
  process.exit(1)
})