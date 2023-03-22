use serde::Serde;
use starknet::ContractAddress;
use starknet::contract_address::ContractAddressSerde;
use array::ArrayTrait;
use array::SpanTrait;

#[account_contract]
mod Account {
    use array::ArrayTrait;
    use array::SpanTrait;
    use box::BoxTrait;
    use ecdsa::check_ecdsa_signature;
    use option::OptionTrait;
    use super::Call;
    use super::ArrayCallSerde;
    use super::ArrayCallDrop;
    use starknet::ContractAddress;
    use starknet::ContractAddressZeroable;
    use zeroable::Zeroable;
    use starknet::TxInfo;
    use serde::Serde;
    use dict::Felt252DictTrait;
    use traits::Into;

    struct Storage {
        threshold: u128,
        n_keys: usize,
        weights: LegacyMap::<felt252, u128>,
        keys: LegacyMap::<usize, felt252>,
    }

    #[derive(Drop)]
    struct MultiSig {
        signatures: Array<SignatureEntry>, 
    }

    impl MultiSigSerde of Serde::<MultiSig> {
        fn serialize(ref output: Array<felt252>, mut input: MultiSig) {
            Serde::serialize(ref output, input.signatures);
        }

        fn deserialize(ref serialized: Span<felt252>) -> Option<MultiSig> {
            Option::Some(MultiSig { signatures: Serde::deserialize(ref serialized)? })
        }
    }

    #[derive(Copy, Drop)]
    struct SignatureEntry {
        key: felt252,
        r: felt252,
        s: felt252,
    }

    impl SignatureEntrySerde of Serde::<SignatureEntry> {
        fn serialize(ref output: Array<felt252>, mut input: SignatureEntry) {
            Serde::serialize(ref output, (input.key, input.r, input.s));
        }

        fn deserialize(ref serialized: Span<felt252>) -> Option<SignatureEntry> {
            let res = Serde::<(felt252, felt252, felt252)>::deserialize(ref serialized)?;
            let (key, r, s) = res;
            Option::Some(SignatureEntry { key, r, s })
        }
    }

    #[constructor]
    fn constructor(initial_key: felt252, initial_weight: u128, initial_threshold: u128) {
        n_keys::write(1_usize);
        keys::write(0_usize, initial_key);
        weights::write(initial_key, initial_weight);
        threshold::write(initial_threshold);
    }

    #[external]
    fn add_key(key: felt252, weight: u128) {
        assert(starknet::get_caller_address() == starknet::get_contract_address(), 'Bad caller');
        assert(weight > 0_u128, 'Invalid weight');
        let n_keys_ = n_keys::read();
        n_keys::write(n_keys_ + 1_usize);
        keys::write(n_keys_, key);
        weights::write(key, weight);
    }

    #[external]
    fn remove_key_at(index: usize) {
        assert(starknet::get_caller_address() == starknet::get_contract_address(), 'Bad caller');
        let n_keys_ = n_keys::read();
        assert(index < n_keys_, 'Out of range');
        let key = keys::read(index);
        weights::write(key, 0_u128);
        keys::write(index, keys::read(n_keys_ - 1_usize));
        keys::write(n_keys_ - 1_usize, 0);
        n_keys::write(n_keys_ - 1_usize);
    }

    #[external]
    fn set_threshold(threshold_: u128) {
        assert(starknet::get_caller_address() == starknet::get_contract_address(), 'Bad caller');
        threshold::write(threshold_)
    }

    #[view]
    fn get_n_keys() -> usize {
        n_keys::read()
    }

    #[view]
    fn get_key_at(index: usize) -> felt252 {
        assert(index < n_keys::read(), 'Out of range');
        keys::read(index)
    }

    #[view]
    fn get_weight_at(key: felt252) -> u128 {
        weights::read(key)
    }

    #[view]
    fn get_threshold() -> u128 {
        threshold::read()
    }

    fn validate_transaction(tx_info: TxInfo) -> felt252 {
        let mut signature = tx_info.signature;
        let tx_hash = tx_info.transaction_hash + 1 - 1;
        let MultiSig{mut signatures, } = Serde::<MultiSig>::deserialize(
            ref signature
        ).expect('Invaid signature format');

        let weight = get_total_signed_weight(
            0_u128, u256 { low: 0_u128, high: 0_u128 }, tx_hash, signatures
        );
        assert(weight >= threshold::read(), 'Not enough weight');

        starknet::VALIDATED
    }

