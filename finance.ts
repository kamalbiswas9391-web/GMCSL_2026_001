import { db } from './db.ts';

export function roundMoney(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function assertNonNegative(value: number, fieldName: string): number {
  const rounded = roundMoney(value);
  if (rounded < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }
  return rounded;
}

export function calculateSavingTotals(params: {
  monthlySavingAmount: number;
  previousSavingAmount?: number;
  interest: number;
  fine: number;
}) {
  const monthly = assertNonNegative(params.monthlySavingAmount, 'Monthly Saving Amount');
  const previous = assertNonNegative(params.previousSavingAmount ?? 0, 'Previous Saving Amount');
  const interest = assertNonNegative(params.interest, 'Interest');
  const fine = assertNonNegative(params.fine, 'Fine');
  const totalSaving = roundMoney(monthly + previous + interest + fine);
  return { monthly, previous, interest, fine, totalSaving };
}

export function calculateShareTotal(numberOfShares: number, faceValuePerShare: number) {
  const qty = Math.floor(Number(numberOfShares));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Number of Shares must be a positive whole number.');
  }
  const face = assertNonNegative(faceValuePerShare, 'Face Value per Share');
  if (face <= 0) {
    throw new Error('Face Value per Share must be greater than zero.');
  }
  return {
    numberOfShares: qty,
    faceValuePerShare: face,
    totalShareValue: roundMoney(qty * face),
  };
}

export function calculateLoanBalance(params: {
  loanAmount: number;
  loanRepayment: number;
  interest: number;
  fine: number;
}) {
  const loanAmount = assertNonNegative(params.loanAmount, 'Loan Amount');
  const loanRepayment = assertNonNegative(params.loanRepayment, 'Loan Repayment');
  const interest = assertNonNegative(params.interest, 'Interest');
  const fine = assertNonNegative(params.fine, 'Fine');

  // Per specification: Total Loan Amount = New Loan Amount; Current Loan Balance = Total Loan Amount - Principal Repayment
  const totalLoanAmount = loanAmount;
  const currentLoanBalance = roundMoney(totalLoanAmount - loanRepayment);

  if (currentLoanBalance < 0) {
    throw new Error('Loan repayment cannot exceed total principal loan amount (negative balance prevented).');
  }

  return {
    loanAmount,
    totalLoanAmount,
    loanRepayment,
    interest,
    fine,
    currentLoanBalance,
  };
}

export function getCurrentCashAndBankBalances(): { bankBalance: number; cashBalance: number } {
  const rows = db.prepare('SELECT payment_mode, bank_amount, cash_amount FROM cash_book').all() as Array<{
    payment_mode: string;
    bank_amount: number;
    cash_amount: number;
  }>;

  let bankBalance = 0;
  let cashBalance = 0;
  for (const row of rows) {
    if (row.payment_mode === 'Deposit') {
      bankBalance = roundMoney(bankBalance + Number(row.bank_amount || 0));
      cashBalance = roundMoney(cashBalance + Number(row.cash_amount || 0));
    } else if (row.payment_mode === 'Payment') {
      bankBalance = roundMoney(bankBalance - Number(row.bank_amount || 0));
      cashBalance = roundMoney(cashBalance - Number(row.cash_amount || 0));
    }
  }
  return { bankBalance, cashBalance };
}

export function validateCashBookEntry(params: {
  paymentMode: 'Deposit' | 'Payment';
  bankAmount: number;
  cashAmount: number;
  allowAdjustment?: boolean;
}) {
  const bankAmount = assertNonNegative(params.bankAmount, 'Bank Amount');
  const cashAmount = assertNonNegative(params.cashAmount, 'Cash Amount');
  const totalAmount = roundMoney(bankAmount + cashAmount);

  if (totalAmount <= 0) {
    throw new Error('Total Amount (Bank + Cash) must be greater than zero.');
  }

  const current = getCurrentCashAndBankBalances();
  const nextBank = params.paymentMode === 'Deposit'
    ? roundMoney(current.bankBalance + bankAmount)
    : roundMoney(current.bankBalance - bankAmount);
  const nextCash = params.paymentMode === 'Deposit'
    ? roundMoney(current.cashBalance + cashAmount)
    : roundMoney(current.cashBalance - cashAmount);

  if (!params.allowAdjustment && params.paymentMode === 'Payment') {
    if (nextBank < 0) {
      throw new Error(`Insufficient Bank Balance (Current: ₹${current.bankBalance.toFixed(2)}). Enable authorized adjustment to override.`);
    }
    if (nextCash < 0) {
      throw new Error(`Insufficient Cash Balance (Current: ₹${current.cashBalance.toFixed(2)}). Enable authorized adjustment to override.`);
    }
  }

  return {
    bankAmount,
    cashAmount,
    totalAmount,
    depositAmount: params.paymentMode === 'Deposit' ? totalAmount : 0,
    paymentAmount: params.paymentMode === 'Payment' ? totalAmount : 0,
    bankBalanceAfter: nextBank,
    cashBalanceAfter: nextCash,
    balanceAfter: roundMoney(nextBank + nextCash),
  };
}

export function postFinancialLedger(params: {
  module: string;
  recordId: string;
  memberId?: string;
  entryType: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  description: string;
  idempotencyKey: string;
  createdBy: string;
}) {
  const existing = db.prepare('SELECT id FROM financial_ledger WHERE idempotency_key = ?').get(params.idempotencyKey);
  if (existing) {
    return false;
  }
  const id = `LDG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  db.prepare(
    `INSERT INTO financial_ledger (id, ledger_id, module, record_id, member_id, entry_type, amount, direction, description, idempotency_key, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    id,
    params.module,
    params.recordId,
    params.memberId || '',
    params.entryType,
    roundMoney(params.amount),
    params.direction,
    params.description,
    params.idempotencyKey,
    params.createdBy,
    new Date().toISOString()
  );
  return true;
}
