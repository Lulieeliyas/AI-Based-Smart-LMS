
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import bookService from '../../services/bookService';
import borrowingService from '../../services/borrowingService';
import userService from '../../services/userService';
import './LibrarianDashboard.css';

const unwrap = (response) => {
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const getPayload = (response) => response?.data ?? response ?? {};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : '—';

const formatMoney = (value) =>
  `ETB ${Number(value || 0).toFixed(2)}`;

const getBookTitle = (record) =>
  record.book?.title ||
  record.book_details?.title ||
  'Book record';

const getMemberName = (record) =>
  record.username ||
  record.user_details?.username ||
  record.user?.username ||
  record.student_name ||
  'Member';

const initialInspection = {
  damage_status: 'none',
  damage_notes: '',
  damage_fine: '0',
};

export default function LibrarianDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const [books, setBooks] = useState([]);
  const [bookCount, setBookCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [borrowStats, setBorrowStats] = useState({});

  const [query, setQuery] = useState('');
  const [inspectionForms, setInspectionForms] = useState({});
  const [paymentReferences, setPaymentReferences] = useState({});

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    const results = await Promise.allSettled([
      bookService.getBooks({ page_size: 1000 }),
      userService.getUsers(),
      borrowingService.getBorrowingStatistics(),
      borrowingService.getAllBorrowings(),
      borrowingService.getOverdueBorrowings(),
      borrowingService.getPendingRequests(),
      borrowingService.getReturnRequests(),
    ]);

    const failures = [];

    if (results[0].status === 'fulfilled') {
      const payload = getPayload(results[0].value);
      setBooks(unwrap(results[0].value));
      setBookCount(Number(payload.count ?? unwrap(results[0].value).length));
    } else failures.push('books');

    if (results[1].status === 'fulfilled') {
      setUsers(unwrap(results[1].value));
    } else failures.push('members');

    if (results[2].status === 'fulfilled') {
      setBorrowStats(getPayload(results[2].value));
    } else failures.push('statistics');

    if (results[3].status === 'fulfilled') {
      setBorrowings(unwrap(results[3].value));
    } else failures.push('borrowing records');

    if (results[4].status === 'fulfilled') {
      setOverdue(unwrap(results[4].value));
    } else failures.push('overdue records');

    if (results[5].status === 'fulfilled') {
      setPendingRequests(unwrap(results[5].value));
    } else failures.push('pending requests');

    if (results[6].status === 'fulfilled') {
      setReturnRequests(unwrap(results[6].value));
    } else failures.push('return requests');

    if (failures.length) {
      const message = `Some dashboard data could not be loaded: ${failures.join(', ')}.`;
      setError(message);

      if (quiet) toast.warning(message);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const inventory = useMemo(
    () =>
      books.reduce(
        (acc, book) => ({
          copies: acc.copies + Number(book.total_copies || 0),
          available: acc.available + Number(book.available_copies || 0),
        }),
        { copies: 0, available: 0 }
      ),
    [books]
  );

  const recent = useMemo(
    () =>
      [...borrowings]
        .sort(
          (a, b) =>
            new Date(b.issue_date || 0) -
            new Date(a.issue_date || 0)
        )
        .slice(0, 6),
    [borrowings]
  );

  const filteredOverdue = useMemo(
    () =>
      overdue
        .filter((item) =>
          `${getBookTitle(item)} ${getMemberName(item)}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
        .slice(0, 6),
    [overdue, query]
  );

  const awaitingPayment = borrowings.filter(
    (item) => item.status === 'awaiting_payment'
  );

  const readyToReturn = borrowings.filter(
    (item) => item.status === 'ready_to_return'
  );

  const stats = [
    {
      label: 'Book titles',
      value: bookCount,
      icon: 'bi-book',
      tone: 'blue',
      detail: `${inventory.copies} total copies`,
    },
    {
      label: 'Available copies',
      value: inventory.available,
      icon: 'bi-bookmark-check',
      tone: 'green',
      detail: 'Ready to borrow',
    },
    {
      label: 'Library members',
      value: users.length,
      icon: 'bi-people',
      tone: 'violet',
      detail: 'Registered accounts',
    },
    {
      label: 'Active borrowings',
      value: borrowStats.active_borrowings ?? 0,
      icon: 'bi-journal-arrow-up',
      tone: 'amber',
      detail: 'Currently issued',
    },
    {
      label: 'Overdue books',
      value: borrowStats.overdue_borrowings ?? overdue.length,
      icon: 'bi-clock-history',
      tone: 'red',
      detail: 'Need follow-up',
    },
    {
      label: 'Books returned',
      value: borrowStats.returned_borrowings ?? 0,
      icon: 'bi-check2-circle',
      tone: 'teal',
      detail: 'Completed returns',
    },
  ];

  const runAction = async (id, action, successMessage) => {
    setBusyId(id);

    try {
      await action();
      toast.success(successMessage);
      await loadDashboard(true);
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'The operation could not be completed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const updateInspection = (id, field, value) => {
    setInspectionForms((previous) => ({
      ...previous,
      [id]: {
        ...initialInspection,
        ...previous[id],
        [field]: value,
      },
    }));
  };

  const inspectBook = (record) => {
    const form = {
      ...initialInspection,
      ...inspectionForms[record.id],
    };

    runAction(
      record.id,
      () => borrowingService.inspectReturn(record.id, form),
      'Book inspection saved successfully.'
    );
  };

  const verifyPayment = (record) => {
    const reference = paymentReferences[record.id] || '';

    runAction(
      record.id,
      () => borrowingService.verifyFinePayment(record.id, reference),
      'Payment verified successfully.'
    );
  };

  if (loading) {
    return (
      <div className="lib-loading">
        <div className="spinner-border text-primary" />
        <p>Preparing your library dashboard...</p>
      </div>
    );
  }

  return (
    <main className="librarian-dashboard">
      <section className="lib-welcome">
        <div>
          <span className="lib-eyebrow">LIBRARY MANAGEMENT</span>
          <h1>
            Good day, {user?.first_name || user?.username || 'Librarian'} 📚
          </h1>
          <p>Manage borrowing, returns, inspections and library inventory.</p>
        </div>

        <button
          className="lib-refresh"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          <i
            className={`bi bi-arrow-clockwise ${refreshing ? 'lib-spin' : ''}`}
          />
          {refreshing ? 'Refreshing...' : 'Refresh data'}
        </button>
      </section>

      {error && (
        <div className="alert alert-warning" role="alert">
          {error} Check that the backend is running and your account has
          librarian permissions.
        </div>
      )}

      <section className="lib-stat-grid" aria-label="Library statistics">
        {stats.map((stat) => (
          <article className="lib-stat-card" key={stat.label}>
            <div className={`lib-stat-icon ${stat.tone}`}>
              <i className={`bi ${stat.icon}`} />
            </div>
            <div className="lib-stat-value">
              {Number(stat.value || 0).toLocaleString()}
            </div>
            <div className="lib-stat-label">{stat.label}</div>
            <div className="lib-stat-detail">{stat.detail}</div>
          </article>
        ))}
      </section>

      <section className="lib-section-heading">
        <div>
          <span className="lib-eyebrow">WORKSPACE</span>
          <h2>Quick actions</h2>
        </div>
      </section>

      <section className="lib-action-grid">
        <Link to="/books/manage" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-journal-plus" />
          </span>
          <span>
            <b>Manage books</b>
            <small>Add, update and organize titles</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/borrowings/all" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-arrow-left-right" />
          </span>
          <span>
            <b>Borrowing records</b>
            <small>Review issues and returns</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/fines" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-receipt" />
          </span>
          <span>
            <b>Fine management</b>
            <small>Review fines and payments</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/users" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-person-gear" />
          </span>
          <span>
            <b>Manage members</b>
            <small>View students and staff</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/reports" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-bar-chart-line" />
          </span>
          <span>
            <b>Reports & analytics</b>
            <small>Explore library performance</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/notifications" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-bell" />
          </span>
          <span>
            <b>Notifications</b>
            <small>Review library updates</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>

        <Link to="/digital" className="lib-action">
          <span className="lib-action-icon">
            <i className="bi bi-file-earmark-pdf" />
          </span>
          <span>
            <b>Digital resources</b>
            <small>Manage online materials</small>
          </span>
          <i className="bi bi-arrow-up-right" />
        </Link>
      </section>

      {/* Pending borrowing requests */}
      <section className="lib-workflow-section">
        <div className="lib-section-heading">
          <div>
            <span className="lib-eyebrow">STUDENT REQUESTS</span>
            <h2>Pending borrowing requests ({pendingRequests.length})</h2>
          </div>
        </div>

        {pendingRequests.length ? (
          <div className="lib-workflow-grid">
            {pendingRequests.map((record) => (
              <article className="lib-workflow-card" key={record.id}>
                <h3>{getBookTitle(record)}</h3>
                <p>Student: {getMemberName(record)}</p>
                <p>Request ID: #{record.id}</p>

                <div className="lib-workflow-actions">
                  <button
                    className="btn btn-success btn-sm"
                    disabled={busyId === record.id}
                    onClick={() =>
                      runAction(
                        record.id,
                        () => borrowingService.approveBorrowing(record.id),
                        'Borrowing request approved and book issued.'
                      )
                    }
                  >
                    Approve & issue
                  </button>

                  <button
                    className="btn btn-outline-danger btn-sm"
                    disabled={busyId === record.id}
                    onClick={() =>
                      runAction(
                        record.id,
                        () => borrowingService.rejectBorrowing(record.id),
                        'Borrowing request rejected.'
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="lib-empty">No pending borrowing requests.</p>
        )}
      </section>

      {/* Return requests and inspection */}
      <section className="lib-workflow-section">
        <div className="lib-section-heading">
          <div>
            <span className="lib-eyebrow">PHYSICAL BOOK INSPECTION</span>
            <h2>Return requests ({returnRequests.length})</h2>
          </div>
        </div>

        {returnRequests.length ? (
          <div className="lib-workflow-grid">
            {returnRequests.map((record) => {
              const form = {
                ...initialInspection,
                ...inspectionForms[record.id],
              };

              return (
                <article className="lib-workflow-card" key={record.id}>
                  <h3>{getBookTitle(record)}</h3>
                  <p>Student: {getMemberName(record)}</p>
                  <p>Due date: {formatDate(record.due_date)}</p>
                  <p>Return requested: {formatDate(record.return_requested_at)}</p>

                  <label className="lib-field-label">
                    Book condition
                    <select
                      className="form-select"
                      value={form.damage_status}
                      onChange={(e) =>
                        updateInspection(
                          record.id,
                          'damage_status',
                          e.target.value
                        )
                      }
                    >
                      <option value="none">No damage</option>
                      <option value="minor">Minor damage</option>
                      <option value="moderate">Moderate damage</option>
                      <option value="severe">Severe damage</option>
                      <option value="lost">Lost book</option>
                    </select>
                  </label>

                  <label className="lib-field-label">
                    Inspection notes
                    <textarea
                      className="form-control"
                      rows="2"
                      value={form.damage_notes}
                      onChange={(e) =>
                        updateInspection(
                          record.id,
                          'damage_notes',
                          e.target.value
                        )
                      }
                      placeholder="Describe the book condition..."
                    />
                  </label>

                  <label className="lib-field-label">
                    Damage fine (ETB)
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.damage_fine}
                      onChange={(e) =>
                        updateInspection(
                          record.id,
                          'damage_fine',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busyId === record.id}
                    onClick={() => inspectBook(record)}
                  >
                    Save inspection
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="lib-empty">No books waiting for inspection.</p>
        )}
      </section>

      {/* Fine payment verification */}
      <section className="lib-workflow-section">
        <div className="lib-section-heading">
          <div>
            <span className="lib-eyebrow">FINE COLLECTION</span>
            <h2>Awaiting payment ({awaitingPayment.length})</h2>
          </div>
        </div>

        {awaitingPayment.length ? (
          <div className="lib-workflow-grid">
            {awaitingPayment.map((record) => (
              <article className="lib-workflow-card" key={record.id}>
                <h3>{getBookTitle(record)}</h3>
                <p>Student: {getMemberName(record)}</p>
                <p>
                  Total fine: <strong>{formatMoney(record.fine)}</strong>
                </p>

                <label className="lib-field-label">
                  Payment transaction reference
                  <input
                    className="form-control"
                    value={paymentReferences[record.id] || ''}
                    onChange={(e) =>
                      setPaymentReferences((previous) => ({
                        ...previous,
                        [record.id]: e.target.value,
                      }))
                    }
                    placeholder="Enter verified transaction reference"
                  />
                </label>

                <button
                  className="btn btn-success btn-sm"
                  disabled={busyId === record.id}
                  onClick={() => verifyPayment(record)}
                >
                  Verify payment
                </button>

                <small className="lib-warning-text">
                  Verify the actual payment before confirming it here.
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="lib-empty">No payments waiting for verification.</p>
        )}
      </section>

      {/* Final return confirmation */}
      <section className="lib-workflow-section">
        <div className="lib-section-heading">
          <div>
            <span className="lib-eyebrow">FINAL CONFIRMATION</span>
            <h2>Ready to finalize returns ({readyToReturn.length})</h2>
          </div>
        </div>

        {readyToReturn.length ? (
          <div className="lib-workflow-grid">
            {readyToReturn.map((record) => (
              <article className="lib-workflow-card" key={record.id}>
                <h3>{getBookTitle(record)}</h3>
                <p>Student: {getMemberName(record)}</p>
                <p>Condition: {record.damage_status || 'none'}</p>
                <p>Fine: {formatMoney(record.fine)}</p>

                <button
                  className="btn btn-success btn-sm"
                  disabled={busyId === record.id}
                  onClick={() =>
                    runAction(
                      record.id,
                      () => borrowingService.finalizeReturn(record.id),
                      'Return finalized and inventory updated.'
                    )
                  }
                >
                  Confirm final return
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="lib-empty">No returns waiting for final confirmation.</p>
        )}
      </section>

      {/* Recent borrowing activity */}
      <section className="lib-content-grid">
        <article className="lib-panel">
          <div className="lib-panel-head">
            <div>
              <span className="lib-eyebrow">LATEST ACTIVITY</span>
              <h2>Recent borrowings</h2>
            </div>
            <Link to="/borrowings/all">View all</Link>
          </div>

          {recent.length ? (
            <div className="lib-table-wrap">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Issue date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{getBookTitle(item)}</b>
                      </td>
                      <td>{getMemberName(item)}</td>
                      <td>{formatDate(item.issue_date)}</td>
                      <td>
                        <span className={`lib-status ${item.status}`}>
                          {item.status?.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lib-empty">
              <p>No borrowing activity to display yet.</p>
            </div>
          )}
        </article>

        <article className="lib-panel">
          <div className="lib-panel-head">
            <div>
              <span className="lib-eyebrow">ACTION REQUIRED</span>
              <h2>Overdue books</h2>
            </div>
            <span className="lib-overdue-count">{overdue.length}</span>
          </div>

          <input
            className="lib-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search book or member..."
            aria-label="Search overdue books"
          />

          {filteredOverdue.length ? (
            <div className="lib-overdue-list">
              {filteredOverdue.map((item) => (
                <div className="lib-overdue-item" key={item.id}>
                  <div className="lib-overdue-book">
                    <b>{getBookTitle(item)}</b>
                    <small>{getMemberName(item)}</small>
                  </div>
                  <div className="lib-overdue-date">
                    <small>Due date</small>
                    <b>{formatDate(item.due_date)}</b>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="lib-empty compact">
              <p>
                {overdue.length
                  ? 'No matching overdue records.'
                  : 'No overdue books.'}
              </p>
            </div>
          )}

          <Link className="lib-panel-footer" to="/borrowings/all">
            Open borrowing management
          </Link>
        </article>
      </section>

      {/* Inventory snapshot */}
      <section className="lib-inventory-strip">
        <div>
          <span className="lib-eyebrow">COLLECTION SNAPSHOT</span>
          <h2>Library inventory</h2>
        </div>

        <div className="lib-inventory-metric">
          <b>{inventory.copies.toLocaleString()}</b>
          <small>Total copies</small>
        </div>

        <div className="lib-inventory-metric">
          <b>
            {Math.max(
              inventory.copies - inventory.available,
              0
            ).toLocaleString()}
          </b>
          <small>Currently out</small>
        </div>

        <Link to="/books/manage" className="btn btn-outline-primary">
          View inventory
        </Link>
      </section>
    </main>
  );
}
