"use client";
import * as React from "react";

export const Table = ({ className = "", ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <table className={`w-full text-sm ${className}`} {...props} />
)
export const TableHeader = ({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={className} {...props} />
)
export const TableHead = ({ className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={`text-left py-2 px-3 border-b ${className}`} {...props} />
)
export const TableBody = ({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={className} {...props} />
)
export const TableRow = ({ className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={`border-b last:border-0 ${className}`} {...props} />
)
export const TableCell = ({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`py-2 px-3 ${className}`} {...props} />
)
export default Table;
