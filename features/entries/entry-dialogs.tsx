"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ActivityDialog, type ActivityDialogState } from "./activity-dialog";
import { TransactionDialog, type TransactionDialogState } from "./transaction-dialog";

type EntryDialogs = {
  openActivity: (state: ActivityDialogState) => void;
  openTransaction: (state: TransactionDialogState) => void;
};

const EntryDialogsContext = createContext<EntryDialogs | null>(null);

/** Hosts the activity and transaction dialogs so any screen can open them. */
export function EntryDialogsProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<ActivityDialogState | null>(null);
  const [transaction, setTransaction] = useState<TransactionDialogState | null>(null);

  const openActivity = useCallback((state: ActivityDialogState) => {
    setTransaction(null);
    setActivity(state);
  }, []);
  const openTransaction = useCallback((state: TransactionDialogState) => {
    setActivity(null);
    setTransaction(state);
  }, []);

  const value = useMemo(() => ({ openActivity, openTransaction }), [openActivity, openTransaction]);

  return (
    <EntryDialogsContext value={value}>
      {children}
      <ActivityDialog state={activity} onClose={() => setActivity(null)} />
      <TransactionDialog state={transaction} onClose={() => setTransaction(null)} />
    </EntryDialogsContext>
  );
}

export function useEntryDialogs(): EntryDialogs {
  const context = useContext(EntryDialogsContext);
  if (!context) throw new Error("useEntryDialogs must be used inside <EntryDialogsProvider>");
  return context;
}
