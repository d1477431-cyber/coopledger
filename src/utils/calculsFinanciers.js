const TYPES_ENTREE = [
  'entree', 'revenu', 'cotisation', 'mobile_money',
  'main_a_main', 'vente_recolte', 'subvention', 'remboursement', 'appel_fonds',
];
const TYPES_SORTIE = ['sortie', 'depense', 'sortie_especes'];

export function estEntree(tx) {
  return TYPES_ENTREE.includes(tx.type) || TYPES_ENTREE.includes(tx.typeTransaction);
}
export function estDepense(tx) {
  return TYPES_SORTIE.includes(tx.type) || TYPES_SORTIE.includes(tx.typeTransaction);
}
export function estComptabilisable(tx) {
  const s = tx.statut;
  if (!s || s === '' || s === 'valide' || s === 'en_cours' || s === 'confirme') return true;
  if (s === 'rejete' || s === 'annule' || s === 'cancelled') return false;
  return true;
}
export function toDate(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
export function calculerFinances(transactions, { start, end } = {}) {
  const tx = transactions.filter((t) => {
    if (!estComptabilisable(t)) return false;
    if (start || end) {
      const d = toDate(t.date) || toDate(t.createdAt);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d >= end) return false;
    }
    return true;
  });
  const revenus = tx.filter(estEntree).reduce((a, t) => a + Number(t.montant || 0), 0);
  const depenses = tx.filter(estDepense).reduce((a, t) => a + Number(t.montant || 0), 0);
  return { revenus, depenses, solde: revenus - depenses, count: tx.length };
}
