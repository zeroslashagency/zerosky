'use client';

import { trpc } from '@/lib/trpc';

export function usePrintKot() {
  const utils = trpc.useUtils();
  
  const print = trpc.print.printKot.useMutation({
    onSuccess: () => {
      utils.kot.list.invalidate();
    },
  });

  const reprint = trpc.print.reprintKot.useMutation({
    onSuccess: () => {
      utils.kot.list.invalidate();
    },
  });

  return { print, reprint };
}

export function usePrintBill() {
  return trpc.print.printBill.useMutation();
}

export function useOpenCashDrawer() {
  return trpc.print.openCashDrawer.useMutation();
}

export function useListPrinters() {
  return trpc.print.listPrinters.useQuery({});
}
