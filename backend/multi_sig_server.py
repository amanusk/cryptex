from enum import auto, Enum
import json
import traceback
from typing import Iterable
from aiohttp import web
import aiohttp_cors
from signature_handler import SignatureHandler, RawTxData
import logging
from constants import STARKNET_FEEDER_GATEWAY_URL, STARKNET_GATEWAY_URL, TxHash, PublicKey, Signature, GENERAL_CONFIG
from feeders_client import ClientHolder

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
            logger.error(traceback.format_exc())
            return web.Response(text=json.dumps(repr(e)))

    return wrapper

def int_from_str(s: str):
    if type(s) is str and s.startswith("0x"):
        return int(s, 16)
    else:
        return int(s)

class TxStatus(Enum):
    Unknown = auto()
    MissingSignatures = auto()
    Ready = auto()
    Sent = auto()


class Server:
    def __init__(self):
        self.sig_handler = SignatureHandler()
        self.clients = ClientHolder.create(
            feeder_gateway_url=STARKNET_FEEDER_GATEWAY_URL, gateway_url=STARKNET_GATEWAY_URL)

    async def run(self):
        for tx_hash, tx in self.sig_handler.txs.items():
            if tx.sent:
                continue

            status = self._get_tx_status(tx_hash)
            if status is TxStatus.Ready:
                self.send_tx()




    @log_try_wrap
    async def init_tx(self, request):
        inp = await request.json()
        address = int_from_str(inp["address"])
        calldata = list(map(int_from_str, inp["calldata"]))
        max_fee = int(inp["max_fee"])
        nonce = int(inp["nonce"])
        label = inp["name"]

        raw_tx = RawTxData(address=address, calldata=calldata, max_fee=max_fee, nonce=nonce)
        tx_hash = raw_tx.to_invoke().calculate_hash(GENERAL_CONFIG)
        signer_weights = await self.clients.get_signer_weights(address)
        threshold = await self.clients.call_get_threshold(address)

        succeeded = self.sig_handler.add_tx(tx_hash, signer_weights, threshold, raw_tx, label)
        msg = (
            f"Added tx {tx_hash} successfully"
            if succeeded
            else f"tx {tx_hash} was already initialized."
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
        tx_hash = int(inp["tx_hash"])
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

    async def _send_tx(self, tx_hash: TxHash, force: bool):
        """
        Send the given tx if it is ready (and wasn't sent) to Starknet.
        If a `force` query parameter is added, sends the tx even if it isn't ready or was sent.
        """
        status = self._get_tx_status(tx_hash)
        if status is TxStatus.Unknown:
            return web.Response(text=json.dumps(UNKNOWN_TX_MSG.format(tx_hash)))

        if force or status is TxStatus.Ready:
            self._send_tx_to_starknet(tx_hash)
            if status is TxStatus.Ready:
                tx = self.sig_handler.get_tx(tx_hash)
                for user in tx.weights:
                    try:
                        self.sig_handler.user_to_txs[user].remove(tx_hash)
                    except Exception:
                        pass
            return web.Response(text=json.dumps(f"tx {tx_hash} sent."))
        elif force:
            self._send_tx_to_starknet(tx_hash)
            return web.Response(text=json.dumps(f"tx {tx_hash} sent."))
        else:
            return web.Response(text=json.dumps(f"tx {tx_hash} is not ready to be sent."))

    @log_try_wrap
    async def send_tx(self, request):
        """
        Send the given tx if it is ready (and wasn't sent) to Starknet.
        If a `force` query parameter is added, sends the tx even if it isn't ready or was sent.
        """
        inp = await request.json()
        force = 'force' in request.query
        tx_hash = int(inp["tx_hash"])
        status = self._get_tx_status(tx_hash)
        if status is TxStatus.Unknown:
            return web.Response(text=json.dumps(UNKNOWN_TX_MSG.format(tx_hash)))

        if force or status is TxStatus.Ready:
            self._send_tx_to_starknet(tx_hash)
            if status is TxStatus.Ready:
                self._remove_tx_from_singers(tx_hash)
            return web.Response(text=json.dumps(f"tx {tx_hash} sent."))
        elif force:
            self._send_tx_to_starknet(tx_hash)
            return web.Response(text=json.dumps(f"tx {tx_hash} sent."))
        else:
            return web.Response(text=json.dumps(f"tx {tx_hash} is not ready to be sent."))

    @log_try_wrap
    async def get_pending_txs(self, request):
        """
        Send the tx list of unsigned txs of the given user.
        """
        user = int_from_str(request.query.get("user"))
        txs_to_sign = self.sig_handler.user_to_txs.get(user, [])
        ret_val = []
        for tx in txs_to_sign:
            x = self.sig_handler.txs[tx.tx_hash]
            ret_val.append({
                "name": x.label,
                "calldata": x.raw_tx.calldata,
                "address": x.raw_tx.address,
                "max_fee": x.raw_tx.max_fee,
                "nonce": x.raw_tx.nonce,
            })
        return web.Response(text=json.dumps(ret_val))


    def _remove_tx_from_singers(self, tx_hash):
        tx = self.sig_handler.get_tx(tx_hash)
        for user in tx.weights:
            try:
                self.sig_handler.user_to_txs[user].remove(tx_hash)
            except Exception:
                pass

    def _send_tx_to_starknet(self, tx_hash):
        """
        tx_hash is in the txs list.
        """
        tx = self.sig_handler.txs[tx_hash]
        self.clients.send_tx(tx=tx.raw_tx.to_invoke())
        tx.sent = True

    @log_try_wrap
    async def add_signature(self, request):
        inp = await request.json()
        tx_hash, user, signature = int_from_str(inp["tx_hash"]), int_from_str(inp["user"]), tuple(map(int, inp["signature"]))
        tx = self.sig_handler.get_tx(tx_hash)
        if tx is None:
            return web.Response(text=f"Given tx {tx_hash} is unknown.")
        tx.add_signature(user, signature)
        self.sig_handler.user_to_txs[user].remove(tx_hash)
        if tx.is_signature_ready():
            self._send_tx_to_starknet(tx_hash)
            self._remove_tx_from_singers(tx_hash)
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
            web.get(path="/get_pending_txs", handler=self.get_pending_txs),
        ]


    @staticmethod
    def cors_allow_all_origins(application: web.Application):
        """
        Allows access for all handlers, from any origin.

        See https://github.com/aio-libs/aiohttp-cors.
        """
        # Create a aiohttp_cors.CorsConfig that stores the CORS configurations allowing access
        # from all origins.
        cors_config = aiohttp_cors.setup(
            application,
            defaults={
                "*": aiohttp_cors.ResourceOptions(
                    allow_credentials=True,
                    expose_headers="*",
                    allow_headers="*",
                )
            },
        )

        # Configure CORS on all routes.
        for route in list(application.router.routes()):
            cors_config.add(route)

app = web.Application(logger=logger)
server = Server()
app.add_routes(server.routes())
server.cors_allow_all_origins(app)

if __name__ == "__main__":
    web.run_app(app)
