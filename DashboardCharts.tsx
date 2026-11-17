import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SyncPullSnapshot } from '../offline/syncEngine';

interface DashboardChartsProps {
  snapshot: SyncPullSnapshot;
  mode: 'system' | 'president' | 'secretary';
}

const COLORS = ['#087443', '#142D4E', '#D5A642', '#2563EB', '#16A34A', '#DC2626'];

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ snapshot, mode }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const inRange = (d: string) => {
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; savings: number; loans: number; repayments: number; income: number; expense: number }> = {};
    const touch = (m: string) => {
      const key = m.slice(0, 7) || 'Unknown';
      if (!map[key]) map[key] = { month: key, savings: 0, loans: 0, repayments: 0, income: 0, expense: 0 };
      return map[key];
    };
    for (const s of snapshot.savings) {
      if (!inRange(s.date)) continue;
      const b = touch(s.date);
      b.savings += Number(s.totalSaving || 0);
      b.income += Number(s.totalSaving || 0);
    }
    for (const l of snapshot.loans) {
      if (!inRange(l.loanDate)) continue;
      const b = touch(l.loanDate);
      b.loans += Number(l.loanAmount || 0);
      b.repayments += Number(l.loanRepayment || 0);
      b.income += Number(l.interest || 0) + Number(l.fine || 0);
    }
    for (const cb of snapshot.cashBook) {
      if (!inRange(cb.date)) continue;
      const b = touch(cb.date);
      if (cb.paymentMode === 'Deposit') b.income += Number(cb.totalAmount || 0);
      else b.expense += Number(cb.totalAmount || 0);
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [snapshot, dateFrom, dateTo]);

  const memberGrowthData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of snapshot.members) {
      if (!inRange(m.joinDate)) continue;
      const k = (m.joinDate || '').slice(0, 7) || 'Unknown';
      map[k] = (map[k] || 0) + 1;
    }
    let running = 0;
    return Object.keys(map)
      .sort()
      .map((month) => {
        running += map[month];
        return { month, newMembers: map[month], totalMembers: running };
      });
  }, [snapshot.members, dateFrom, dateTo]);

  const loanDistData = useMemo(() => {
    const counts = { Active: 0, Running: 0, Close: 0, Inactive: 0 };
    for (const l of snapshot.loans) {
      if (!inRange(l.loanDate)) continue;
      const st = l.loanStatus as keyof typeof counts;
      if (counts[st] !== undefined) counts[st] += 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [snapshot.loans, dateFrom, dateTo]);

  const paymentStatusData = useMemo(() => {
    const counts = { Verified: 0, Pending: 0, Rejected: 0 };
    for (const p of snapshot.onlinePayments) {
      if (!inRange(p.date)) continue;
      const st = p.verificationStatus as keyof typeof counts;
      if (counts[st] !== undefined) counts[st] += 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [snapshot.onlinePayments, dateFrom, dateTo]);

  const cashBankData = [
    { name: 'Bank Balance', amount: snapshot.stats.totalBankBalance },
    { name: 'Cash Balance', amount: snapshot.stats.totalCashBalance },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">
          Financial & Operations Analytics
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-slate-500">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          <label className="text-slate-500">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Savings Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Monthly Savings Collection</h4>
          <div className="h-64">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No saving entries recorded in selected range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="savings" name="Savings (₹)" fill="#087443" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Loan Disbursed vs Repayment Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Loan Disbursed vs Repayment</h4>
          <div className="h-64">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No loan transactions recorded in selected range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="loans" name="Disbursed (₹)" fill="#142D4E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="repayments" name="Repaid (₹)" fill="#D5A642" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cash & Bank Balance Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Cash & Bank Balance</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashBankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="amount" name="Balance (₹)" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Distribution Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Loan Status Distribution</h4>
          <div className="h-64">
            {loanDistData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No loan records available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={loanDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                    {loanDistData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {mode === 'system' && (
          <>
            {/* Member Growth Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Member Growth Trend</h4>
              <div className="h-64">
                {memberGrowthData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No members registered yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={memberGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="totalMembers" name="Total Members" stroke="#087443" fill="#087443" fillOpacity={0.18} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Income vs Expense & Payment Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-[#142D4E] dark:text-white mb-4">Monthly Income vs Expense & Payment Status</h4>
              <div className="h-64">
                {monthlyData.length === 0 && paymentStatusData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No income/expense transactions yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="income" name="Income (₹)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expense (₹)" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