    fn get_total_signed_weight(
        total: u128, min_key: u256, tx_hash: felt252, mut signatures: Array<SignatureEntry>
    ) -> u128 {
        match gas::withdraw_gas_all(get_builtin_costs()) {
            Option::Some(_) => {},
            Option::None(_) => {
                let mut data = ArrayTrait::new();
                data.append('OOG');
                panic(data);
            }
        }
        match signatures.pop_front() {
            Option::Some(SignatureEntry{key,
            r,
            s,
            }) => {
                let weight = weights::read(key);
                let key_as_u256 = key.into();
                assert(min_key <= key_as_u256, 'Keys not sequential');
                assert(check_ecdsa_signature(tx_hash, key, r, s), 'Invalid signature');
                return get_total_signed_weight(
                    total + weight, key_as_u256 + 1.into(), tx_hash, signatures
                );
            },
            Option::None(()) => {
                total
            },
        }
    }

    #[external]
    fn __validate_deploy__(
        class_hash: felt252, contract_address_salt: felt252, public_key_: felt252
    ) -> felt252 {
        validate_transaction(starknet::get_tx_info().unbox())
    }

    #[external]
    fn __validate_declare__(class_hash: felt252) -> felt252 {
        validate_transaction(starknet::get_tx_info().unbox())
    }

    #[external]
    fn __validate__(
        contract_address: ContractAddress, entry_point_selector: felt252, calldata: Array::<felt252>
    ) -> felt252 {
        validate_transaction(starknet::get_tx_info().unbox())
    }

    #[external]
    #[raw_output]
    fn __execute__(mut calls: Array<Call>) -> Span::<felt252> {
        // Validate caller.
        assert(starknet::get_caller_address().is_zero(), 'INVALID_CALLER');

        // Check the tx version here, since version 0 transaction skip the __validate__ function.
        let tx_info = starknet::get_tx_info().unbox();
        assert(tx_info.version != 0, 'INVALID_TX_VERSION');

        // TODO(ilya): Implement multi call.
        assert(calls.len() == 1_u32, 'MULTI_CALL_NOT_SUPPORTED');
        let Call{to, selector, calldata } = calls.pop_front().unwrap();

        starknet::call_contract_syscall(
            address: to, entry_point_selector: selector, calldata: calldata.span()
        ).unwrap_syscall()
    }
}

struct Call {
    to: ContractAddress,
    selector: felt252,
    calldata: Array<felt252>
}

impl ArrayCallDrop of Drop::<Array<Call>>;

impl CallSerde of Serde::<Call> {
    fn serialize(ref output: Array<felt252>, input: Call) {
        let Call{to, selector, calldata } = input;
        Serde::serialize(ref output, to);
        Serde::serialize(ref output, selector);
        Serde::serialize(ref output, calldata);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<Call> {
        let to = Serde::<ContractAddress>::deserialize(ref serialized)?;
        let selector = Serde::<felt252>::deserialize(ref serialized)?;
        let calldata = Serde::<Array::<felt252>>::deserialize(ref serialized)?;
        Option::Some(Call { to, selector, calldata })
    }
}

impl ArrayCallSerde of Serde::<Array<Call>> {
    fn serialize(ref output: Array<felt252>, mut input: Array<Call>) {
        Serde::<usize>::serialize(ref output, input.len());
        serialize_array_call_helper(ref output, input);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<Array<Call>> {
        let length = *serialized.pop_front()?;
        let mut arr = ArrayTrait::new();
        deserialize_array_call_helper(ref serialized, arr, length)
    }
}

fn serialize_array_call_helper(ref output: Array<felt252>, mut input: Array<Call>) {
    // TODO(orizi): Replace with simple call once inlining is supported.
    match gas::withdraw_gas() {
        Option::Some(_) => {},
        Option::None(_) => {
            let mut data = ArrayTrait::new();
            data.append('Out of gas');
            panic(data);
        },
    }
    match input.pop_front() {
        Option::Some(value) => {
            Serde::<Call>::serialize(ref output, value);
            serialize_array_call_helper(ref output, input);
        },
        Option::None(_) => {},
    }
}

fn deserialize_array_call_helper(
    ref serialized: Span<felt252>, mut curr_output: Array<Call>, remaining: felt252
) -> Option<Array<Call>> {
    if remaining == 0 {
        return Option::Some(curr_output);
    }

    // TODO(orizi): Replace with simple call once inlining is supported.
    match gas::withdraw_gas() {
        Option::Some(_) => {},
        Option::None(_) => {
            let mut data = ArrayTrait::new();
            data.append('Out of gas');
            panic(data);
        },
    }

    curr_output.append(Serde::<Call>::deserialize(ref serialized)?);
    deserialize_array_call_helper(ref serialized, curr_output, remaining - 1)
}
