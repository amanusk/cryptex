use contracts::account::Account;
use starknet::TxInfo;
use traits::TryInto;
use option::OptionTrait;
use starknet::contract_address::Felt252TryIntoContractAddress;
use array::ArrayTrait;

#[test]
#[available_gas(1000000)]
fn test_constructor() {
    Account::constructor(1);
}

#[test]
#[available_gas(1000000)]
fn test_validate() {
    let mut signature = ArrayTrait::new();
    signature.append(1);
    signature.append(2);
    let signature = signature.span();

    let tx_info = TxInfo {
        version: 1,
        account_contract_address: 123.try_into().unwrap(),
        max_fee: 100_u128,
        signature,
        transaction_hash: 1234,
        chain_id: 1,
        nonce: 1,
    };

    Account::validate_transaction(tx_info);
}

