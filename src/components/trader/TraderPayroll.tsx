import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  runTransaction,
  increment,
} from '../../services/firestoreBridge';
const db = undefined; // Used by firestoreBridge
import {
  Users,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  X,
  Zap,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, toMillis, cn } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useLanguage } from '../../context/LanguageContext';

export default function TraderPayroll({ traderId }: { traderId: string }) {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [activeView, setActiveView] = useState<'records' | 'employees'>('records');

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    position: '',
    baseSalary: 0,
    tin: '',
    phone: '',
  });

  const [newRecord, setNewRecord] = useState({
    employeeId: '',
    employeeName: '',
    baseSalary: 0,
    commissions: 0,
    bonuses: 0,
    taxes: 0,
  });

  useEffect(() => {
    const qPayroll = query(collection(db, 'payroll'), where('traderId', '==', traderId));
    const unsubPayroll = onSnapshot(
      qPayroll,
      (snapshot) => {
        setPayrollRecords(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('Trader payroll listener error:', err);
      }
    );

    const qEmployees = query(collection(db, 'employees'), where('traderId', '==', traderId));
    const unsubEmployees = onSnapshot(
      qEmployees,
      (snapshot) => {
        setEmployees(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error('Trader employees listener error:', err);
      }
    );

    return () => {
      unsubPayroll();
      unsubEmployees();
    };
  }, [traderId]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'employees'), {
        traderId,
        ...newEmployee,
        createdAt: Timestamp.now(),
      });
      setShowEmployeeModal(false);
      setNewEmployee({ name: '', position: '', baseSalary: 0, tin: '', phone: '' });
    } catch (error) {
      console.error('Error adding employee:', error);
    }
  };

  const calculateNetSalary = (record: typeof newRecord) => {
    return record.baseSalary + record.commissions + record.bonuses - record.taxes;
  };

  const handleAddPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const netSalary = calculateNetSalary(newRecord);

    try {
      await addDoc(collection(db, 'payroll'), {
        traderId,
        employeeId: newRecord.employeeId,
        employeeName: newRecord.employeeName,
        baseSalary: newRecord.baseSalary,
        commissions: newRecord.commissions,
        bonuses: newRecord.bonuses,
        taxes: newRecord.taxes,
        netSalary,
        status: 'unpaid',
        month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        timestamp: Timestamp.now(),
      });

      setShowAddModal(false);
      setNewRecord({
        employeeId: '',
        employeeName: '',
        baseSalary: 0,
        commissions: 0,
        bonuses: 0,
        taxes: 0,
      });
    } catch (error) {
      console.error('Error adding payroll:', error);
    }
  };

  const handleSelectEmployee = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      setNewRecord({
        ...newRecord,
        employeeId: emp.id,
        employeeName: emp.name,
        baseSalary: emp.baseSalary || 0,
      });
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const payrollRef = doc(db, 'payroll', id);
        const payrollSnap = await transaction.get(payrollRef);

        if (!payrollSnap.exists()) throw new Error('Payroll record not found');

        const record = payrollSnap.data();
        if (record.status === 'paid') throw new Error('Salary already paid');

        const traderRef = doc(db, 'users', traderId);
        const traderSnap = await transaction.get(traderRef);

        if (!traderSnap.exists()) throw new Error('Trader not found');

        const balance = traderSnap.data().walletBalance || 0;
        if (balance < record.netSalary) {
          throw new Error('Insufficient wallet balance to pay this salary');
        }

        // Deduct from trader wallet
        transaction.update(traderRef, {
          walletBalance: increment(-record.netSalary),
        });

        // Update payroll status
        transaction.update(payrollRef, { status: 'paid' });

        // Record transaction
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: traderId,
          amount: record.netSalary,
          type: 'payroll',
          status: 'completed',
          category: 'business',
          employeeName: record.employeeName,
          month: record.month,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      console.error('Payroll payment error:', err);
    }
  };

  const generatePayslip = (record: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Bwenge PAYSLIP', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Employee: ${record.employeeName}`, 20, 40);
    doc.text(`Month: ${record.month}`, 20, 50);
    doc.text(`Status: ${record.status.toUpperCase()}`, 20, 60);

    const tableData = [
      ['Description', 'Amount (RWF)'],
      ['Base Salary', formatCurrency(record.baseSalary)],
      ['Commissions', formatCurrency(record.commissions)],
      ['Bonuses', formatCurrency(record.bonuses)],
      ['Taxes', `-${formatCurrency(record.taxes)}`],
      ['Net Salary', formatCurrency(record.netSalary)],
    ];

    autoTable(doc, {
      startY: 70,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
    });

    doc.save(`payslip_${record.employeeName}_${record.month}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">{t.team.payroll}</h2>
          <p className="text-neutral-500 font-medium">
            Manage employee salaries and generate payslips
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowEmployeeModal(true)}
            className="px-6 py-3 bg-white text-neutral-900 border-2 border-neutral-100 rounded-2xl font-bold flex items-center gap-2 hover:border-orange-600 transition-all shadow-sm"
          >
            <Plus size={20} className="text-orange-600" /> Add Employee
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
          >
            <Plus size={20} /> Create Payroll
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveView('records')}
          className={cn(
            'px-6 py-2 rounded-xl font-bold text-sm transition-all',
            activeView === 'records'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          )}
        >
          Payroll Records
        </button>
        <button
          onClick={() => setActiveView('employees')}
          className={cn(
            'px-6 py-2 rounded-xl font-bold text-sm transition-all',
            activeView === 'employees'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          )}
        >
          Employee Directory
        </button>
      </div>

      {activeView === 'records' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-50 shadow-sm">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Users size={28} />
              </div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                {t.team.members}
              </p>
              <p className="text-3xl font-black text-neutral-900">
                {new Set(payrollRecords.map((r) => r.employeeName)).size}
              </p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-50 shadow-sm">
              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <DollarSign size={28} />
              </div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                Total Monthly Payout
              </p>
              <p className="text-3xl font-black text-neutral-900">
                RWF {formatCurrency(payrollRecords.reduce((acc, r) => acc + r.netSalary, 0))}
              </p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-50 shadow-sm">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={28} />
              </div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">
                Unpaid Salaries
              </p>
              <p className="text-3xl font-black text-neutral-900">
                {payrollRecords.filter((r) => r.status === 'unpaid').length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50/50 border-b border-neutral-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {t.common.name}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {t.common.monthly}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      Net Salary
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {t.common.status}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-widest text-right">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payrollRecords
                    .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))
                    .map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-neutral-50/50 transition-colors group"
                      >
                        <td className="px-8 py-5">
                          <p className="font-black text-neutral-900">{record.employeeName}</p>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-neutral-500">
                          {record.month}
                        </td>
                        <td className="px-8 py-5 font-black text-orange-600">
                          RWF {formatCurrency(record.netSalary)}
                        </td>
                        <td className="px-8 py-5">
                          <span
                            className={cn(
                              'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border',
                              record.status === 'paid'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                            )}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-end gap-2">
                            {record.status === 'unpaid' && (
                              <button
                                onClick={() => handleMarkAsPaid(record.id)}
                                className="p-2.5 text-green-600 hover:bg-green-50 rounded-xl transition-all"
                                title="Mark as Paid"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            )}
                            <button
                              onClick={() => generatePayslip(record)}
                              className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Download Payslip"
                            >
                              <FileText size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 relative group"
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black text-2xl mb-6">
                {employee.name?.[0] || 'E'}
              </div>
              <h5 className="text-xl font-black text-neutral-900 mb-1">{employee.name}</h5>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">
                {employee.position || 'Employee'}
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-neutral-400 uppercase tracking-widest">Base Salary</span>
                  <span className="text-neutral-900">
                    RWF {formatCurrency(employee.baseSalary)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-neutral-400 uppercase tracking-widest">TIN</span>
                  <span className="text-neutral-900 uppercase tracking-widest">
                    {employee.tin || '---'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  handleSelectEmployee(employee.id);
                  setShowAddModal(true);
                }}
                className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
              >
                <Zap size={16} /> Create Payroll
              </button>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-neutral-200">
              <Users size={48} className="mx-auto text-neutral-200 mb-4" />
              <p className="text-neutral-400 font-bold">
                No employees found. Add your first employee to start.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showEmployeeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl border-2 border-neutral-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-neutral-900">Add Employee</h3>
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition-all"
                >
                  <X size={24} className="text-neutral-400" />
                </button>
              </div>
              <form onSubmit={handleAddEmployee} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                    Position
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                    className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    placeholder="Sales Manager"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                    Base Salary (RWF)
                  </label>
                  <input
                    type="number"
                    required
                    value={newEmployee.baseSalary}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, baseSalary: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      TIN
                    </label>
                    <input
                      type="text"
                      value={newEmployee.tin}
                      onChange={(e) => setNewEmployee({ ...newEmployee, tin: e.target.value })}
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 mt-4"
                >
                  Save Employee
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Payroll Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-10 w-full max-w-xl shadow-2xl border-2 border-neutral-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-neutral-900">Create Payroll Record</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition-all"
                >
                  <X size={24} className="text-neutral-400" />
                </button>
              </div>
              <form onSubmit={handleAddPayroll} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                    Select Employee
                  </label>
                  <select
                    required
                    value={newRecord.employeeId}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                  >
                    <option value="">Choose an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      Base Salary
                    </label>
                    <input
                      type="number"
                      required
                      value={newRecord.baseSalary}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, baseSalary: Number(e.target.value) })
                      }
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      Commissions
                    </label>
                    <input
                      type="number"
                      value={newRecord.commissions}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, commissions: Number(e.target.value) })
                      }
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      Bonuses
                    </label>
                    <input
                      type="number"
                      value={newRecord.bonuses}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, bonuses: Number(e.target.value) })
                      }
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                      Taxes / Deductions
                    </label>
                    <input
                      type="number"
                      value={newRecord.taxes}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, taxes: Number(e.target.value) })
                      }
                      className="w-full px-6 py-4 bg-[#111] border border-white/10 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-white placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-black text-orange-900 uppercase tracking-widest">
                      Calculated Net Salary
                    </p>
                    <p className="text-2xl font-black text-orange-600">
                      RWF {formatCurrency(calculateNetSalary(newRecord))}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                >
                  Confirm & Save Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
