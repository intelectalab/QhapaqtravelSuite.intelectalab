import type { ReactNode } from "react";
import { OpenRowsBody } from "@/components/table/OpenRowsBody";
import { cn } from "@/lib/cn";

export interface SimpleColumn {
  header: string;
  align?: "left" | "right";
  className?: string;
}

export function SimpleTable({ columns, rows, empty, footer, testId }: { columns: SimpleColumn[]; rows: { key: string; cells: ReactNode[]; muted?: boolean }[]; empty: string; footer?: ReactNode[]; testId?: string }) {
  if (rows.length === 0) {
    return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">{empty}</p>;
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-[14px] border border-line" data-testid={testId}>
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="bg-surface-2/60 text-left text-[12px] text-fg-3">
            {columns.map((column) => (
              <th key={column.header} className={cn("px-3.5 py-2.5 font-semibold", column.align === "right" && "text-right", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <OpenRowsBody>
          {rows.map((row) => (
            <tr key={row.key} className={cn("border-t border-line-2", row.muted && "opacity-55")}>
              {row.cells.map((cell, index) => (
                <td key={index} className={cn("px-3.5 py-2.5 align-top", columns[index]?.align === "right" && "text-right font-mono")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </OpenRowsBody>
        {footer && (
          <tfoot>
            <tr className="border-t-2 border-line bg-surface-2/40 font-semibold">
              {footer.map((cell, index) => (
                <td key={index} className={cn("px-3.5 py-2.5", columns[index]?.align === "right" && "text-right font-mono")}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
