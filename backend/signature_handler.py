from typing import NewType, Optional

PublicKey = NewType("PublicKey", int)
Signature = NewType("Signature", list[int])
TxHash = NewType("TxHash", int)


def verify_signature(tx_hash: TxHash, user: PublicKey, signature: Signature) -> bool:
    return True


class TxData:
    def __init__(self, tx_hash: TxHash, signer_weights: dict[PublicKey, int], threshold: int):
        self.tx_hash = tx_hash
        self.weights = signer_weights
        self.signatures: dict[PublicKey, Signature] = {}
        self.threshold = threshold
        self.sent = False

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


class SignatureHandler:
    def __init__(self) -> None:
        self.txs: dict[TxHash, TxData] = dict()

    def add_tx(self, tx_hash: TxHash, signer_weights: dict[PublicKey, int], threshold: int) -> bool:
        if tx_hash not in self.txs:
            self.txs[tx_hash] = TxData(tx_hash, signer_weights, threshold)
            # self.txs[tx_hash] = self._get_tx_data(tx_hash)
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
