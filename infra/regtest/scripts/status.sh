#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"
customer listchannels | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const c of JSON.parse(s).channels)console.log(`Channel active=${c.active}: customer ${c.local_balance} sats, shop ${c.remote_balance} sats`)})'
