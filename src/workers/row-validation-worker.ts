import { parentPort } from "worker_threads";
import { rowSchema } from "../types";

parentPort?.on("message", ({ row, index }) => {
  const { error, value } = rowSchema.validate(row);

  if (error) {
    parentPort?.postMessage({
      error: `InvalidRow at line ${index}: ${error.details
        .map((d) => d.message)
        .join(", ")}`,
      index,
      row,
    });
  } else {
    parentPort?.postMessage({
      transaction: {
        date: value.date,
        crypto: value.crypto,
        buyPrice: parseFloat(value.buyPrice),
        buyCurrency: value.buyCurrency,
        sellPrice: parseFloat(value.sellPrice),
        sellCurrency: value.sellCurrency,
        quantity: parseFloat(value.quantity),
      },
    });
  }
});
