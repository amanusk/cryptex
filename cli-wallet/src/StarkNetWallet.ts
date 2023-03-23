//import starkwareCrypto from "@starkware-industries/starkware-crypto-utils";
const starkwareCrypto = require("@starkware-industries/starkware-crypto-utils");

// import starkwareCrypto from "@starkware-industries/starkware-crypto-utils";
import fs from "fs";
import { ensureEnvVar, uint256ToBigNumber, generateRandomStarkPrivateKey, prettyPrintFee } from "./util";
import { Wallet, BigNumber, utils } from "ethers";
import BN from "bn.js";
import { Contract, ec, json, Account, Provider, uint256, ProviderInterface, number, transaction, hash } from "starknet";

import { getStarkPair } from "./keyDerivation";

import * as dotenv from "dotenv";
dotenv.config();

// TODO: calculate this
const ACCOUNT_CLASS_HASH = "0x4d07e40e93398ed3c76981e72dd1fd22557a78ce36c0515f679e27f0bb5bc5f";
const DEFAULT_TOKEN_ADDRESS = "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

export class StarkNetWallet {
  public account: Account;

  constructor(privateKey: string, provider: ProviderInterface, address?: string) {
    if (address == undefined) {
      address = StarkNetWallet.computeAddressFromPk(privateKey);
    }
    this.account = StarkNetWallet.getAccountFromPk(address, privateKey, provider);
    return;
  }

  getAddress() {
    return this.account.address;
  }

  static computeAddressFromMnemonic(mnemonic: string, index = 0): string {
    const starkKeyPair = getStarkPair(mnemonic, index);
    let starkKeyPub = ec.getStarkKey(starkKeyPair);
    return hash.calculateContractAddressFromHash(starkKeyPub, ACCOUNT_CLASS_HASH, [starkKeyPub], 0);
  }

  static computeAddressFromPk(pk: string): string {
    const starkKeyPair = ec.getKeyPair(pk);
    let starkKeyPub = ec.getStarkKey(starkKeyPair);
    return hash.calculateContractAddressFromHash(starkKeyPub, ACCOUNT_CLASS_HASH, [starkKeyPub], 0);
  }

  static getAccountFromPk(address: string, pk: string, provider: ProviderInterface): Account {
    const starkKeyPair = ec.getKeyPair(pk);
    let account = new Account(provider, address, starkKeyPair);
    return account;
  }

  static fromMnemonic(
    mnemonic: string,
    index: number = 0,
    provider: ProviderInterface,
    address?: string,
  ): StarkNetWallet {
    if (address == undefined) {
      address = StarkNetWallet.computeAddressFromMnemonic(mnemonic, index);
    }
    let newWallet = new StarkNetWallet("0x01", provider);
    let account = StarkNetWallet.getAccountFromMnemonic(address, mnemonic, index, provider);
    newWallet.account = account;
    return newWallet;
  }

  static getAccountFromMnemonic(
    address: string,
    mnemonic: string,
    index: number = 0,
    provider: ProviderInterface,
  ): Account {
    const starkKeyPair = getStarkPair(mnemonic, index);
    let account = new Account(provider, address, starkKeyPair);
    return account;
  }

  async getBalance(tokenAddress?: string) {
    return StarkNetWallet.getBalance(this.account.address, this.account, tokenAddress);
  }

  static async getBalance(address: string, provider: ProviderInterface, tokenAddress?: string): Promise<BigNumber> {
    if (tokenAddress == null) {
      tokenAddress = DEFAULT_TOKEN_ADDRESS;
    }
    const erc20ABI = json.parse(fs.readFileSync("./src/interfaces/ERC20_abi.json").toString("ascii"));
    const erc20 = new Contract(erc20ABI, tokenAddress, provider);
    const balance = await erc20.balanceOf(address);
    let balanceBigNumber = uint256ToBigNumber(balance.balance);
    return balanceBigNumber;
  }

  // NOTICE: this method will be deprecated once DEPLOY is not working

