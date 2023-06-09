import { supportsSessions } from "@argent/x-sessions"
import { display } from "@mui/system"
import type { NextPage } from "next"
import Head from "next/head"
import { useEffect, useState } from "react"
import { AccountInterface } from "starknet"

import { TokenDapp } from "../components/TokenDapp"
import { truncateAddress } from "../services/address.service"
import {
  addWalletChangeListener,
  chainId,
  connectWallet,
  removeWalletChangeListener,
  silentConnectWallet,
} from "../services/wallet.service"
import styles from "../styles/Home.module.css"

const Home: NextPage = () => {
  const [address, setAddress] = useState<string>()
  const [supportSessions, setSupportsSessions] = useState<boolean | null>(null)
  const [chain, setChain] = useState(chainId())
  const [isConnected, setConnected] = useState(false)
  const [account, setAccount] = useState<AccountInterface | null>(null)

  useEffect(() => {
    const handler = async () => {
      const wallet = await silentConnectWallet()
      setAddress(wallet?.selectedAddress)
      setChain(chainId())
      setConnected(!!wallet?.isConnected)
      if (wallet?.account) {
        setAccount(wallet.account)
      }
      setSupportsSessions(null)
      if (wallet?.selectedAddress) {
        try {
          const sessionSupport = await supportsSessions(
            wallet.selectedAddress,
            wallet.provider,
          )
          setSupportsSessions(sessionSupport)
        } catch {
          setSupportsSessions(false)
        }
      }
    }

    ;(async () => {
      await handler()
      addWalletChangeListener(handler)
    })()

    return () => {
      removeWalletChangeListener(handler)
    }
  }, [])

  const handleConnectClick = async () => {
    const wallet = await connectWallet()
    setAddress(wallet?.selectedAddress)
    setChain(chainId())
    setConnected(!!wallet?.isConnected)
    if (wallet?.account) {
      setAccount(wallet.account)
    }
    setSupportsSessions(null)
    if (wallet?.selectedAddress) {
      const sessionSupport = await supportsSessions(
        wallet.selectedAddress,
        wallet.provider,
      )
      console.log(
        "🚀 ~ file: index.tsx ~ line 72 ~ handleConnectClick ~ sessionSupport",
        sessionSupport,
      )
      setSupportsSessions(sessionSupport)
    }
  }
  // const toggle_text = async (e: React.FormEvent) => {
  //   var x = document.getElementById("myDIV");
  //   if (x.innerHTML === "Hello") {
  //     x.innerHTML = "Swapped text!";
  //   } else {
  //     x.innerHTML = "Hello";
  //   }
  // }
  return (
    <div className={styles.container}>
      <Head>
        <title>Argent x StarkNet test dapp</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {isConnected ? (
          <>
            {account && (
              <TokenDapp showSession={supportSessions} account={account} />
            )}
          </>
        ) : (
          <>
            <button className={styles.connect} onClick={handleConnectClick}>
              Connect Wallet
            </button>
            <p>First connect wallet to use dapp.</p>
          </>
        )}
      </main>
    </div>
  )
}

export default Home
