import * as fs from 'fs';
import { format } from 'date-fns';

import { XlsxFileHandler } from './handlers';
import { createTaxCalculator } from './calculators';

async function main() {
  try {
    const now = new Date();
    const formattedDate = format(now, 'yyyy-MM-dd_HH-mm-ss');

    // Récupérer les noms des fichiers à partir des arguments de la ligne de commande
    const inputFilePath = process.argv[2] || 'transactions.xlsx';
    const outputFilePath = process.argv[3] || `grouped_taxes_${formattedDate}.xlsx`;
    const logFilePath = process.argv[4] || `error_${formattedDate}.log`;

    // Vérifier si le fichier d'entrée existe
    if (!fs.existsSync(inputFilePath)) {
      throw new Error(`Input file not found: ${inputFilePath}`);
    }

    console.log('Reading transactions from Excel file...');
    const transactions = XlsxFileHandler.readTransactionsFromExcel(inputFilePath);

    console.log('Calculating crypto taxes...');
    const taxCalculator = createTaxCalculator();
    const cryptoDetails = await taxCalculator.calculateCryptoTaxes(transactions);

    console.log('Writing grouped taxes to Excel file...');
    XlsxFileHandler.writeGroupedTaxesToExcel(cryptoDetails, outputFilePath, transactions);

    console.log(`Grouped tax calculation completed. Check ${outputFilePath} for results and ${logFilePath} for any issues.`);
  } catch (error) {
    if (error instanceof Error) {
      console.error('An error occurred:', error.message);
    } else {
      console.error('An unknown error occurred:', error);
    }
  }
}

// node src/index.js chemin_fichier_entree.xlsx chemin_fichier_sortie.xlsx chemin_fichier_journal.log
// node src/index.js chemin_fichier_entree.xlsx
main();
