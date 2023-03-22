from typing import Dict, List

from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.services.api.feeder_gateway.feeder_gateway_client import FeederGatewayClient
from starkware.starknet.services.api.feeder_gateway.request_objects import CallFunction
from starkware.starknet.services.api.feeder_gateway.response_objects import (
    PENDING_BLOCK_ID,
    BlockIdentifier,
)
from starkware.starknet.services.api.gateway.gateway_client import GatewayClient

from starkware.starknet.cli.starknet_cli_utils import (
    construct_feeder_gateway_client,
    construct_gateway_client,
)
from starkware.starknet.cli.starknet_cli import assert_tx_received
from starkware.starknet.services.api.gateway.transaction import Transaction


StarknetClientResponse = Dict[str, List[str]]
StarknetAddress = int
Felt = int


class ClientHolder:
    def __init__(self, feeder_gateway_client: FeederGatewayClient, gateway_client: GatewayClient):
        self.feeder_gateway_client = feeder_gateway_client
        self.gateway_client = gateway_client

    @classmethod
    def create(cls, feeder_gateway_url: str, gateway_utl: str) -> "ClientHolder":
        feeder_gateway_client = construct_feeder_gateway_client(
            feeder_gateway_url=feeder_gateway_url
        )
        gateway_client = construct_gateway_client(gateway_utl=gateway_utl)
        return cls(feeder_gateway_client=feeder_gateway_client, gateway_client=gateway_client)

    async def send_tx(self, tx: Transaction):
        gateway_response = await self.gateway_client.add_transaction(tx=tx)
        assert_tx_received(gateway_response=gateway_response)
        # Don't end sentences with '.', to allow easy double-click copy-pasting of the values.
        print(
            f"""\
Declare transaction was sent.
Contract class hash: {gateway_response['class_hash']}
Transaction hash: {gateway_response['transaction_hash']}"""
        )

    async def call_contract(
        self,
        func_name: str,
        calldata: List[int],
        address: StarknetAddress,
        block_identifier: BlockIdentifier = PENDING_BLOCK_ID,
    ) -> StarknetClientResponse:
        """
        Calls the function with the appropriate arguments for a given contract over
        a specific starknet state.
        """
        selector = get_selector_from_name(func_name=func_name)
        call_function = CallFunction(
            contract_address=address,
            entry_point_selector=selector,
            calldata=calldata,
        )

        return await self.feeder_gateway_client.call_contract(
            call_function=call_function, block_number=block_identifier
        )

    async def call_get_signers(self, address: StarknetAddress):
        return await self.call_contract(
            func_name="get_signers",
            calldata=[],
            address=address,
        )

    async def call_get_threshold(self, address: StarknetAddress):
        return await self.call_contract(
            func_name="get_threshold",
            calldata=[],
            address=address,
        )
