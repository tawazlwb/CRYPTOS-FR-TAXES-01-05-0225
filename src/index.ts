import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { format } from 'date-fns';
import * as ts from 'typescript';

import { XlsxFileHandler } from './handlers';
import { createTaxCalculator } from './calculators';

function getOutDirFromTsConfig(): string {
  const configPath = path.resolve('tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
  }

  const compilerOptions = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  ).options;

  return compilerOptions.outDir || 'dist';
}

async function main() {
  try {
    const now = new Date();
    const formattedDate = format(now, 'yyyy-MM-dd_HH-mm-ss');

    // Generate a unique output folder for each execution
    const outputFolder = path.join(getOutDirFromTsConfig(), `output_${formattedDate}`);
    await fs.mkdir(outputFolder, { recursive: true });

    // Define file paths within the unique output folder
    const inputFilePath = process.argv[2] || 'transactions.xlsx';
    const outputFilePath = path.join(outputFolder, `grouped_taxes_${formattedDate}.xlsx`);
    const logFilePath = path.join(outputFolder, `error_${formattedDate}.log`);

    // Vérifier si le fichier d'entrée existe
    if (!existsSync(inputFilePath)) {
      throw new Error(`Input file not found: ${inputFilePath}`);
    }

    console.log('Reading transactions from Excel file...');
    const transactionsPromise = XlsxFileHandler.readTransactionsFromExcel(inputFilePath);

    console.log('Calculating crypto taxes...');
    const taxCalculator = createTaxCalculator();

    // Process transactions and calculate taxes in parallel
    const [transactions, cryptoDetails] = await Promise.all([
      transactionsPromise,
      taxCalculator.calculateCryptoTaxes(await transactionsPromise),
    ]);

    console.log('Writing grouped taxes to Excel file...');
    await XlsxFileHandler.writeGroupedTaxesToExcel(cryptoDetails, outputFilePath, transactions);

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
