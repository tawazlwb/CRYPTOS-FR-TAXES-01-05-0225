const { parentPort } = require("worker_threads");
const xlsx = require("xlsx");

function applyCellStyle(cell, color) {
  if (cell) {
    cell.s = { fill: { fgColor: { rgb: color } } };
  }
}

const CellColors = {
  Profit: "228B22", // Green for profit
  Loss: "FF6347", // Orange for loss
  IndividualTax: "FFD700", // Yellow for individual taxes
  TotalTax: "DC143C", // Red for total taxes
};

parentPort.on("message", ({ row, worksheet }) => {
  const profitOrLossCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 7 })];
  const taxCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 8 })];
  const isTotalRow =
    worksheet[xlsx.utils.encode_cell({ r: row, c: 1 })]?.v === "Total";

  if (profitOrLossCell && profitOrLossCell.v !== "") {
    const profitOrLossValue = parseFloat(profitOrLossCell.v);
    if (!isNaN(profitOrLossValue)) {
      applyCellStyle(
        profitOrLossCell,
        profitOrLossValue >= 0 ? CellColors.Profit : CellColors.Loss
      );
    }
  }

  if (taxCell && taxCell.v !== "" && !isTotalRow) {
    applyCellStyle(taxCell, CellColors.IndividualTax);
  }

  if (isTotalRow) {
    const totalTaxCell = worksheet[xlsx.utils.encode_cell({ r: row, c: 8 })];
    applyCellStyle(totalTaxCell, CellColors.TotalTax);
  }

  parentPort.postMessage("done");
});
