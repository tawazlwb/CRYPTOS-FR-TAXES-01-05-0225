const { parentPort } = require("worker_threads");
const Joi = require("joi");

// Define a schema for row validation using Joi
const rowSchema = Joi.object({
  date: Joi.string().trim().required(),
  crypto: Joi.string().trim().required(),
  buyPrice: Joi.number()
    .required(),
  buyCurrency: Joi.string().trim().required(),
  sellPrice: Joi.number()
    .required(),
  sellCurrency: Joi.string().trim().required(),
  quantity: Joi.number()
    .required(),
});

parentPort.on("message", ({ row, index }) => {
  const { error, value } = rowSchema.validate(row);

  if (error) {
    parentPort.postMessage({
      error: `InvalidRow at line ${index}: ${error.details
        .map((d) => d.message)
        .join(", ")}`,
      index,
      row,
    });
  } else {
    parentPort.postMessage({
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
