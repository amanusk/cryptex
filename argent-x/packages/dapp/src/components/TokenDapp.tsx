const starkwareCrypto = require("@starkware-industries/starkware-crypto-utils");
import { SessionAccount, createSession } from "@argent/x-sessions"
import { FC, useEffect, useState } from "react"
import { Abi, AccountInterface, Contract, ec, transaction, uint256 } from "starknet"
import BN from "bn.js";
import { hash } from "starknet5"
import Button from '@mui/material/Button';
import Erc20Abi from "../../abi/ERC20.json"
import { truncateAddress, truncateHex } from "../services/address.service"
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  getErc20TokenAddress,
  mintToken,
  parseInputAmountToUint256,
  transfer,
} from "../services/token.service"
import {
  addToken,
  declare,
  getExplorerBaseUrl,
  networkId,
  signMessage,
  waitForTransaction,
} from "../services/wallet.service"
import styles from "../styles/Home.module.css"
import { Box, Divider, List, ListItem, ListItemButton, ListItemText, Paper, Stack, styled } from "@mui/material";
import { getStarknet } from "@argent/get-starknet/dist";
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation'
import SecurityUpdateGoodIcon from '@mui/icons-material/SecurityUpdateGood'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

// const privateKey = "0xe3e70682c2094cac629f6fbed82c07cd".substring(2);
// const keyPair = starkwareCrypto.ec.keyFromPrivate(privateKey, "hex");
// const user = "0x" + keyPair.getPublic(true, "hex").substring(2);
// const publicKey = starkwareCrypto.ec.keyFromPublic(keyPair.getPublic(true, "hex"), "hex");
let accountAddress = "0x003e08f78f80e13b5496357d74f1dfa135f7ccb69838595e5990b7d84c4fba6b";

const { genKeyPair, getStarkKey } = ec

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

type Status = "idle" | "approve" | "pending" | "success" | "failure"

const readFileAsString = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        return resolve(reader.result?.toString())
      }
      return reject(new Error("Could not read file"))
    }
    reader.onerror = reject
    reader.onabort = reject.bind(null, new Error("User aborted"))
    reader.readAsText(file)
  })
}

