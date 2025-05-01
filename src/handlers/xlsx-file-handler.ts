import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as winston from 'winston';
import * as Joi from 'joi';
import { Worker } from 'worker_threads';

import { CellColors, CryptoDetails, CryptoTransaction, TransactionDetails } from "../types";

// Define a logger instance using winston
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
  ],
});

// Define a schema for row validation using Joi
const rowSchema = Joi.object({
  date: Joi.string().trim().required(),
  crypto: Joi.string().trim().required(),
  buyPrice: Joi.string().trim().regex(/^[0-9]+(\.[0-9]+)?$/).required(),
  buyCurrency: Joi.string().trim().required(),
  sellPrice: Joi.string().trim().regex(/^[0-9]+(\.[0-9]+)?$/).required(),
  sellCurrency: Joi.string().trim().required(),
  quantity: Joi.string().trim().regex(/^[0-9]+(\.[0-9]+)?$/).required(),
});

export class XlsxFileHandler {
  static readonly EXCEL_START_LINE = 2; // Excel rows start at 1, plus header row

  static validateRow(row: any, index: number): CryptoTransaction {
    const { error, value } = rowSchema.validate(row);

    if (error) {
      throw new Error(`InvalidRow: ${error.details.map((d) => d.message).join(', ')}`);
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

  static async readTransactionsFromExcel(filePath: string): Promise<CryptoTransaction[]> {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const transactions: CryptoTransaction[] = [];
    const errors: any[] = [];

    // Process rows in parallel using Worker Threads
    const promises = data.map((row: any, index: number) => {
      return new Promise<void>((resolve) => {
        const worker = new Worker(`
          const { parentPort } = require('worker_threads');
          const Joi = require('joi');

          const rowSchema = ${rowSchema.toString()};

          parentPort.on('message', ({ row, index }) => {
            const { error, value } = rowSchema.validate(row);
            if (error) {
              parentPort.postMessage({ error: error.details.map((d) => d.message).join(', '), index, row });
            } else {
              parentPort.postMessage({ transaction: {
                date: value.date,
                crypto: value.crypto,
                buyPrice: parseFloat(value.buyPrice),
                buyCurrency: value.buyCurrency,
                sellPrice: parseFloat(value.sellPrice),
                sellCurrency: value.sellCurrency,
                quantity: parseFloat(value.quantity),
              } });
            }
          });
        `, { eval: true });

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

  static applyCellStyle(cell: any, color: string): void {
    if (cell) {
      cell.s = { fill: { fgColor: { rgb: color } } };
    }
  }

  static writeGroupedTaxesToExcel(
    cryptoDetails: { [crypto: string]: CryptoDetails },
    outputPath: string,
    transactions: CryptoTransaction[]
  ): void {
    const data: any[] = [];

    for (const crypto in cryptoDetails) {
      cryptoDetails[crypto].transactions.forEach((transaction: TransactionDetails) => {
        data.push({
          crypto,
          date: transaction.date,
          buyPrice: transaction.buyPrice,
          buyCurrency: transaction.buyCurrency,
          sellPrice: transaction.sellPrice,
          sellCurrency: transaction.sellCurrency,
          quantity: transaction.quantity,
          profitOrLoss: transaction.profitOrLoss,
          tax: transaction.tax,
        });
      });

      data.push({
        crypto,
        date: 'Total',
        buyPrice: '',
        buyCurrency: '',
        sellPrice: '',
        sellCurrency: '',
        quantity: '',
        profitOrLoss: '',
        tax: cryptoDetails[crypto].totalTax,
      });

      // Add two empty lines between each crypto section
      data.push({}, {});
    }

    const worksheet = xlsx.utils.json_to_sheet(data);

    // Apply styles for profitOrLoss, tax, and total taxes
    const range = xlsx.utils.decode_range(worksheet['!ref']!);
    for (let row = range.s.r; row <= range.e.r; row++) {
      const profitOrLossCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 7 })]; // Column for profitOrLoss
      const taxCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 8 })]; // Column for tax

      if (profitOrLossCell && profitOrLossCell.v !== '') {
        const profitOrLossValue = parseFloat(profitOrLossCell.v);
        if (!isNaN(profitOrLossValue)) {
          XlsxFileHandler.applyCellStyle(
            profitOrLossCell,
            profitOrLossValue >= 0 ? CellColors.Profit : CellColors.Loss
          );
        }
      }

      if (taxCell && taxCell.v !== '' && worksheet[xlsx.utils.encode_cell({ r: row, c: 1 })]?.v !== 'Total') {
        XlsxFileHandler.applyCellStyle(taxCell, CellColors.IndividualTax);
      }

      if (worksheet[xlsx.utils.encode_cell({ r: row, c: 1 })]?.v === 'Total') {
        const totalTaxCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 8 })]; // Column for total tax
        XlsxFileHandler.applyCellStyle(totalTaxCell, CellColors.TotalTax);
      }
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Grouped Taxes');
    xlsx.writeFile(workbook, outputPath);
  }
}