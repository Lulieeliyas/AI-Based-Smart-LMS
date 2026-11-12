import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';
import './FineManagement.css';

const unwrap = (value) => {
  const data = value?.data ?? value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};
const money = (value) => `ETB ${Number(value || 0).toFixed(2)}`;
const dateText = (value) => value ? new Date(value).toLocaleDateString() : '—';

export default function FineManagement() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const response = await borrowingService.getAllBorrowings();
      setRecords(unwrap(response));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load borrowing and fine records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const finedRecords = useMemo(() => records.filter((record) => Number(record.fine || 0) > 0), [records]);
  const visible = useMemo(() => finedRecords.filter((record) => {
    const book = record.book?.title || '';
    const member = record.username || '';
    const matchesQuery = `${book} ${member} ${record.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || record.status === filter;
    return matchesQuery && matchesFilter;
  }), [finedRecords, query, filter]);
  const total = finedRecords.reduce((sum, record) => sum + Number(record.fine || 0), 0);
  const outstanding = finedRecords.filter((record) => record.status !== 'returned').reduce((sum, record) => sum + Number(record.fine || 0), 0);

  const exportCsv = () => {
    const rows = [
      ['Borrow ID', 'Member', 'Book', 'Issue date', 'Due date', 'Return date', 'Status', 'Recorded fine (ETB)'],
      ...visible.map((record) => [record.id, record.username, record.book?.title || '', record.issue_date, record.due_date, record.return_date || '', record.status, record.fine]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'library-fine-records.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="fine-page">
      <div className="fine-page-heading">
        <div><span className="fine-eyebrow">LIBRARY OPERATIONS</span><h1>Fine management</h1><p>Review fine amounts recorded on borrowing transactions.</p></div>
        <div className="fine-heading-actions"><button className="fine-button secondary" onClick={load} disabled={loading}><i className="bi bi-arrow-clockwise" /> Refresh</button><button className="fine-button primary" onClick={exportCsv} disabled={!visible.length}><i className="bi bi-download" /> Export CSV</button></div>
      </div>
      <div className="fine-notice"><i className="bi bi-info-circle" /><span>These totals come from the existing borrowing records. Payment tracking and fine settlement are not currently implemented in this project, so this page does not mark fines as paid.</span></div>
      <section className="fine-summary">
        <article><span>Total recorded fines</span><strong>{money(total)}</strong><small>{finedRecords.length} borrowing records</small></article>
        <article><span>On active / overdue loans</span><strong>{money(outstanding)}</strong><small>Records not yet returned</small></article>
        <article><span>Returned with a fine</span><strong>{finedRecords.filter((r) => r.status === 'returned').length}</strong><small>Returned borrowing records</small></article>
      </section>
      <section className="fine-table-panel">
        <div className="fine-table-heading"><div><h2>Fine records</h2><p>Search and filter recorded fines.</p></div><span className="fine-count">{visible.length} records</span></div>
        <div className="fine-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search member, book or borrowing ID" aria-label="Search fine records" /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by borrowing status"><option value="all">All statuses</option><option value="issued">Issued</option><option value="overdue">Overdue</option><option value="returned">Returned</option></select></div>
        {loading ? <div className="fine-empty">Loading fine records…</div> : visible.length ? <div className="fine-table-scroll"><table className="fine-table"><thead><tr><th>Member</th><th>Book</th><th>Due date</th><th>Return date</th><th>Status</th><th>Fine</th></tr></thead><tbody>{visible.map((record) => <tr key={record.id}><td><strong>{record.username || `Member #${record.user}`}</strong><small>Borrow #{record.id}</small></td><td>{record.book?.title || 'Book record'}</td><td>{dateText(record.due_date)}</td><td>{dateText(record.return_date)}</td><td><span className={`fine-status ${String(record.status).toLowerCase()}`}>{record.status}</span></td><td className="fine-amount">{money(record.fine)}</td></tr>)}</tbody></table></div> : <div className="fine-empty"><i className="bi bi-receipt" /><strong>No fine records found</strong><span>{finedRecords.length ? 'Try changing your search or status filter.' : 'No borrowing records currently contain a fine amount.'}</span></div>}
      </section>
      <Link className="fine-back-link" to="/borrowings/all"><i className="bi bi-arrow-left" /> Back to borrowing management</Link>
    </main>
  );
}
