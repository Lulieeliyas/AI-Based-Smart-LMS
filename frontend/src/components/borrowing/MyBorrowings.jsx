import React, { useEffect, useState } from "react";

const MyBorrowings = () => {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Temporary data until the Django API is connected.
    setBorrowings([]);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading borrowings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>My Borrowings</h1>
          <p className="text-muted">
            View and manage the books you have borrowed.
          </p>
        </div>

        <a href="/books" className="btn btn-primary">
          <i className="bi bi-book me-2"></i>
          Browse Books
        </a>
      </div>

      {borrowings.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <i className="bi bi-journal-x display-4 text-muted"></i>

            <h3 className="mt-3">No Borrowings</h3>

            <p className="text-muted">
              You don't have any borrowed books yet.
            </p>

            <a href="/books" className="btn btn-primary">
              Browse Books
            </a>
          </div>
        </div>
      ) : (
        <div className="row">
          {borrowings.map((borrowing) => (
            <div className="col-md-6 col-lg-4 mb-4" key={borrowing.id}>
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title">{borrowing.book_title}</h5>

                  <p className="card-text">
                    <strong>Borrowed:</strong> {borrowing.borrow_date}
                  </p>

                  <p className="card-text">
                    <strong>Due:</strong> {borrowing.due_date}
                  </p>

                  <span className="badge bg-primary">
                    {borrowing.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBorrowings;