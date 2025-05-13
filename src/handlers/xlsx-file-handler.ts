import * as xlsx from 'xlsx';
import * as winston from 'winston';
import { Worker } from 'worker_threads';
import { join } from 'path';

import { CryptoDetails, CryptoTransaction, rowSchema, TransactionDetails } from "../types";

// Path to the workers file
const isDev = process.env.NODE_ENV !== 'production';

const workerValidationPath = isDev
  ? join(__dirname, '../workers/row-validation-worker.ts') // Dev: TypeScript
  : join(__dirname, '../workers/row-validation-worker.js'); // Prod: JavaScript

const workerStylePath = isDev
  ? join(__dirname, '../workers/apply-cell-style-worker.ts') // Dev: TypeScript
  : join(__dirname, '../workers/apply-cell-style-worker.js'); // Prod: JavaScript

export class XlsxFileHandler {
  static readonly EXCEL_START_LINE = 2; // Excel rows start at 1, plus header row

  static validateRow(row: any, index: number): CryptoTransaction {
    const { error, value } = rowSchema.validate(row);

    if (error) {
      throw new Error(`InvalidRow at line ${index}: ${error.details.map((d) => d.message).join(', ')}`);
    }

    return {
      date: value.date,
      crypto: value.crypto,
      buyPrice: parseFloat(value.buyPrice),
      buyCurrency: value.buyCurrency,
      sellPrice: parseFloat(value.sellPrice),
      sellCurrency: value.sellCurrency,
      quantity: parseFloat(value.quantity),
    };
  }

  static async readTransactionsFromExcel(filePath: string, logFilePathValidation?: string, sheetName?: string): Promise<CryptoTransaction[]> {
    // Define a logger instance using winston
    const logger = winston.createLogger({
      level: 'error',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: logFilePathValidation ?? 'errors.json' }),
      ],
    });

    const workbook = xlsx.readFile(filePath);
    const selectedSheetName = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[selectedSheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const transactions: CryptoTransaction[] = [];
    const errors: any[] = [];

    const promises = data.map((row: any, index: number) => {
      return new Promise<void>((resolve) => {
        const worker = new Worker(workerValidationPath, {
          execArgv: ['-r', 'ts-node/register'], // Permet d'exécuter TypeScript directement
        });

        worker.on('message', (message) => {
          if (message.error) {
            errors.push({
              timestamp: new Date().toISOString(),
              line: index + XlsxFileHandler.EXCEL_START_LINE,
              errorType: 'InvalidRow',
              message: message.error,
              details: { rowContent: message.row },
            });
          } else if (message.transaction) {
            transactions.push(message.transaction);
          }
          worker.terminate(); // Ensure the worker is terminated after processing
          resolve();
        });

        worker.postMessage({ row, index });
      });
    });

    await Promise.all(promises);

    // Log errors in bulk
    if (errors.length > 0) {
      logger.error(errors);
    }

    return transactions;
  }

  static writeGroupedTaxesToExcel(
    cryptoDetails: { [crypto: string]: CryptoDetails },
    outputPath: string
  ): void {
    const data: any[] = [];

    // Group data preparation
    Object.entries(cryptoDetails).forEach(([crypto, details]) => {
      const cryptoData = details.transactions.map((transaction: TransactionDetails) => ({
        crypto,
        date: transaction.date,
        buyPrice: transaction.buyPrice,
        buyCurrency: transaction.buyCurrency,
        sellPrice: transaction.sellPrice,
        sellCurrency: transaction.sellCurrency,
        quantity: transaction.quantity,
        profitOrLoss: transaction.profitOrLoss,
        tax: transaction.tax,
      }));

      // Add transactions and totals
      data.push(...cryptoData);
      data.push({
        crypto,
        date: 'Total',
        buyPrice: '',
        buyCurrency: '',
        sellPrice: '',
        sellCurrency: '',
        quantity: '',
        profitOrLoss: '',
        tax: details.totalTax,
      });

      // Add empty lines for separation
      data.push({}, {});
    });

    const worksheet = xlsx.utils.json_to_sheet(data);

    // Apply styles in parallel using Worker Threads
    const range = xlsx.utils.decode_range(worksheet['!ref']!);
    const promises: Promise<void>[] = [];

    for (let row = range.s.r; row <= range.e.r; row++) {
      promises.push(
        new Promise((resolve) => {
          const worker = new Worker(workerStylePath, {
            execArgv: ['-r', 'ts-node/register'], // Permet d'exécuter TypeScript directement
          });

          worker.on('message', () => {
            worker.terminate(); // Terminate the worker after processing
            resolve();
          });
          worker.postMessage({ row, worksheet });
        })
      );
    }

    Promise.all(promises).then(() => {
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Grouped Taxes');
      xlsx.writeFile(workbook, outputPath);
    });
  }
}