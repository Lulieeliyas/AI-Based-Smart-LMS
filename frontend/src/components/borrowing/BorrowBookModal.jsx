import React, { useState } from 'react';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';

const BorrowBookModal = ({ book, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!book?.id) {
      toast.error('Book information is missing.');
      return;
    }

    setLoading(true);

    try {
      // Submit a borrowing request for the logged-in user.
      // The backend creates it with PENDING status.
      const response = await borrowingService.borrowBook(book.id);

      console.log('Borrow request response:', response.data);

      toast.success(
        'Borrow request submitted. Waiting for librarian approval.'
      );

      if (onSuccess) {
        onSuccess(response.data);
      } else if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Borrow request failed:', error);

      const data = error.response?.data;
      let message = 'Failed to submit borrowing request. Please try again.';

      if (typeof data === 'string') {
        message = data;
      } else if (data?.detail) {
        message = data.detail;
      } else if (data?.error) {
        message = data.error;
      } else if (data && typeof data === 'object') {
        message = Object.entries(data)
          .map(([field, messages]) => {
            const value = Array.isArray(messages)
              ? messages.join(', ')
              : String(messages);

            return `${field}: ${value}`;
          })
          .join(' | ');
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!book) {
    return null;
  }

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="borrowBookTitle"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">

          {/* Header */}
          <div className="modal-header">
            <h5 className="modal-title" id="borrowBookTitle">
              <i className="bi bi-book me-2"></i>
              Request to Borrow Book
            </h5>

            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body">

            <div className="text-center mb-3">
              {book.cover_image ? (
                <img
                  src={book.cover_image}
                  alt={book.title}
                  style={{
                    width: '110px',
                    height: '145px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                  }}
                />
              ) : (
                <div
                  className="bg-light rounded d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '110px',
                    height: '145px',
                    fontSize: '3rem',
                  }}
                >
                  📚
                </div>
              )}
            </div>

            <h5 className="text-center">
              {book.title}
            </h5>

            <p className="text-center text-muted">
              by {book.author || 'Unknown author'}
            </p>

            <hr />

            <div className="mb-3">
              <p className="mb-2">
                <strong>Book ID:</strong> {book.id}
              </p>

              <p className="mb-2">
                <strong>ISBN:</strong> {book.isbn || 'N/A'}
              </p>

              <p className="mb-2">
                <strong>Available copies:</strong>{' '}
                {Number(
                  book.available_copies ??
                  book.available_quantity ??
                  0
                )}
              </p>

              <p className="mb-2">
                <strong>Borrowing period:</strong> 14 days
              </p>
            </div>

            <div className="alert alert-info">
              <i className="bi bi-info-circle-fill me-2"></i>

              Your request will first be sent to the librarian.
              The book will only be issued after the librarian approves
              your request.
            </div>

            <div className="alert alert-warning mb-0">
              <strong>Important:</strong> Submitting this request does
              not mean that the book has already been issued to you.
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer">

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="bi bi-send me-2"></i>
                  Submit Borrow Request
                </>
              )}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BorrowBookModal;