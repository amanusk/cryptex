use contracts::account::Account;
use contracts::account::Account::SignatureEntry;
use contracts::account::Account::MultiSig;
use starknet::TxInfo;
use traits::TryInto;
use option::OptionTrait;
use starknet::contract_address::Felt252TryIntoContractAddress;
use array::ArrayTrait;
use serde::Serde;
use ecdsa::check_ecdsa_signature;

#[derive(Drop)]
struct TestData {
    msg_hash: felt252,
    keys: Array::<felt252>,
    signatures: Array::<SignatureEntry>,
}

fn get_test_data() -> TestData {
    let mut keys = ArrayTrait::new();
    let mut signatures = ArrayTrait::new();

    keys.append(665558366207077410218026222928193267108806256319010858955290906517180688954);
    keys.append(883886118681906248716010750893037596855803840441247035344732644075763847404);
    keys.append(1984621968675442465212898485388984914168643324629440744919297246935683577082);
    keys.append(338255720068070161732958977062508458406354442544724211074873564570963584481);
    keys.append(2688065520245807978066130222805192030929353248552606855632065288902864288345);
    keys.append(1616399930108073277743588311299093251821874672720398414732911324101134637926);
    keys.append(3382600044459684520555656528123596246605101187893823033656282384589589843845);
    keys.append(2949451167914013776010508560878371348115394544410638898608346166021977130594);
    keys.append(3215186983083440178970344402566227944154363068728654022160188158790170988479);
    keys.append(3162947674033874716824518178339051996101881213733247662211947705677703215658);

    signatures.append(
        SignatureEntry {
            key: 665558366207077410218026222928193267108806256319010858955290906517180688954,
            r: 466081390538472268040822951447865693384369516125360403037393823051342830841,
            s: 573086590053308570272705540708853186506542120118072525477152450913154568959,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 883886118681906248716010750893037596855803840441247035344732644075763847404,
            r: 2412790374691948851120916941393011545862021446353075442146569788486223984684,
            s: 1716745045901786811630436745959043078314859376785021386405462771384494789908,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 1984621968675442465212898485388984914168643324629440744919297246935683577082,
            r: 3314101652610134786588452950046215912584494245971007876012197387781705730245,
            s: 899615252442514889488242902669712360127246443272419999632048742997039010640,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 338255720068070161732958977062508458406354442544724211074873564570963584481,
            r: 2460600338950043755072049001464920981751653656360939912148156656063797048136,
            s: 67332665305194367699645556409412419191307103541727173044673359521414380336,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 2688065520245807978066130222805192030929353248552606855632065288902864288345,
            r: 136162569969142547684693997602966714838128058378143431665258687304758222001,
            s: 3017275977230027294529823175466623308944886076008145167153311736853146568099,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 1616399930108073277743588311299093251821874672720398414732911324101134637926,
            r: 1302997690446892078448353180378725616654523407557411566577489541218780026586,
            s: 3352357580725457165805084339536237401448606659675522482076562550178795407599,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 3382600044459684520555656528123596246605101187893823033656282384589589843845,
            r: 1470753964256014922684747332010174398846669442596231675578522972815238601547,
            s: 933332330289147102831586771987540028290196794196765361954668864435300375466,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 2949451167914013776010508560878371348115394544410638898608346166021977130594,
            r: 1911721841800090807408063591254720926939737253727540625902212749011646906853,
            s: 2038073339389227379543554518127221291585198750898918918881495585664482211144,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 3215186983083440178970344402566227944154363068728654022160188158790170988479,
            r: 540828286527210077959642465815757640751006636133955040685251810556713592596,
            s: 3083348562113271473486625441411087146250042196684001679344819292582238074350,
        }
    );
    signatures.append(
        SignatureEntry {
            key: 3162947674033874716824518178339051996101881213733247662211947705677703215658,
            r: 339528376733366061178772050156644113546710695208309203706904575047744999609,
            s: 1023986112852207946033763260479546949120784590748649021560145244344079774773,
        }
    );

    TestData { msg_hash: 123, keys, signatures }
}

#[test]
#[available_gas(1000000)]
fn test_validate() {
    let test_data = get_test_data();
    Account::constructor(
        initial_key: *(@test_data).keys.at(0_usize),
        initial_weight: 1_u128,
        initial_threshold: 3_u128
    );
    Account::add_key(*(@test_data).keys.at(1_usize), 2_u128);
    Account::add_key(*(@test_data).keys.at(2_usize), 3_u128);

    let mut signatures = ArrayTrait::new();
    signatures.append(*(@test_data).signatures.at(0_usize));
    signatures.append(*(@test_data).signatures.at(1_usize));

    let mut serialized_signature = ArrayTrait::new();
    Serde::serialize(ref serialized_signature, MultiSig { signatures });

    let tx_info = TxInfo {
        version: 1,
        account_contract_address: 123.try_into().unwrap(),
        max_fee: 100_u128,
        signature: serialized_signature.span(),
        transaction_hash: test_data.msg_hash,
        chain_id: 1,
        nonce: 1,
    };

    Account::validate_transaction(tx_info);
}


#[should_panic]
#[test]
#[available_gas(1000000)]
fn test_validate_bad() {
    let test_data = get_test_data();
    Account::constructor(
        initial_key: *(@test_data).keys.at(0_usize),
        initial_weight: 1_u128,
        initial_threshold: 4_u128
    );
    Account::add_key(*(@test_data).keys.at(1_usize), 2_u128);
    Account::add_key(*(@test_data).keys.at(2_usize), 3_u128);

    let mut signatures = ArrayTrait::new();
    signatures.append(*(@test_data).signatures.at(0_usize));
    signatures.append(*(@test_data).signatures.at(1_usize));

    let mut serialized_signature = ArrayTrait::new();
    Serde::serialize(ref serialized_signature, MultiSig { signatures });

    let tx_info = TxInfo {
        version: 1,
        account_contract_address: 123.try_into().unwrap(),
        max_fee: 100_u128,
        signature: serialized_signature.span(),
        transaction_hash: test_data.msg_hash,
        chain_id: 1,
        nonce: 1,
    };

    Account::validate_transaction(tx_info);
}

