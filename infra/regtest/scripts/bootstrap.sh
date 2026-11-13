#!/usr/bin/env bash
# Funds the nodes and opens a channel. Safe to run more than once.
source "$(dirname "$0")/lib.sh"

synced() { "$1" getinfo | grep -q '"synced_to_chain": *true'; }
has_wallet_and_rpc() { btc getblockchaininfo; }
has_channel_active() { customer listchannels --active_only | grep -q '"active": *true'; }
tx_visible() { [ "$("$1" walletbalance | json_get confirmed_balance)" -gt 0 ]; }
peer_connected() { customer listpeers | grep -q "$SHOP_PUBKEY"; }

echo "1/5 Waiting for bitcoind..."
wait_for "bitcoind to answer" 60 has_wallet_and_rpc

echo "2/5 Creating the miner wallet and mining the first blocks..."
if ! btc listwallets | grep -q '"miner"'; then
  btc loadwallet miner >/dev/null 2>&1 || btc createwallet miner >/dev/null
fi
HEIGHT="$(btc getblockcount)"
if [ "$HEIGHT" -lt 110 ]; then mine $((110 - HEIGHT)); fi
# LND only counts as synced when the newest block is recent. On a chain made days ago,
# it would wait forever, so always mine one fresh block. On regtest this costs nothing.
mine 1

echo "3/5 Waiting for the shop and customer nodes..."
wait_for "the shop node to sync" 120 synced shop
wait_for "the customer node to sync" 120 synced customer

echo "4/5 Funding the nodes..."
for node in shop customer; do
  if [ "$("$node" walletbalance | json_get confirmed_balance)" -eq 0 ]; then
    address="$("$node" newaddress p2wkh | json_get address)"
    miner sendtoaddress "$address" 1 >/dev/null
  fi
done
mine 1
wait_for "the shop node to see its funds" 60 tx_visible shop
wait_for "the customer node to see its funds" 60 tx_visible customer

echo "5/5 Opening a channel from customer to shop..."
SHOP_PUBKEY="$(shop getinfo | json_get identity_pubkey)"
export SHOP_PUBKEY
if ! has_channel_active; then
  if [ "$(customer pendingchannels | json_get total_limbo_balance)" = "0" ] \
     && ! customer pendingchannels | grep -q remote_node_pub; then
    customer connect "$SHOP_PUBKEY@lnd-shop:9735" >/dev/null 2>&1 || true
    wait_for "the customer node to connect to the shop node" 30 peer_connected
    customer openchannel --node_key "$SHOP_PUBKEY" --local_amt 5000000 --push_amt 2500000 >/dev/null
  fi
  mine 6
  wait_for "the channel to become active" 120 has_channel_active
fi

echo "OK: bitcoind, the shop node and the customer node are ready, with one open channel."
