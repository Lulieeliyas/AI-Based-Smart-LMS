
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import fineService from '../../services/fineService';
import borrowingService from '../../services/borrowingService';
import './FineManagement.css';

const TABS = ['Fines', 'Fine Reports', 'Extensions', 'Payment History'];

const getList = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatMoney = (amount) =>
  `ETB ${Number(amount || 0).toFixed(2)}`;

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : '—';

const getStatusClass = (status) => {
  const value = String(status || '').toLowerCase();

  if (['paid', 'approved', 'verified', 'returned'].includes(value)) {
    return 'success';
  }

  if (['rejected', 'cancelled', 'failed'].includes(value)) {
    return 'danger';
  }

  if (['pending', 'overdue', 'partially_paid'].includes(value)) {
    return 'warning';
  }

  return 'neutral';
};

const Status = ({ value }) => (
  <span className={`fm-status ${getStatusClass(value)}`}>
    {String(value || 'Unknown').replaceAll('_', ' ')}
  </span>
);

const FineManagement = () => {
  const { user } = useAuth();
  const isLibrarian = user?.role === 'librarian';

  const [activeTab, setActiveTab] = useState('Fines');
  const [fines, setFines] = useState([]);
  const [reports, setReports] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [borrowings, setBorrowings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [reportForm, setReportForm] = useState({
    reason: 'damaged',
    description: '',
    borrow_record: '',
    subject_user: '',
    proposed_amount: '',
  });

  const [extensionForm, setExtensionForm] = useState({
    fine: '',
    reason: '',
    requested_until: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    const requests = await Promise.allSettled([
      fineService.getFines(),
      fineService.getReports(),
      fineService.getExtensionRequests(),
      fineService.getPaymentHistory(),
      borrowingService.getMyBorrowings(),
    ]);

    const setters = [
      setFines,
      setReports,
      setExtensions,
      setPayments,
      setBorrowings,
    ];

    requests.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        setters[index](getList(result.value));
      } else {
        setters[index]([]);
        console.error('Fine Management API error:', result.reason);
      }
    });

    if (requests.some((result) => result.status === 'rejected')) {
      toast.error('Some information could not be loaded.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableFines = useMemo(
    () => fines.filter((fine) => Number(fine.outstanding_balance) > 0),
    [fines]
  );

  const summary = useMemo(() => ({
    total: fines.length,
    paid: fines.filter((fine) => fine.status === 'paid').length,
    outstanding: availableFines.length,
    pendingReports: reports.filter(
      (report) => report.status === 'pending'
    ).length,
  }), [fines, reports, availableFines]);

  const handleReportChange = (event) => {
    const { name, value } = event.target;
    setReportForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleExtensionChange = (event) => {
    const { name, value } = event.target;
    setExtensionForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitReport = async (event) => {
    event.preventDefault();

    if (!reportForm.description.trim()) {
      toast.error('Enter a report description.');
      return;
    }

    if (!isLibrarian && !reportForm.borrow_record) {
      toast.error('Select a borrowing record.');
      return;
    }

    if (
      isLibrarian &&
      !reportForm.borrow_record &&
      !reportForm.subject_user.trim()
    ) {
      toast.error('Enter a subject user ID or select a borrowing record.');
      return;
    }

    const payload = {
      reason: reportForm.reason,
      description: reportForm.description.trim(),
    };

    if (reportForm.borrow_record) {
      payload.borrow_record = reportForm.borrow_record;
    } else if (isLibrarian) {
      payload.subject_user = reportForm.subject_user.trim();
    }

    if (reportForm.proposed_amount !== '') {
      payload.proposed_amount = reportForm.proposed_amount;
    }

    setSubmitting(true);

    try {
      await fineService.submitReport(payload);
      toast.success('Fine report submitted successfully.');

      setReportForm({
        reason: 'damaged',
        description: '',
        borrow_record: '',
        subject_user: '',
        proposed_amount: '',
      });

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to submit report.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reviewReport = async (report) => {
    const decision = window.prompt(
      'Enter approved or rejected:',
      'approved'
    );

    if (!decision) return;

    const normalized = decision.trim().toLowerCase();

    if (!['approved', 'rejected'].includes(normalized)) {
      toast.error('Enter approved or rejected.');
      return;
    }

    const response = window.prompt('Enter your review response:');

    if (!response?.trim()) {
      toast.error('Review response is required.');
      return;
    }

    const payload = {
      decision: normalized,
      librarian_response: response.trim(),
    };

    if (normalized === 'approved') {
      const amount = window.prompt(
        'Enter approved fine amount (ETB):',
        report.proposed_amount || ''
      );

      if (
        amount === null ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        toast.error('Enter a valid positive amount.');
        return;
      }

      payload.approved_amount = amount;
    }

    setSubmitting(true);

    try {
      await fineService.reviewReport(report.id, payload);
      toast.success('Report reviewed successfully.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to review report.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitExtension = async (event) => {
    event.preventDefault();

    if (
      !extensionForm.fine ||
      !extensionForm.reason.trim() ||
      !extensionForm.requested_until
    ) {
      toast.error('Complete all extension request fields.');
      return;
    }

    setSubmitting(true);

    try {
      await fineService.requestExtension({
        fine: extensionForm.fine,
        reason: extensionForm.reason.trim(),
        requested_until: extensionForm.requested_until,
      });

      toast.success('Extension request submitted.');

      setExtensionForm({
        fine: '',
        reason: '',
        requested_until: '',
      });

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to submit extension request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reviewExtension = async (extension) => {
    const decision = window.prompt(
      'Enter approved or rejected:',
      'approved'
    );

    if (!decision) return;

    const normalized = decision.trim().toLowerCase();

    if (!['approved', 'rejected'].includes(normalized)) {
      toast.error('Enter approved or rejected.');
      return;
    }

    const note = window.prompt('Enter your decision note:');

    if (!note?.trim()) {
      toast.error('Decision note is required.');
      return;
    }

    const payload = {
      decision: normalized,
      decision_note: note.trim(),
    };

    if (normalized === 'approved') {
      const approvedUntil = window.prompt(
        'Approved until (YYYY-MM-DD). Leave blank to use the requested date:',
        extension.requested_until || ''
      );

      if (approvedUntil === null) return;

      if (approvedUntil.trim()) {
        payload.approved_until = approvedUntil.trim();
      }
    }

    setSubmitting(true);

    try {
      await fineService.reviewExtension(extension.id, payload);
      toast.success('Extension request reviewed.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to review extension.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const payFine = async (fine) => {
    if (!window.confirm(
      `Continue to pay ${formatMoney(fine.outstanding_balance)}?`
    )) return;

    setSubmitting(true);

    try {
      const response = await fineService.initializePayment({
        fine_id: fine.id,
      });

      const data = response?.data ?? response;
      const checkoutUrl =
        data?.checkout_url || data?.payment?.checkout_url;

      if (!checkoutUrl) {
        toast.error('No payment checkout URL was returned.');
        await loadData();
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Could not initialize payment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPayment = async (payment) => {
    if (!payment.tx_ref) {
      toast.error('Transaction reference is missing.');
      return;
    }

    setSubmitting(true);

    try {
      await fineService.verifyPayment({ tx_ref: payment.tx_ref });
      toast.success('Payment verification completed.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Payment verification failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderTable = (headers, rows, emptyMessage, emptyColSpan) => (
    <div className="fm-table-wrapper">
      <table className="fm-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows : (
            <tr>
              <td colSpan={emptyColSpan} className="fm-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderFines = () => (
    <>
      {renderTable(
        [
          'User', 'Reason', 'Amount', 'Paid',
          'Balance', 'Due Date', 'Status',
          ...(!isLibrarian ? ['Action'] : []),
        ],
        fines.map((fine) => (
          <tr key={fine.id}>
            <td>{fine.user_username || fine.user || '—'}</td>
            <td>{fine.reason}</td>
            <td>{formatMoney(fine.amount)}</td>
            <td>{formatMoney(fine.paid_amount)}</td>
            <td><strong>{formatMoney(fine.outstanding_balance)}</strong></td>
            <td>{formatDate(fine.payment_due_date)}</td>
            <td><Status value={fine.status} /></td>
            {!isLibrarian && (
              <td>
                {Number(fine.outstanding_balance) > 0 && (
                  <button
                    className="fm-action"
                    onClick={() => payFine(fine)}
                    disabled={submitting}
                  >
                    Pay Fine
                  </button>
                )}
              </td>
            )}
          </tr>
        )),
        'No fines found.',
        isLibrarian ? 7 : 8
      )}

      {!isLibrarian && availableFines.length > 0 && (
        <form onSubmit={submitExtension} className="fm-panel">
          <h3>Request Fine Extension</h3>

          <div className="fm-form">
            <div className="fm-field">
              <label>Select Fine</label>
              <select
                value={extensionForm.fine}
                onChange={(event) => setExtensionForm((previous) => ({
                  ...previous,
                  fine: event.target.value,
                }))}
                required
              >
                <option value="">Select a fine</option>
                {availableFines.map((fine) => (
                  <option key={fine.id} value={fine.id}>
                    {fine.reason} — {formatMoney(fine.outstanding_balance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="fm-field">
              <label>Requested New Due Date</label>
              <input
                type="date"
                name="requested_until"
                value={extensionForm.requested_until}
                onChange={handleExtensionChange}
                min={new Date().toLocaleDateString('en-CA')}
                required
              />
            </div>

            <div className="fm-field full-width">
              <label>Reason for Extension</label>
              <textarea
                name="reason"
                value={extensionForm.reason}
                onChange={handleExtensionChange}
                required
              />
            </div>

            <div className="fm-field full-width">
              <button className="fm-button" disabled={submitting}>
                Submit Extension Request
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );

  const renderReports = () => (
    <>
      <form onSubmit={submitReport} className="fm-panel">
        <h3>Submit Fine Report</h3>

        <div className="fm-form">
          <div className="fm-field">
            <label>Report Reason</label>
            <select
              name="reason"
              value={reportForm.reason}
              onChange={handleReportChange}
            >
              <option value="damaged">Damaged Book</option>
              <option value="lost">Lost Book</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="fm-field">
            <label>Borrowing Record {isLibrarian ? '(optional)' : ''}</label>
            <select
              name="borrow_record"
              value={reportForm.borrow_record}
              onChange={handleReportChange}
              required={!isLibrarian}
            >
              <option value="">Select borrowing record</option>
              {borrowings.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.book?.title || record.book_title || 'Book'} — {record.id}
                </option>
              ))}
            </select>
          </div>

          {isLibrarian && (
            <div className="fm-field full-width">
              <label>Subject User ID (if no borrowing record)</label>
              <input
                name="subject_user"
                value={reportForm.subject_user}
                onChange={handleReportChange}
                placeholder="Enter user ID"
              />
            </div>
          )}

          <div className="fm-field full-width">
            <label>Description</label>
            <textarea
              name="description"
              value={reportForm.description}
              onChange={handleReportChange}
              placeholder="Describe the damaged or lost book..."
              required
            />
          </div>

          <div className="fm-field">
            <label>Proposed Amount (ETB)</label>
            <input
              type="number"
              name="proposed_amount"
              value={reportForm.proposed_amount}
              onChange={handleReportChange}
              min="0.01"
              step="0.01"
              placeholder="Optional"
            />
          </div>

          <div className="fm-field full-width">
            <span className="fm-help">
              Evidence file upload is not included in this version.
            </span>
          </div>

          <div className="fm-field full-width">
            <button className="fm-button" disabled={submitting}>
              Submit Fine Report
            </button>
          </div>
        </div>
      </form>

      <section className="fm-panel">
        <h3>Fine Reports</h3>

        {renderTable(
          [
            'Reported By', 'User', 'Reason',
            'Description', 'Proposed Amount', 'Status',
            ...(isLibrarian ? ['Action'] : []),
          ],
          reports.map((report) => (
            <tr key={report.id}>
              <td>{report.reported_by_username || '—'}</td>
              <td>{report.subject_user_username || '—'}</td>
              <td>{report.reason}</td>
              <td>{report.description}</td>
              <td>{formatMoney(report.proposed_amount)}</td>
              <td><Status value={report.status} /></td>
              {isLibrarian && (
                <td>
                  {String(report.status).toLowerCase() === 'pending' && (
                    <button
                      className="fm-action"
                      onClick={() => reviewReport(report)}
                      disabled={submitting}
                    >
                      Review
                    </button>
                  )}
                </td>
              )}
            </tr>
          )),
          'No fine reports found.',
          isLibrarian ? 7 : 6
        )}
      </section>
    </>
  );

  const renderExtensions = () => (
    <section className="fm-panel">
      <h3>Fine Extension Requests</h3>

      {renderTable(
        [
          'Fine', 'Requested By', 'Reason',
          'Requested Until', 'Status',
          ...(isLibrarian ? ['Action'] : []),
        ],
        extensions.map((extension) => (
          <tr key={extension.id}>
            <td>{extension.fine_reason || extension.fine}</td>
            <td>{extension.requested_by || '—'}</td>
            <td>{extension.reason}</td>
            <td>{formatDate(extension.requested_until)}</td>
            <td><Status value={extension.status} /></td>
            {isLibrarian && (
              <td>
                {String(extension.status).toLowerCase() === 'pending' && (
                  <button
                    className="fm-action"
                    onClick={() => reviewExtension(extension)}
                    disabled={submitting}
                  >
                    Review
                  </button>
                )}
              </td>
            )}
          </tr>
        )),
        'No extension requests found.',
        isLibrarian ? 6 : 5
      )}
    </section>
  );

  const renderPayments = () => (
    <section className="fm-panel">
      <h3>Payment History</h3>

      {renderTable(
        [
          'Transaction Reference', 'Fine', 'Amount',
          'Provider', 'Date', 'Status', 'Action',
        ],
        payments.map((payment) => (
          <tr key={payment.id}>
            <td>{payment.tx_ref || '—'}</td>
            <td>{payment.fine_reason || payment.fine || '—'}</td>
            <td>{formatMoney(payment.amount)}</td>
            <td>{payment.provider || 'Chapa'}</td>
            <td>{formatDate(payment.created_at)}</td>
            <td><Status value={payment.status} /></td>
            <td>
              {String(payment.status).toLowerCase() === 'pending' && (
                <button
                  className="fm-action"
                  onClick={() => verifyPayment(payment)}
                  disabled={submitting}
                >
                  Verify
                </button>
              )}
            </td>
          </tr>
        )),
        'No payment history found.',
        7
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="fine-management">
        <div className="fm-loading">Loading Fine Management...</div>
      </div>
    );
  }

  return (
    <div className="fine-management">
      <div className="fine-management-inner">

        <header className="fine-management-header">
          <div>
            <h1>Fine Management</h1>
            <p>
              Manage library fines, reports, extensions and payments.
            </p>
          </div>

          <button
            className="fm-refresh"
            onClick={loadData}
            disabled={submitting}
          >
            ↻ Refresh
          </button>
        </header>

        <div className="fm-summary">
          <div className="fm-summary-card">
            <span>Total Fines</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="fm-summary-card">
            <span>Paid Fines</span>
            <strong>{summary.paid}</strong>
          </div>
          <div className="fm-summary-card">
            <span>Outstanding Fines</span>
            <strong>{summary.outstanding}</strong>
          </div>
          <div className="fm-summary-card">
            <span>Pending Reports</span>
            <strong>{summary.pendingReports}</strong>
          </div>
        </div>

        <nav className="fm-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`fm-tab ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <main className="fm-content">
          {activeTab === 'Fines' && renderFines()}
          {activeTab === 'Fine Reports' && renderReports()}
          {activeTab === 'Extensions' && renderExtensions()}
          {activeTab === 'Payment History' && renderPayments()}
        </main>

      </div>
    </div>
  );
};

export default FineManagement;
