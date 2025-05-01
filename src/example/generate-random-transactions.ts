import * as xlsx from 'xlsx';
import { CryptoTransaction } from '../types';

export function generateRandomCryptoTransactions(outputPath: string): void {
  const cryptocurrencies = ["Bitcoin", "Ethereum", "Ripple", "Litecoin", "Cardano"];
  const minTransactions = 3;
  const maxTransactions = 7;

  const transactions: CryptoTransaction[] = [];

  cryptocurrencies.forEach((crypto) => {
    const numTransactions = Math.floor(Math.random() * (maxTransactions - minTransactions + 1)) + minTransactions;

    // Randomly decide if a single currency will be used for all prices in this batch of transactions
    const useSingleCurrency = Math.random() < 0.5;
    const singleCurrency = useSingleCurrency ? ["USD", "EUR"][Math.floor(Math.random() * 2)] : null;

    for (let i = 0; i < numTransactions; i++) {
      const date = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000));
      const buyPrice = (Math.random() * 50000 + 1000).toFixed(2); // Random buy price between 1000 and 51000
      const sellPrice = (parseFloat(buyPrice) + Math.random() * 2000 - 1000).toFixed(2); // Random sell price within +/- 1000 of buy price
      const quantity = (Math.random() * 5).toFixed(2); // Random quantity between 0 and 5

      // Determine currencies for this transaction
      const currencies = ["USD", "EUR"];
      const buyCurrency = singleCurrency || currencies[Math.floor(Math.random() * currencies.length)];
      const sellCurrency = singleCurrency || (Math.random() < 0.5 ? buyCurrency : currencies[Math.floor(Math.random() * currencies.length)]);

      transactions.push({
        date: date.toISOString().split('T')[0],
        crypto: crypto,
        buyPrice: parseFloat(buyPrice),
        buyCurrency: buyCurrency,
        sellPrice: parseFloat(sellPrice),
        sellCurrency: sellCurrency,
        quantity: parseFloat(quantity)
      });
    }
  });

  const worksheet = xlsx.utils.json_to_sheet(transactions);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Transactions");
  xlsx.writeFile(workbook, outputPath);

  console.log(`Fichier XLSX généré avec succès : ${outputPath}`);
}

// Chemin de sortie pour le fichier généré
const outputPath = './transactions.xlsx';

// Exécution de la fonction pour générer des transactions aléatoires
generateRandomCryptoTransactions(outputPath);

