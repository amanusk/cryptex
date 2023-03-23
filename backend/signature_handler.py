from collections import defaultdict
from typing import Optional
from constants import TxHash, PublicKey, Signature, STARKNET_FEEDER_GATEWAY_URL, STARKNET_GATEWAY_URL
from dataclasses import dataclass
from starkware.starknet.services.api.gateway.transaction import InvokeFunction
from feeders_client import ClientHolder

def verify_signature(tx_hash: TxHash, user: PublicKey, signature: Signature) -> bool:
    return True

@dataclass(frozen=True)
class RawTxData:
    address: int
    calldata: list[int]
    max_fee: int
    nonce: int

    def to_invoke(self, signature: list[int]) -> InvokeFunction:
        return InvokeFunction(
            version=1, max_fee=self.max_fee, signature=signature, nonce=self.nonce,
            sender_address=self.address, calldata=self.calldata)

class TxData:
    clients = ClientHolder.create(
            feeder_gateway_url=STARKNET_FEEDER_GATEWAY_URL, gateway_url=STARKNET_GATEWAY_URL)

    def __init__(self, tx_hash: TxHash, signer_weights: dict[PublicKey, int], threshold: int, raw_tx: RawTxData, label):
        self.tx_hash = tx_hash
        self.weights = signer_weights
        self.signatures: dict[PublicKey, Signature] = {}
        self.threshold = threshold
        self.sent = False
        self.raw_tx = raw_tx
        self.label = label

    def __hash__(self) -> int:
        return self.tx_hash

    def _get_tx_current_weight(self) -> int:
        return sum(self.weights[signer] for signer in self.signatures)

    def add_signature(self, user: PublicKey, signature: Signature):
        """
        Raises exception for invalid signature or a user that was not registered for this tx upon
        add_tx.
        """
        if user not in self.weights:
            raise Exception("User is not a part of the given tx quorum")
        if not verify_signature(self.tx_hash, user, signature):
            raise Exception("Failed to verify signature")
        self.signatures[user] = signature

    def get_signature_score(self) -> tuple[int, int]:
        return (self._get_tx_current_weight(), self.threshold)

    def is_signature_ready(self) -> bool:
        score, threshold = self.get_signature_score()
        if score >= threshold:
            return True
        return False

    async def update_weights(self):
        signer_weights = await self.clients.get_signer_weights(self.address)
        threshold = await self.clients.call_get_threshold(self.address)


class SignatureHandler:
    def __init__(self) -> None:
        self.txs: dict[TxHash, TxData] = dict()
        self.user_to_txs: dict[PublicKey, list[TxHash]] = defaultdict(list)

    def add_tx(self, tx_hash: TxHash, signer_weights: dict[PublicKey, int], threshold: int, raw_tx: RawTxData, label: Optional[str]) -> bool:
        if tx_hash not in self.txs:
            new_tx = TxData(tx_hash, signer_weights, threshold, raw_tx, label)
            self.txs[tx_hash] = new_tx
            for user in signer_weights:
                self.user_to_txs[user].append(tx_hash)
            return True
        return False

    def _get_tx_data_from_starknet(self, tx_hash) -> TxData:
        """
        Get weights and threshold from Starknet.
        """
        signer_weights = {hex(1): 15}
        threshold = 100
        return TxData(tx_hash, signer_weights, threshold)

    def get_tx(self, tx_hash: TxHash) -> Optional[TxData]:
        return self.txs.get(tx_hash)
