import axios from 'axios';
import Bottleneck from 'bottleneck';
import fs from 'fs';
import { Mutex } from 'async-mutex';
import crypto from 'crypto';

import { CurrencyConversionInterface } from '../types';

// Create a rate limiter instance
const limiter = new Bottleneck({
  minTime: 100, // Minimum time between requests in milliseconds (1 request per second)
  maxConcurrent: 1, // Only one request at a time
});

// Create a mutex for synchronizing log writes
const logMutex = new Mutex();

// Updated helper function to log data to the file with parallel handling
async function logToFile(logFilePath: string, data: string, hashId?: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `====================\nTimestamp: ${timestamp}\nHash ID: ${hashId || 'N/A'}\nDetails: ${data}\n====================\n\n`;

  await logMutex.runExclusive(async () => {
    try {
      fs.appendFileSync(logFilePath, logEntry, 'utf8');
    } catch (error) {
      console.error(`Failed to write log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

export class ECBConversionProvider implements CurrencyConversionInterface {
  private static BASE_URL = 'https://api.exchangeratesapi.io';
  private logFilePath: string;

  constructor(logFilePath: string) {
    this.logFilePath = logFilePath;
  }

  // Updated limitedGet to include hash ID for request-response linking
  private async limitedGet(url: string, params: Record<string, string>): Promise<any> {
    const hashId = crypto.randomBytes(8).toString('hex');
    try {
      logToFile(this.logFilePath, `Request: URL=${url}, Params=${JSON.stringify(params)}`, hashId);
      const response = await limiter.schedule(() => axios.get(url, { params }));
      logToFile(this.logFilePath, `Response: ${JSON.stringify(response.data)}`, hashId);
      return response;
    } catch (error) {
      logToFile(this.logFilePath, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, hashId);
      throw error;
    }
  }

  /**
   * Fetches the exchange rate for a given currency pair and date.
   * @param fromCurrency The currency to convert from (e.g., 'USD').
   * @param toCurrency The currency to convert to (e.g., 'EUR').
   * @param date The date for historical rates (optional, defaults to latest).
   * @returns The exchange rate as a number.
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number> {
    try {
      const endpoint = date ? `${ECBConversionProvider.BASE_URL}/${date}` : `${ECBConversionProvider.BASE_URL}/latest`;
      const response = await this.limitedGet(endpoint, {
        base: fromCurrency,
        symbols: toCurrency,
      });

      if (response.data && response.data.rates && response.data.rates[toCurrency]) {
        return response.data.rates[toCurrency];
      } else {
        throw new Error('Exchange rate not found in response.');
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching exchange rate: ${error.message}`);
      } else {
        console.error('Error fetching exchange rate: Unknown error');
      }
      throw new Error('Failed to fetch exchange rate.');
    }
  }

  /**
   * Converts an amount from one currency to another for a specific date.
   * @param amount The amount to convert.
   * @param fromCurrency The currency to convert from (e.g., 'USD').
   * @param toCurrency The currency to convert to (e.g., 'EUR').
   * @param date The date for historical rates (optional, defaults to latest).
   * @returns The converted amount as a number.
   */
  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string, date?: string): Promise<number> {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency, date);
    return amount * exchangeRate;
  }
}