
import { parentPort } from "worker_threads";
import * as xlsx from "xlsx";
import { Cell, CellColors } from "../types";

const applyCellStyle = (cell: Cell | undefined, color: string): void => {
  if (cell) {
    cell.s = { fill: { fgColor: { rgb: color } } };
  }
}

parentPort?.on("message", ({ row, worksheet }) => {
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

  parentPort?.postMessage("done");
});
