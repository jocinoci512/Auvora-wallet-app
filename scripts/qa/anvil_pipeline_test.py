"""Deterministic Anvil account #0 sign+broadcast — NOT the Auvora user key."""
from eth_account import Account
from web3 import Web3

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
acct = Account.from_key(pk)
user = "0x1d549b12f406ec094cdc4e796cf64394e06a32b5"
recv = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

print("from", acct.address)
print("chain", w3.eth.chain_id)
assert w3.eth.chain_id == 31337
nonce = w3.eth.get_transaction_count(acct.address)
gas_price = w3.eth.gas_price
print("nonce", nonce, "gasPrice", gas_price)
tx = {
    "nonce": nonce,
    "to": Web3.to_checksum_address(recv),
    "value": w3.to_wei(0.0001, "ether"),
    "gas": 21000,
    "gasPrice": gas_price,
    "chainId": 31337,
}
signed = acct.sign_transaction(tx)
raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
h = w3.eth.send_raw_transaction(raw)
print("HASH", h.hex())
rcpt = w3.eth.wait_for_transaction_receipt(h)
print("STATUS", rcpt.status, "BLOCK", rcpt.blockNumber, "GAS", rcpt.gasUsed)
print("USER_NONCE", w3.eth.get_transaction_count(user))
print("USER_BAL", hex(w3.eth.get_balance(user)))
assert w3.eth.get_transaction_count(user) == 0
assert w3.eth.get_balance(user) == 10**18
print("PIPELINE_PASS")