export const TokenDapp: FC<{
  showSession: null | boolean
  account: AccountInterface
}> = ({ showSession, account }) => {
  const [mintAmount, setMintAmount] = useState("10")
  const [transferFrom, setTransferFrom] = useState(accountAddress)
  const [transferTo, setTransferTo] = useState(accountAddress)
  const [transferAmount, setTransferAmount] = useState("1")
  const [nonce, setNonce] = useState("1")
  const [privateKey, setPrivateKey] = useState("0xe3e70682c2094cac629f6fbed82c07cd")
  const [allTxs, setAllTxs] = useState<string[]>([])
  const [currentTx, setCurrentTx] = useState<string | undefined>(undefined)
  const [lastTransactionHash, setLastTransactionHash] = useState("")
  const [transactionStatus, setTransactionStatus] = useState<Status>("idle")
  const [transactionError, setTransactionError] = useState("")
  const [addTokenError, setAddTokenError] = useState("")
  const [classHash, setClassHash] = useState("")
  const [contract, setContract] = useState<string | undefined>()

  const [sessionSigner] = useState(genKeyPair())
  const [sessionAccount, setSessionAccount] = useState<
    SessionAccount | undefined
  >()

  const buttonsDisabled = ["approve", "pending"].includes(transactionStatus)

  useEffect(() => {
    ;(async () => {
      if (lastTransactionHash && transactionStatus === "pending") {
        setTransactionError("")
        try {
          await waitForTransaction(lastTransactionHash)
          setTransactionStatus("success")
        } catch (error: any) {
          setTransactionStatus("failure")
          let message = error ? `${error}` : "No further details"
          if (error?.response) {
            message = JSON.stringify(error.response, null, 2)
          }
          setTransactionError(message)
        }
      }
    })()
  }, [transactionStatus, lastTransactionHash])

  useEffect(() => {
    const keyPair = starkwareCrypto.ec.keyFromPrivate(privateKey, "hex");
    const user = "0x" + keyPair.getPublic(true, "hex").substring(2);
    const interval = setInterval(() => {
      fetch("http://192.168.1.165:8080/get_pending_txs?user=" + user ).then((response) => {
        response.json().then((txs) => setAllTxs(txs))
      }).catch((err) => {})
    }, 2000)
    return () => clearInterval(interval);
  }, [privateKey])

  const network = networkId()
  if (network !== "goerli-alpha" && network !== "mainnet-alpha") {
    return (
      <>
        <p>
          There is no demo token for this network, but you can deploy one and
          add its address to this file:
        </p>
        <div>
          <pre>packages/dapp/src/token.service.ts</pre>
        </div>
      </>
    )
  }

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setTransactionStatus("approve")

      console.log("mint", mintAmount)
      const result = await mintToken(mintAmount, network)
      console.log(result)

      setLastTransactionHash(result.transaction_hash)
      setTransactionStatus("pending")
    } catch (e) {
      console.error(e)
      setTransactionStatus("idle")
    }
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    
    try {

      let starknet = getStarknet();
      const erc20Contract = new Contract(
        Erc20Abi as any,
        getErc20TokenAddress(network),
        starknet.account as any,
      )
      let uint256Amount = uint256.bnToUint256(new BN(transferAmount.toString()));
      let walletAddress = transferFrom;
      const version = 1;
      const maxFee=10000000000000000;
      let invocation = {
        contractAddress: tokenAddress,
        entrypoint: "transfer",
        calldata: [transferTo, uint256Amount.low, uint256Amount.high],
      };
      const calldata = transaction.fromCallsToExecuteCalldata([invocation]);
      const account_call_data = [
        1,
        "0x04e18fb53858141dc03cc3f6fe9cc8041f44b87f59104da9373111793cba3e31",
        "0x0083afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
        calldata.length,
        ...calldata,
      ];
      const data = {
        name:"Transfer " + transferAmount + " to " + transferTo,
        address:walletAddress,
        calldata:account_call_data,
        max_fee:maxFee,
        nonce:nonce
      }
      fetch("http://192.168.1.165:8080/init_tx",{
        method: 'POST',
        body: JSON.stringify(data)
      })
    } catch (e) {
      console.error(e)
      setTransactionStatus("idle")
    }
  }

  const handleSignSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault()
      setTransactionStatus("approve")

      let chainId = await starknet.account.getChainId();

      // const account_call_data = [
      //   1,
      //   "0x06d183efadf1b91592d21a93db338489a1f78df3aa0a8bc86420511e01e70425",
      //   "0x0083afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
      //   currentTx.calldata.length,
      //   ...currentTx.calldata,
      // ];
      const msgHash = hash.calculateTransactionHash(accountAddress, 1, currentTx.calldata, currentTx.max_fee, chainId, currentTx.nonce);
      console.log("AA", accountAddress, 1, currentTx.calldata, currentTx.max_fee, chainId, currentTx.nonce)

      const keyPair = starkwareCrypto.ec.keyFromPrivate(privateKey, "hex");
      const user = "0x" + keyPair.getPublic(true, "hex").substring(2);

      const {r,s} = starkwareCrypto.sign(keyPair, msgHash.substring(2));

      let data = {
        tx_hash: msgHash,
        user: user,
        signature:["0x" + r.toString(16),"0x" + s.toString(16)]
      };
      let res = await fetch("http://192.168.1.165:8080/add_signature", {
        method: 'POST',
        body: JSON.stringify(data)
      });
      console.log(res)
      
      setTransactionStatus("success")
      setCurrentTx(undefined)
    } catch (e) {
      console.error(e)
      setTransactionStatus("idle")
    }
  }

  const handleOpenSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const signedSession = await createSession(
      {
        key: getStarkKey(sessionSigner),
        expires: Math.floor((Date.now() + 1000 * 60 * 60 * 24) / 1000), // 1 day in seconds
        policies: [
          {
            contractAddress: getErc20TokenAddress(network),
            selector: "transfer",
          },
        ],
      },
      account,
    )

    setSessionAccount(
      new SessionAccount(
        account,
        account.address,
        sessionSigner,
        signedSession,
      ),
    )
  }

  const handleSessionTransactionSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault()
      if (!sessionAccount) {
        throw new Error("No open session")
      }
      const erc20Contract = new Contract(
        Erc20Abi as Abi,
        getErc20TokenAddress(network),
        sessionAccount,
      )

      const result = await erc20Contract.transfer(
        account.address,
        parseInputAmountToUint256("0.000000001"),
      )
      console.log(result)

      setLastTransactionHash(result.transaction_hash)
      setTransactionStatus("pending")
    } catch (e) {
      console.error(e)
      setTransactionStatus("idle")
    }
  }

  // const handleDeclare = async (e: React.FormEvent) => {
  //   try {
  //     e.preventDefault()
  //     if (!contract) {
  //       throw new Error("No contract")
  //     }
  //     if (!classHash) {
  //       throw new Error("No class hash")
  //     }
  //     const result = await declare(contract, classHash)
  //     console.log(result)

  //     setLastTransactionHash(result.transaction_hash)
  //     setTransactionStatus("pending")
  //   } catch (e) {
  //     console.error(e)
  //     setTransactionStatus("idle")
  //   }
  // }

  const handleTxClick = async (e: React.FormEvent, tx: any) => {
    setCurrentTx(tx)
  }

  const tokenAddress = getErc20TokenAddress(network as any)
  
  const style = {
    width: '100%',
    maxWidth: 360,
    bgcolor: 'background.paper',
  };

  // var img = document.createElement("img")
  // img.src = "cryptex-low-resolution-logo-color-on-transparent-background.png"
  // var src = document.getElementById("image")
  // src.appendChild(img)
  
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {/* <div id="image"></div> */}
      {/* <h3 style={{ margin: 0 }}>
        Wallet address: <code>{publicKey}</code>
      </h3> */}
      <label htmlFor="private-key">Private Key</label>
      <input
          type="text"
          id="private-key"
          name="fname"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
        />
      {lastTransactionHash && (
        <h3 style={{ margin: 0 }}>
          Transaction hash:{" "}
          <a
            href={`${getExplorerBaseUrl()}/tx/${lastTransactionHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "blue", margin: "0 0 1em" }}
          >
            <code>{truncateHex(lastTransactionHash)}</code>
          </a>
        </h3>
      )}
      {transactionError && (
        <h3 style={{ margin: 0 }}>
          Transaction error:{" "}
          <textarea
            style={{ width: "100%", height: 100, background: "white" }}
            value={transactionError}
            readOnly
          />
        </h3>
      )}
      <div className="columns">
        <form>
          <h2 className={styles.title}>Sign Awaiting Txs  <SecurityUpdateGoodIcon></SecurityUpdateGoodIcon></h2>
          <Box sx={{ width: '100%' }}>
            <Stack spacing={2}>
            {allTxs.map((tx, i) =>
            <Item key={"tx" + i.toString()} sx={{fontSize:30, backgroundColor:tx==currentTx?"#dddddd":"#ffffff",color: 'black'}} onClick={(e) => handleTxClick(e,tx)}>{tx.name}</Item>)}
            </Stack>
          </Box>

          {currentTx ? [
            <label htmlFor="mint-amount">Name</label>,
            <p>{currentTx.name}</p>,
            <label htmlFor="mint-amount">data</label>,
            <p>{JSON.stringify(currentTx)}</p>
          ] : []}
          { currentTx ? [<Button variant="contained" onClick={handleSignSubmit}>Sign</Button>] : [] }
        </form>
        
      </div>
      <div className="columns">
        

        <form>
          <h2 className={styles.title}>Transfer token <TransferWithinAStationIcon></TransferWithinAStationIcon></h2>
            

          <label htmlFor="transfer-from">From</label>
          <input
            type="text"
            id="transfer-from"
            name="fname"
            value={transferFrom}
            onChange={(e) => setTransferFrom(e.target.value)}
          />

          <label htmlFor="transfer-to">To</label>
          <input
            type="text"
            id="transfer-to"
            name="fname"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
          />

          <label htmlFor="transfer-amount">Amount</label>
          <input
            type="text"
            id="transfer-amount"
            name="fname"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
          />

          <label htmlFor="nonce">Nonce</label>
          <input
            type="text"
            id="transfer-nonce"
            name="fname"
            value={nonce}
            onChange={(e) => setNonce(e.target.value)}
          />
          <br />
          <Button variant="contained" onClick={handleTransferSubmit}>Transfer</Button>
        </form>
      </div>

      {showSession && (
        <div className="columns">
          <form onSubmit={handleOpenSessionSubmit}>
            <h2 className={styles.title}>Sessions</h2>

            <p>
              Random session signer:{" "}
              <code>{truncateHex(getStarkKey(sessionSigner))}</code>
            </p>

            <input
              type="submit"
              value="Open session"
              disabled={Boolean(sessionAccount)}
            />
          </form>
          <form onSubmit={handleSessionTransactionSubmit}>
            <h2 className={styles.title}>Open session</h2>

            <p>Send some ETH to yourself using the session!</p>

            <input
              type="submit"
              value="Use session"
              disabled={Boolean(!sessionAccount) || buttonsDisabled}
            />
          </form>
        </div>
      )}
  </ThemeProvider>
  )
}
