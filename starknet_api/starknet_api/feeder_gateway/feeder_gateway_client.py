from typing import Dict, List

from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.services.api.feeder_gateway.feeder_gateway_client import FeederGatewayClient
from starkware.starknet.services.api.feeder_gateway.request_objects import CallFunction
from starkware.starknet.services.api.feeder_gateway.response_objects import (
    PENDING_BLOCK_ID,
    BlockIdentifier,
)
from starkware.starknet.cli.starknet_cli_utils import construct_feeder_gateway_client


StarknetClientResponse = Dict[str, List[str]]
StarknetAddress = int
Felt = int


class FeederGatewayClientHolder:
    def __init__(self, feeder_gateway_client: FeederGatewayClient):
        self.feeder_gateway_client = feeder_gateway_client

    @classmethod
    def create(cls, feeder_gateway_url: str) -> "FeederGatewayClientHolder":
        feeder_gateway_client = construct_feeder_gateway_client(feeder_gateway_url=feeder_gateway_url)
        return cls(feeder_gateway_client=feeder_gateway_client)


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
