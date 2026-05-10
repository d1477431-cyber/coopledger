import { useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Couleurs marque CoopLedger (#15803d, #14532d) */
const COLOR_PRIMARY = [21, 128, 61];
const COLOR_DARK = [20, 83, 45];
const COLOR_PRIMARY_AMOUNT = COLOR_PRIMARY;

// Convertir Firebase Timestamp en Date
function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Formater une date en français
function formatDate(value) {
  const date = toDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formater montant en FCFA
function formatMontant(montant) {
  return `${(montant || 0).toLocaleString('fr-FR')} FCFA`;
}

// Formater nom du fichier avec mois/année
function formatMoisForFileName(date) {
  return date.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).replace(/\s+/g, '-');
}

/**
 * @param {Array} transactions
 * @param {number} year
 * @param {number} month - 0–11
 */
export function resumePourMois(transactions, year, month) {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const txMois = (transactions || []).filter((tx) => {
    const date = toDate(tx.date);
    return date && date >= startOfMonth && date <= endOfMonth;
  });

  const totalEntrees = txMois
    .filter((tx) => tx.type === 'entree' || tx.type === 'revenu')
    .reduce((sum, tx) => sum + (tx.montant || 0), 0);

  const totalSorties = txMois
    .filter((tx) => tx.type === 'sortie' || tx.type === 'depense')
    .reduce((sum, tx) => sum + (tx.montant || 0), 0);

  const soldeNet = totalEntrees - totalSorties;
  const nbValidees = txMois.filter((tx) => tx.statut === 'valide').length;
  const nbEnCours = txMois.filter((tx) => tx.statut === 'en_cours').length;
  const nbRejetees = txMois.filter((tx) => tx.statut === 'rejete').length;

  return {
    txMois,
    totalEntrees,
    totalSorties,
    soldeNet,
    nbValidees,
    nbEnCours,
    nbRejetees,
    periodeDebut: startOfMonth,
    periodeFin: endOfMonth,
  };
}

function resolvePeriode(periode) {
  if (
    periode &&
    typeof periode.year === 'number' &&
    typeof periode.month === 'number' &&
    periode.month >= 0 &&
    periode.month <= 11
  ) {
    return { year: periode.year, month: periode.month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function useRapportPDF() {
  const genererRapportMensuel = useCallback((transactions, userData, periode) => {
    const { year, month } = resolvePeriode(periode);
    const refDate = new Date(year, month, 1);
    const {
      txMois,
      totalEntrees,
      totalSorties,
      soldeNet,
      nbValidees,
      nbEnCours,
      nbRejetees,
    } = resumePourMois(transactions, year, month);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const periodLabel = refDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    doc.setFontSize(20);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('📊 CoopLedger', 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_DARK);
    doc.text('Rapport Mensuel', 14, 28);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Période: ${periodLabel}`, 14, 36);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 14, 42);
    doc.text(`Généré par: ${userData?.nom || 'Utilisateur'} (${userData?.role || 'N/A'})`, 14, 48);

    autoTable(doc, {
      startY: 56,
      head: [['Indicateur', 'Valeur']],
      body: [
        ['Nombre de transactions', String(txMois.length)],
        ['Transactions validées', String(nbValidees)],
        ['Votes en cours', String(nbEnCours)],
        ['Transactions rejetées', String(nbRejetees)],
        ['Total entrées', formatMontant(totalEntrees)],
        ['Total sorties', formatMontant(totalSorties)],
        ['Solde net du mois', formatMontant(soldeNet)],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: COLOR_PRIMARY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 240],
      },
      margin: { left: 14, right: 14 },
    });

    const txTableBody = txMois.map((tx) => [
      formatDate(tx.date),
      tx.titre || '-',
      tx.type === 'entree' || tx.type === 'revenu' ? '↑ Entrée' : '↓ Sortie',
      (tx.statut || '-').charAt(0).toUpperCase() + (tx.statut || '-').slice(1),
      formatMontant(tx.montant),
      (tx.hash || '-').substring(0, 12) + '...',
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Date', 'Titre', 'Type', 'Statut', 'Montant', 'Hash']],
      body: txTableBody,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: COLOR_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 240],
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const rowData = txTableBody[data.row.index];
          if (rowData && rowData[2].includes('↑')) {
            data.cell.textColor = COLOR_PRIMARY_AMOUNT;
          } else {
            data.cell.textColor = [239, 68, 68];
          }
        }
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} / ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    const fileName = `rapport-coopledger-${formatMoisForFileName(refDate)}.pdf`;
    doc.save(fileName);
  }, []);

  return { genererRapportMensuel };
}
