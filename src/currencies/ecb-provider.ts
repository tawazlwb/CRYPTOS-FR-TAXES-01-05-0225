import axios from 'axios';
import Bottleneck from 'bottleneck';

import { CurrencyConversionInterface } from '../types';

// Create a rate limiter instance
const limiter = new Bottleneck({
  minTime: 100, // Minimum time between requests in milliseconds (1 request per second)
  maxConcurrent: 1, // Only one request at a time
});

export class ECBConversionProvider implements CurrencyConversionInterface {
  private static BASE_URL = 'https://api.exchangeratesapi.io';

  // Wrap the axios.get call with the rate limiter
  private async limitedGet(url: string, params: Record<string, string>): Promise<any> {
    return limiter.schedule(() => axios.get(url, { params }));
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