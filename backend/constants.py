from starkware.starknet.definitions.general_config import StarknetGeneralConfig

from typing import NewType

STARKNET_URL = "192.168.2.31"
STARKNET_GATEWAY_URL=f"http://{STARKNET_URL}:49156/"
STARKNET_FEEDER_GATEWAY_URL=f"http://{STARKNET_URL}:49158/"
STARKNET_INTERNAL_GATEWAY_URL=f"http://{STARKNET_URL}:49155/"

BE_URL = "http://192.168.1.165/"

PublicKey = NewType("PublicKey", int)
Signature = NewType("Signature", list[int])
TxHash = NewType("TxHash", int)

GENERAL_CONFIG = StarknetGeneralConfig()
