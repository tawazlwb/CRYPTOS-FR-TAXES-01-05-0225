export interface CryptoTransaction {
  date: string; // Format: YYYY-MM-DD
  crypto: string; // Cryptocurrency name (e.g., BTC, ETH)
  buyPrice: number; // Price at which cryptocurrency was bought
  buyCurrency: string; // Currency of the buy price
  sellPrice: number; // Price at which cryptocurrency was sold
  sellCurrency: string; // Currency of the sell price
  quantity: number; // Quantity of cryptocurrency
}

export interface CryptoDetails {
  transactions: TransactionDetails[];
  totalTax: number;
}

export interface TransactionDetails {
  buyPrice: number;
  buyCurrency: string;
  sellPrice: number;
  sellCurrency: string;
  quantity: number;
  date: string;
  profitOrLoss: number;
  tax: number;
}

export interface CurrencyConversionInterface {
  getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number>;
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string, date?: string): Promise<number>;
}

export interface TaxCalculator {
  calculateCryptoTaxes(transactions: CryptoTransaction[]): Promise<{ [crypto: string]: CryptoDetails }>;
}

export interface CurrencyConversionInterface {
  getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number>;
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string, date?: string): Promise<number>;
}

// export enum CellColors {
//   Profit = '228B22', // Green for profit
//   Loss = 'FF6347', // Orange for loss
//   IndividualTax = 'FFD700', // Yellow for individual taxes
//   TotalTax = 'DC143C', // Red for total taxes
// }