import { Call, validateAndParseAddress } from "starknet"
import { number, uint256 } from "starknet"

import { normalizeAddress } from "../../ui/services/addresses"

const { toBN } = number
const { isUint256, uint256ToBN } = uint256

export interface Erc20Call extends Call {
  calldata: [
    /** recipient address as decimal e.g. 2007141710004580612847837172790366058109710402280793820610123055421682225678 */
    recipientAddressDecimal: string,
    /**
     * amount as 2-part low and high felt
     * @see https://github.com/0xs34n/starknet.js/blob/develop/src/utils/uint256.ts
     * @see https://www.cairo-lang.org/docs/hello_cairo/intro.html#field-element
     */
    amountLowFelt: number.BigNumberish,
    amountHighFelt: number.BigNumberish,
  ]
}

export const validateERC20Call = (call: Erc20Call) => {
  try {
    const { contractAddress, calldata } = call
    /** validate token address */
    validateAndParseAddress(contractAddress)
    /** validate recipient address */
    const [recipientAddressDecimal, amountLowFelt, amountHighFelt] = calldata
    validateAndParseAddress(recipientAddressDecimal)
    /** validate uint256 input amount */
    const amountUint256: uint256.Uint256 = {
      low: amountLowFelt,
      high: amountHighFelt,
    }
    const amount = uint256ToBN(amountUint256)
    /** final check for valid Unit256 that is > 0 */
    if (isUint256(amount) && toBN(amount).gt(toBN(0))) {
      return true
    }
  } catch (e) {
    // failure implies invalid
  }
  return false
}

export const parseErc20Call = (call: Erc20Call) => {
  const { contractAddress, calldata } = call
  const [recipientAddressDecimal, amountLowFelt, amountHighFelt] = calldata
  const recipientAddress = normalizeAddress(recipientAddressDecimal)
  const amountUint256: uint256.Uint256 = {
    low: amountLowFelt,
    high: amountHighFelt,
  }
  const amount = uint256ToBN(amountUint256).toString(10)
  return {
    contractAddress,
    recipientAddress,
    amount,
  }
}
