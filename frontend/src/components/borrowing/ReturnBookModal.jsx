import React, { useState } from 'react';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';

const ReturnBookModal = ({ borrowing, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    damage_status: 'none',
    description: '',
    images: [],
  });
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const handleDamageChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleReportDamage = async () => {
    setLoading(true);
    try {
      await borrowingService.reportDamage(borrowing.id, formData);
      toast.success('Damage reported successfully');
      setStep(3);
      // Check if payment is required
      await checkPaymentStatus();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to report damage');
    }
    setLoading(false);
  };

  const handleReturn = async () => {
    setLoading(true);
    try {
      await borrowingService.returnBook(borrowing.id);
      toast.success('Book returned successfully');
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to return book');
    }
    setLoading(false);
  };

  const checkPaymentStatus = async () => {
    try {
      const response = await borrowingService.getPaymentStatus(borrowing.id);
      setPaymentStatus(response.data);
      if (response.data.payment_amount > 0) {
        setShowPayment(true);
      }
    } catch (error) {
      console.warn('Error checking payment status:', error);
    }
  };

  const handleCreatePayment = async () => {
    setLoading(true);
    try {
      const response = await borrowingService.createPayment(borrowing.id);
      // Redirect to Chapa payment page
      // For now, simulate redirect
      toast.info(`Payment of $${response.data.amount} required`);
      setStep(4);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create payment');
    }
    setLoading(false);
  };

  const renderStep1 = () => (
    <div>
      <h5 className="mb-3">📖 Return Book: {borrowing.book_details?.title}</h5>
      
      <div className="card mb-3">
        <div className="card-body">
          <p><strong>Borrower:</strong> {borrowing.borrower_display_name}</p>
          <p><strong>Due Date:</strong> {new Date(borrowing.due_date).toLocaleDateString()}</p>
          {borrowing.is_overdue && (
            <p className="text-danger"><strong>Status:</strong> OVERDUE</p>
          )}
          <p><strong>Fine:</strong> ${borrowing.fine_amount || 0}</p>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label fw-semibold">Is the book damaged or lost?</label>
        <select
          className="form-select"
          name="damage_status"
          value={formData.damage_status}
          onChange={handleDamageChange}
        >
          <option value="none">No, book is in good condition</option>
          <option value="minor">Minor damage (pages torn, cover scuffed)</option>
          <option value="moderate">Moderate damage (water damage, missing pages)</option>
          <option value="severe">Severe damage (unusable)</option>
          <option value="lost">Lost the book</option>
        </select>
      </div>

      {formData.damage_status !== 'none' && (
        <>
          <div className="mb-3">
            <label className="form-label">Description of damage</label>
            <textarea
              className="form-control"
              name="description"
              value={formData.description}
              onChange={handleDamageChange}
              rows="3"
              placeholder="Please describe the damage in detail..."
            />
          </div>
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Note:</strong> Damage fees may apply. You'll need to complete payment before the return is finalized.
          </div>
        </>
      )}

      <button 
        className="btn btn-primary w-100"
        onClick={formData.damage_status !== 'none' ? handleReportDamage : handleReturn}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Processing...
          </>
        ) : (
          formData.damage_status !== 'none' ? 'Report Damage & Continue' : 'Return Book'
        )}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h5 className="mb-3">📸 Damage Evidence</h5>
      
      <div className="alert alert-info">
        <i className="bi bi-info-circle me-2"></i>
        Please take photos of the damaged book for verification.
      </div>

      <div className="mb-3">
        <label className="form-label">Upload Damage Photos</label>
        <input
          type="file"
          className="form-control"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files);
            const fileReaders = files.map(file => {
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
              });
            });
            Promise.all(fileReaders).then(images => {
              setFormData({ ...formData, images });
            });
          }}
        />
      </div>

      <button 
        className="btn btn-primary w-100"
        onClick={handleReportDamage}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Submitting...
          </>
        ) : (
          'Submit Damage Report'
        )}
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h5 className="mb-3 text-center">
        {paymentStatus?.payment_amount > 0 ? '💰 Payment Required' : '✅ Return Complete'}
      </h5>
      
      {paymentStatus?.payment_amount > 0 ? (
        <>
          <div className="card mb-3">
            <div className="card-body text-center">
              <h3 className="text-danger">${paymentStatus.payment_amount}</h3>
              <p className="text-muted">Amount due</p>
              <hr />
              <p className="mb-1">
                <strong>Fine:</strong> ${paymentStatus.fine_amount}
              </p>
              <p className="mb-1">
                <strong>Damage Cost:</strong> ${paymentStatus.damage_cost}
              </p>
            </div>
          </div>

          <button 
            className="btn btn-success w-100 mb-2"
            onClick={handleCreatePayment}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Processing...
              </>
            ) : (
              '💳 Pay with Chapa'
            )}
          </button>
          
          <button 
            className="btn btn-outline-secondary w-100"
            onClick={onClose}
          >
            Pay Later
          </button>
        </>
      ) : (
        <>
          <div className="text-center py-4">
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h4>Book Returned Successfully</h4>
            <p className="text-muted">No payment required</p>
          </div>
          <button className="btn btn-primary w-100" onClick={onClose}>
            Done
          </button>
        </>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h5 className="mb-3 text-center">💳 Chapa Payment</h5>
      
      <div className="card mb-3">
        <div className="card-body text-center">
          <div style={{ fontSize: '4rem' }}>🏦</div>
          <h4>Redirecting to Chapa...</h4>
          <p className="text-muted">
            You will be redirected to Chapa to complete your payment.
          </p>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>

      <p className="text-muted text-center small">
        If you are not redirected, click the button below.
      </p>
      <button 
        className="btn btn-primary w-100"
        onClick={() => window.open('https://chapa.co', '_blank')}
      >
        Go to Chapa
      </button>
    </div>
  );

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Return Book</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnBookModal;