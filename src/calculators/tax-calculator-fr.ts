import { ECBConversionProvider } from '../currencies';
import { CryptoDetails, CryptoTransaction, CurrencyConversionInterface } from '../types';

const BASE_CURRENCY = 'EUR'; // Global variable for base currency

export interface TaxCalculator {
  calculateCryptoTaxes(transactions: CryptoTransaction[]): Promise<{ [crypto: string]: CryptoDetails }>;
}

export function createTaxCalculator(logFilePath : string , currency :string = BASE_CURRENCY): TaxCalculator {
  const conversionProvider: CurrencyConversionInterface = new ECBConversionProvider(logFilePath);
  return createFrTaxCalculator(conversionProvider, currency);
}

export function createFrTaxCalculator(conversionProvider: CurrencyConversionInterface, currency :string): TaxCalculator {
  return {
    async calculateCryptoTaxes(transactions: CryptoTransaction[]): Promise<{ [crypto: string]: CryptoDetails }> {
      const flatTaxRate = 0.30; // 30% tax rate in France
      const cryptoDetails: { [crypto: string]: CryptoDetails } = {};

      for (const transaction of transactions) {
        let buyPriceInBaseCurrency = transaction.buyPrice;
        let sellPriceInBaseCurrency = transaction.sellPrice;

        if (transaction.buyCurrency !== currency) {
          buyPriceInBaseCurrency = await conversionProvider.convertCurrency(
            transaction.buyPrice,
            transaction.buyCurrency,
            currency,
            transaction.date
          );
        }

        if (transaction.sellCurrency !== currency) {
          sellPriceInBaseCurrency = await conversionProvider.convertCurrency(
            transaction.sellPrice,
            transaction.sellCurrency,
            currency,
            transaction.date
          );
        }

        const profitOrLoss = (sellPriceInBaseCurrency - buyPriceInBaseCurrency) * transaction.quantity;
        const tax = profitOrLoss > 0 ? profitOrLoss * flatTaxRate : 0;

        if (!cryptoDetails[transaction.crypto]) {
          cryptoDetails[transaction.crypto] = {
            transactions: [],
            totalTax: 0,
          };
        }

        cryptoDetails[transaction.crypto].transactions.push({
          date: transaction.date,
          buyPrice: transaction.buyPrice,
          buyCurrency: transaction.buyCurrency,
          sellPrice: transaction.sellPrice,
          sellCurrency: transaction.sellCurrency,
          quantity: transaction.quantity,
          profitOrLoss,
          tax,
        });

        cryptoDetails[transaction.crypto].totalTax += tax;
      }

      return cryptoDetails;
    },
  };
}
