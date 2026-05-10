import { getExplorerTxUrl } from '../config/blockchain';

export default function BlockchainBadge({ hash, className = '' }) {
  if (!hash) return null;
  const shortHash =
    hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;
  const href = getExplorerTxUrl(hash) || '#';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ${className}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      <span>Enregistré sur Polygon</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono underline decoration-dotted"
      >
        {shortHash}
      </a>
    </span>
  );
}
