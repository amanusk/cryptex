from enum import auto, Enum
import json
from typing import Iterable
from aiohttp import web
from signature_handler import SignatureHandler, TxHash, PublicKey, Signature
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UNKNOWN_TX_MSG = "tx {tx_hash} is unknown."

def log_try_wrap(f):
    async def wrapper(*args, **kwargs):
        try:
            logger.debug(f"Call {f.__name__} with {args}, {kwargs}")
            return await f(*args, **kwargs)
        except Exception as e:
            logger.error(e)
            print(repr(e), e.__traceback__)
            return web.Response(text=json.dumps(repr(e)))

    return wrapper


class TxStatus(Enum):
    Unknown = auto()
    MissingSignatures = auto()
    Ready = auto()
    Sent = auto()


class Server:
    def __init__(self):
        self.sig_handler = SignatureHandler()

    @log_try_wrap
    async def init_tx(self, request):
        inp = await request.json()
        tx_hash, signer_weights, threshold = inp["tx_hash"], inp["signer_weights"], inp["threshold"]
        succeeded = self.sig_handler.add_tx(tx_hash, signer_weights, threshold)
        msg = (
            f"Added tx {tx_hash} successfully"
            if succeeded
            else f"tx {tx_hash} was already initiated."
        )
        return web.Response(text=json.dumps(msg))

    @log_try_wrap
    async def get_tx_status(self, request):
        """
        Returns the status of the given tx.
        If a `v` query parameter is given, in the case of a MissingSignatures status, the current
        signature score and threshold are returned.
        """
        inp = await request.json()
        verbose = 'v' in request.query
        tx_hash = inp["tx_hash"]
        status = self._get_tx_status(tx_hash)
        msg = f"Status: {status.name}."
        if status is TxStatus.MissingSignatures and verbose:
            score, threshold = self.sig_handler.get_tx(tx_hash).get_signature_score()
            msg += f" Current score = {score} < {threshold}"
        return web.Response(text=json.dumps(msg))

    def _get_tx_status(self, tx_hash: TxHash) -> TxStatus:
        tx = self.sig_handler.get_tx(tx_hash)
        if tx is None:
            return TxStatus.Unknown
        if tx.sent:
            return TxStatus.Sent
        if tx.is_signature_ready():
            return TxStatus.Ready
        return TxStatus.MissingSignatures

    @log_try_wrap
    async def send_tx(self, request):
        """
        Send the given tx if it is ready (and wasn't sent) to Starknet.
        If a `force` query parameter is added, sends the tx even if it isn't ready or was sent.
        """
        inp = await request.json()
        force = 'force' in request.query
        tx_hash = inp["tx_hash"]
        status = self._get_tx_status(tx_hash)
        if status is TxStatus.Unknown:
            return web.Response(text=json.dumps(UNKNOWN_TX_MSG.format(tx_hash)))

        if force or status is TxStatus.Ready:
            self._send_tx_to_starknet(tx_hash)
            return web.Response(text=json.dumps(f"tx {tx_hash} sent."))
        else:
            return web.Response(text=json.dumps(f"tx {tx_hash} is not ready to be sent."))


    async def _send_tx_to_starknet(self, tx_hash):
        print(f"Fake sent of {tx_hash} - everyone is happy.")

    @log_try_wrap
    async def add_signature(self, request):
        inp = await request.json()
        tx_hash, user, signature = inp["tx_hash"], inp["user"], inp["signature"]
        tx = self.sig_handler.get_tx(tx_hash)
        if tx is None:
            return web.Response(text=f"Given tx {tx_hash} is unknown.")
        tx.add_signature(user, signature)
        return web.Response(text=f"Signature added to tx {tx_hash}.")

    def routes(self) -> Iterable[web.RouteDef]:
        return [
            web.post(path="/init_tx", handler=self.init_tx),
            web.post(
                path="/add_signature",
                handler=self.add_signature,
            ),
            web.get(
                path="/get_tx_status",
                handler=self.get_tx_status,
            ),
            web.post(path="/send_tx", handler=self.send_tx),
        ]


app = web.Application(logger=logger)
server = Server()
app.add_routes(server.routes())

if __name__ == "__main__":
    web.run_app(app)
