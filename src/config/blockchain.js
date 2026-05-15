import { ethers } from 'ethers';
import { POLYGON_CONFIG } from './polygon';

export const CONTRACT_ADDRESS = POLYGON_CONFIG?.CONTRACTS?.COOPERATIVE || '';

export const NETWORK_CONFIG = {
  name: 'Polygon Amoy Testnet',
  chainId: 80002,
  rpcUrl: 'https://rpc-amoy.polygon.technology',
  explorer: 'https://amoy.polygonscan.com/',
  symbol: 'MATIC',
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
