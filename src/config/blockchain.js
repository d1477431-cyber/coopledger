import { ethers } from 'ethers';
import { POLYGON_CONFIG } from './polygon';

export const CONTRACT_ADDRESS = POLYGON_CONFIG?.CONTRACTS?.COOPERATIVE || '';

export const NETWORK_CONFIG = {
  name: 'Polygon Mainnet',
  chainId: POLYGON_CONFIG?.CHAIN_ID || 137,
  rpcUrl: POLYGON_CONFIG?.RPC_URL || 'https://polygon-rpc.com/',
  explorer: POLYGON_CONFIG?.BLOCK_EXPLORER_URL || 'https://polygonscan.com/',
  symbol: 'POL',
};

export function isContractConfigured() {
  if (!CONTRACT_ADDRESS) return false;
  if (!ethers.isAddress(CONTRACT_ADDRESS)) return false;
  return CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

export function getJsonRpcProvider() {
  return new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
}

export function getExplorerTxUrl(hash) {
  if (!hash) return null;
  return `${NETWORK_CONFIG.explorer.replace(/\/$/, '')}/tx/${hash}`;
}

export function getExplorerAddressUrl(address) {
  if (!address) return null;
  return `${NETWORK_CONFIG.explorer.replace(/\/$/, '')}/address/${address}`;
}
