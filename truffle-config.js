/**
 * More information about configuration can be found at:
 * truffleframework.com/docs/advanced/configuration
 */

module.exports = {
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: "ETH",
      gasPrice: 0.5,
    }
  },

  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.8",
      settings: {
        optimizer: {
          enabled: false,
          // runs: 200,
        },
        evmVersion: "istanbul",
      }
    },
  },
};
