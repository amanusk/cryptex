import { SessionAccount, createSession } from "@argent/x-sessions"
import { FC, useEffect, useState } from "react"
import { Abi, AccountInterface, Contract, ec } from "starknet"
import { hash } from "starknet5"
import Button from '@mui/material/Button';
import Erc20Abi from "../../abi/ERC20.json"
import { truncateAddress, truncateHex } from "../services/address.service"
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
  const [transferTo, setTransferTo] = useState("")
  const [transferAmount, setTransferAmount] = useState("1")
  const [shortText, setShortText] = useState("")
  const [allTxs, setAllTxs] = useState<string[]>(["1", "2", "3"])
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
    const interval = setInterval(() => {
      fetch("http://192.168.1.165:8080/get_pending_txs?user=" + getStarkKey(sessionSigner), ).then((response) => {
        response.json().then((txs) => setAllTxs(txs))
      }).catch((err) => {})
    }, 2000)
    return () => clearInterval(interval);
  })

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
      e.preventDefault()
      setTransactionStatus("approve")

      console.log("transfer", { transferTo, transferAmount })
      const result = await transfer(transferTo, transferAmount, network)
      console.log(result)

      setLastTransactionHash(result.transaction_hash)
      setTransactionStatus("pending")
    } catch (e) {
      console.error(e)
      setTransactionStatus("idle")
    }
  }

  const handleSignSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault()
      setTransactionStatus("approve")

      console.log("sign", shortText)
      const result = await signMessage(shortText)
      console.log(result)

      let data = {
        tx_hash: currentTx,
        user: getStarkKey(sessionSigner),
        signature: result
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

  return (
    <>
      <h3 style={{ margin: 0 }}>
        Transaction status: <code>{transactionStatus}</code>
      </h3>
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
          <h2 className={styles.title}>Sign Awaiting Txs</h2>
          <Box sx={{ width: '100%' }}>
            <Stack spacing={2}>
            {allTxs.map(tx =>
            <Item sx={{fontSize:30, backgroundColor:tx==currentTx?"#dddddd":"#ffffff"}} onClick={(e) => handleTxClick(e,tx)}>{tx}</Item>)}
            </Stack>
          </Box>

          <label htmlFor="mint-amount">Current tx</label>
          <p>{currentTx}</p>
          { currentTx ? [<Button variant="contained" onClick={handleSignSubmit}>Sign</Button>] : [] }
        </form>
        
      </div>
      <div className="columns">
        

        <form onSubmit={handleTransferSubmit}>
          <h2 className={styles.title}>Transfer token</h2>

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
          <br />
          <input type="submit" disabled={buttonsDisabled} value="Transfer" />
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

      <h3 style={{ margin: 0 }}>
        ETH token address
        <button
          className="flat"
          style={{ marginLeft: ".6em" }}
          onClick={async () => {
            try {
              await addToken(tokenAddress)
              setAddTokenError("")
            } catch (error: any) {
              setAddTokenError(error.message)
            }
          }}
        >
          Add to wallet
        </button>
        <br />
        <code>
          <a
            target="_blank"
            href={`${getExplorerBaseUrl()}/contract/${tokenAddress}`}
            rel="noreferrer"
          >
            {truncateAddress(tokenAddress)}
          </a>
        </code>
      </h3>
      <span className="error-message">{addTokenError}</span>
    </>
  )
}
