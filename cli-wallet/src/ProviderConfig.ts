import { SequencerProvider, ProviderInterface, constants } from "starknet";

export type NetworkName = "goerli-alpha" | "mainnet-alpha";

function getNetworkConfig(): NetworkName {
  if (process.env.NETWORK == "mainnet" || process.env.NETWORK == "mainnet-alpha") {
    return "mainnet-alpha";
  } else {
    return "goerli-alpha";
  }
}

export function getProvider(): ProviderInterface {
  // if (process.env.RPC_URL != undefined) {
  //   console.log(`Using RPC with URL ${process.env.RPC_URL}`);
  //   return new SequencerProvider({
  //     baseUrl: `${process.env.RPC_URL}`,
  //   });
  // }
  // if (process.env.NETWORK == "devnet") {
  //   let baseUrl = "http://localhost:5050";
  //   console.log(`Using DEVNET with URL ${baseUrl}`);
  //   return new SequencerProvider({
  //     baseUrl: `${baseUrl}`,
  //   });
  // }
  // let network = getNetworkConfig();
  // return new SequencerProvider({ network: network });
  return new SequencerProvider({
    baseUrl: "http://192.168.2.31:49158/",
    // feederGatewayUrl: "http://192.168.2.31:49156/",
    gatewayUrl: "http://192.168.2.31:49158/",
    chainId: constants.StarknetChainId.TESTNET,
  });
}

// export STARKNET_GATEWAY_URL=http://192.168.2.31:49156/
// export STARKNET_FEEDER_GATEWAY_URL=http://192.168.2.31:49158/
// export STARKNET_INTERNAL_GATEWAY_URL=http://192.168.2.31:49155/
// export STARKNET_NETWORK_ID=test221521043
// export STARKNET_WALLET=starkware.starknet.wallets.open_zeppelin.OpenZeppelinAccount
// export STARKNET_CHAIN_ID=0x534e5f474f45524c49