  static async deployPrefundedAccount(
    address: string,
    mnemonic: string,
    provider: ProviderInterface,
  ): Promise<Account> {
    // Deploy the Account contract and wait for it to be verified on StarkNet.
    console.log("Deployment Tx - Account Contract to StarkNet...");

    let starkKeyPair = getStarkPair(mnemonic, 0);

    let starkKeyPub = ec.getStarkKey(starkKeyPair);

    let futureAccountAddress = hash.calculateContractAddressFromHash(starkKeyPub, ACCOUNT_CLASS_HASH, [starkKeyPub], 0);

    console.log("Future Account Address", futureAccountAddress);

    let futureAccount = new Account(provider, futureAccountAddress, starkKeyPair);

    let estimateFee = await futureAccount.estimateAccountDeployFee({
      classHash: ACCOUNT_CLASS_HASH,
      constructorCalldata: [starkKeyPub],
      addressSalt: starkKeyPub,
      contractAddress: futureAccountAddress,
    });
    prettyPrintFee(estimateFee);

    let accountResponse = await futureAccount.deployAccount({
      classHash: ACCOUNT_CLASS_HASH,
      constructorCalldata: [starkKeyPub],
      addressSalt: starkKeyPub,
      contractAddress: futureAccountAddress,
    });

    // Wait for the deployment transaction to be accepted on StarkNet
    console.log(
      "Waiting for Tx " + accountResponse.transaction_hash + " to be Accepted on Starknet - OZ Account Deployment...",
    );

    return futureAccount;
  }

  static generateSeed() {
    console.log("THIS IS A NEW ACCOUNT. Please fill in the MNEMONIC field in the .env file");
    let wallet = Wallet.createRandom();
    let mnemonic = wallet.mnemonic;
    console.log("12-word seed: " + mnemonic.phrase);
    return mnemonic.phrase;
  }

  static generatePk(): BigNumber {
    let pk = generateRandomStarkPrivateKey();
    console.log("PK generated", pk);
    return pk;
  }

  async transfer(recipientAddress: string, amount: BigNumber, tokenAddress?: string, decimals: number = 18) {
    if (tokenAddress == null) {
      tokenAddress = DEFAULT_TOKEN_ADDRESS;
    }

    const erc20ABI = json.parse(fs.readFileSync("./src/interfaces/ERC20_abi.json").toString("ascii"));
    const erc20 = new Contract(erc20ABI, tokenAddress, this.account);

    const transferAmount = new BN(amount.toString());
    let uint256Amount = uint256.bnToUint256(transferAmount);

    let estimateFee = await this.account.estimateInvokeFee({
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
    });
    prettyPrintFee(estimateFee);

    // alternatively execute by calling the account execute function
    const { transaction_hash: transferTxHash } = await this.account.execute(
      {
        contractAddress: tokenAddress,
        entrypoint: "transfer",
        calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
      },
      undefined, // abi
      { maxFee: estimateFee.suggestedMaxFee },
    );
    console.log("Awaiting tx ", transferTxHash);
    await this.account.waitForTransaction(transferTxHash);
    console.log("Tx mined ", transferTxHash);
  }

