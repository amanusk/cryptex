SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cairo-test -p $SCRIPT_DIR --starknet
starknet-compile $SCRIPT_DIR --allowed-libfuncs-list-name experimental_v0.1.0 > $SCRIPT_DIR/account.sierra
