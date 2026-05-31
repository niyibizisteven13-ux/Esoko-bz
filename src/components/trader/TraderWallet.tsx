import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
} from '../../services/firestoreBridge';
import WalletComponent from '../WalletComponent';
import { useLanguage } from '../../context/LanguageContext';

interface TraderWalletProps {
  balance: number;
  userId: string;
  transactions: any[];
  tier?: 'free' | 'premium';
}

export default function TraderWallet({ balance, userId, transactions, tier }: TraderWalletProps) {
  const { t } = useLanguage();

  return (
    <WalletComponent
      balance={balance}
      userId={userId}
      transactions={transactions}
      title={t.trader.traderWallet}
      tier={tier}
    />
  );
}