  async sign_transaction(recipientAddress: string, amount: BigNumber, tokenAddress?: string, decimals: number = 18) {
    if (tokenAddress == null) {
      tokenAddress = DEFAULT_TOKEN_ADDRESS;
    }

    const erc20ABI = json.parse(fs.readFileSync("./src/interfaces/ERC20_abi.json").toString("ascii"));
    const erc20 = new Contract(erc20ABI, tokenAddress, this.account);

    const transferAmount = new BN(amount.toString());
    let uint256Amount = uint256.bnToUint256(transferAmount);

    // let walletAddress = "0x53c615080d35defd55569488bc48c1a91d82f2d2ce6199463e095b4a4ead551";
    // let walletAddress = this.account.address;
    let accountAddress = "0x04a78bbf563a976190811d6cc4ebf15f8cb41c9e0305518b8cac1c1f99f45086";

    // console.log("WalletAddress", accountAddress);
    // console.log("Address", this.account.address);
    // console.log("Public key", await this.account.signer.getPubKey());

    // let estimateFee = await this.account.estimateInvokeFee({
    //   contractAddress: tokenAddress,
    //   entrypoint: "transfer",
    //   calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
    // });
    // prettyPrintFee(estimateFee);
    const privateKey = "0xe3e70682c2094cac629f6fbed82c07cd".substring(2);
    const keyPair = starkwareCrypto.ec.keyFromPrivate(privateKey, "hex");
    const publicKey = starkwareCrypto.ec.keyFromPublic(keyPair.getPublic(true, "hex"), "hex");
    // console.log("privateKey", privateKey);
    const publicKeyX = publicKey.pub.getX();
    console.log("publicKey", publicKeyX.toString(16));

    let nonce = 0;
    let chainId = await this.account.getChainId();
    const version = 1;
    // const maxFee = estimateFee.suggestedMaxFee;
    const maxFee = 0;

    let invocation = {
      contractAddress: tokenAddress,
      entrypoint: "transfer",
      calldata: [recipientAddress, uint256Amount.low, uint256Amount.high],
    };
    //
    // let calldata = [
    //   1,
    //   0x06d183efadf1b91592d21a93db338489a1f78df3aa0a8bc86420511e01e70425,
    // ]

    const call_data = ["0x03086e3f7d0a718bfc403b5161c15ff21433d22cfb82e1fa1dd5ad5d35c531cd", 1, 1];
    const account_call_data = [
      1,
      "0x06d183efadf1b91592d21a93db338489a1f78df3aa0a8bc86420511e01e70425",
      "0x0083afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
      call_data.length,
      ...call_data,
    ];

    const msgHash = hash.calculateTransactionHash(accountAddress, 1, account_call_data, maxFee, chainId, nonce);
    console.log("Message hash", msgHash);

    const msgSignature = starkwareCrypto.sign(keyPair, msgHash.substring(2));
    const { r, s } = msgSignature;

    // const calldata = transaction.fromCallsToExecuteCalldata([invocation]);
    console.log("accountAddress", accountAddress);
    console.log("Calldata", account_call_data);
    console.log("Signature", [r.toString(16), s.toString(16)]);
    console.log("maxFee", maxFee);
    console.log("chainId", chainId);
    console.log("nonce", nonce);

    // let res = await this.account.invokeFunction(
    //   { contractAddress: this.account.address, calldata: account_call_data, signature },
    //   {
    //     nonce,
    //     maxFee,
    //     version,
    //   },
    // );
    // console.log("Result", res);
  }

  async init_tx(txHash: string, sig_r: string, sig_s: string) {}

  async deployNewContract(classHash: string, constructorArgs: string[]) {
    // TODO: compute account deploy address
    const { transaction_hash: txHash } = await this.account.deploy({
      classHash: classHash,
      salt: "",
      unique: false,
      constructorCalldata: this.toRawCallData(constructorArgs),
    });

    console.log("Awaiting tx ", txHash);
    await this.account.waitForTransaction(txHash);
    console.log("Tx mined ", txHash);
  }

  async declareNewContract(filename: string, classHash: string) {
    const compiledContract = json.parse(fs.readFileSync(filename).toString("ascii"));

    let estimateFee = await this.account.estimateDeclareFee({
      contract: compiledContract,
      classHash: classHash, // Currently can only be got with python
    });
    prettyPrintFee(estimateFee);

    const { transaction_hash: txHash } = await this.account.declare({
      contract: compiledContract,
      classHash: classHash, // Currently can only be got with python
    });

    console.log("Awaiting tx ", txHash);
    await this.account.waitForTransaction(txHash);
    console.log("Tx mined ", txHash);
  }

  async invoke(contractAddress: string, selector: string, calldata: string[]) {
    let call = {
      contractAddress: contractAddress,
      entrypoint: selector,
      calldata: this.toRawCallData(calldata),
    };

    console.log("Call", call);

    let estimateFee = await this.account.estimateInvokeFee(call);
    prettyPrintFee(estimateFee);

    // alternatively execute by calling the account execute function
    const { transaction_hash: transferTxHash } = await this.account.execute(
      call,
      undefined, // abi
      { maxFee: estimateFee.suggestedMaxFee },
    );
    console.log("Awaiting tx ", transferTxHash);
    await this.account.waitForTransaction(transferTxHash);
    console.log("Tx mined ", transferTxHash);
  }

  async call(contractAddress: string, selector: string, calldata: string[]) {
    let result = await this.account.callContract({
      contractAddress: contractAddress,
      entrypoint: selector,
      calldata: this.toRawCallData(calldata),
    });
    console.log("Result", result);
  }

  toRawCallData(calldata: string[]): string[] {
    let rawCallData = new Array<string>();

    for (let c of calldata) {
      rawCallData.push(BigNumber.from(c).toString());
    }
    return rawCallData;
  }
}
