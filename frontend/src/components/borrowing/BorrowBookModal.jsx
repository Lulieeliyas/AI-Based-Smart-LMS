import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';

const BorrowBookModal = ({ book, onClose, onSuccess }) => {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    role: user?.role || 'student',
    student_id: '',
    student_name: '',
    staff_id: '',
    staff_name: '',
    staff_position: '',
    borrow_duration: 14,
  });
  const [capturedImages, setCapturedImages] = useState({
    front: null,
    back: null,
    selfie: null,
  });
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraType, setCameraType] = useState('front');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // ID verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [userExists, setUserExists] = useState(false);

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  useEffect(() => {
    checkBorrowStatus();
  }, []);

  // Verify ID when user finishes entering it
  useEffect(() => {
    const idField = formData.role === 'student' ? formData.student_id : formData.staff_id;
    if (idField && idField.length >= 4) {
      const timer = setTimeout(() => {
        verifyID();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [formData.student_id, formData.staff_id, formData.role]);

  const checkBorrowStatus = async () => {
    try {
      const response = await borrowingService.canBorrow();
      if (!response.data.can_borrow) {
        toast.warning(response.data.message);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.warn('Error checking borrow status:', error);
    }
  };

  const verifyID = async () => {
    const id = formData.role === 'student' ? formData.student_id : formData.staff_id;
    if (!id || id.length < 4) return;
    
    setVerifying(true);
    setVerificationStatus(null);
    
    try {
      const response = await borrowingService.verifyID({
        role: formData.role,
        user_id: id,
        user_name: formData.role === 'student' ? formData.student_name : formData.staff_name
      });
      
      const data = response.data;
      setVerificationStatus(data.valid);
      setVerificationMessage(data.message);
      setUserExists(data.user_exists);
      
      if (data.valid) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
    } catch (error) {
      console.error('ID verification error:', error);
      setVerificationStatus(false);
      setVerificationMessage(error.response?.data?.error || 'Failed to verify ID');
      toast.error('Failed to verify ID');
    }
    setVerifying(false);
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: cameraType === 'front' ? 'environment' : 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      let imageType = 'selfie';
      if (cameraType === 'front') imageType = 'front';
      else if (cameraType === 'back') imageType = 'back';
      
      setCapturedImages(prev => ({
        ...prev,
        [imageType]: imageData
      }));
      
      if (imageType === 'front') {
        setCameraType('back');
        toast.info('Now capture the back of the ID');
        setTimeout(() => startCamera(), 500);
      } else if (imageType === 'back') {
        setCameraType('selfie');
        toast.info('Now take a selfie');
        setTimeout(() => startCamera(), 500);
      } else if (imageType === 'selfie') {
        stopCamera();
        setStep(3);
        toast.success('All images captured successfully!');
      }
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
    // Reset verification when ID changes
    if (e.target.name === 'student_id' || e.target.name === 'staff_id') {
      setVerificationStatus(null);
      setVerificationMessage('');
      setUserExists(false);
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    const role = formData.role;
    
    if (role === 'student') {
      if (!formData.student_id.trim()) newErrors.student_id = 'Student ID is required';
      if (!formData.student_name.trim()) newErrors.student_name = 'Student name is required';
    } else if (role === 'academic_staff') {
      if (!formData.staff_id.trim()) newErrors.staff_id = 'Staff ID is required';
      if (!formData.staff_name.trim()) newErrors.staff_name = 'Staff name is required';
      if (!formData.staff_position.trim()) newErrors.staff_position = 'Staff position is required';
    }
    
    // Check verification status
    if (verificationStatus === false) {
      newErrors.id_verification = 'ID verification failed. Please check your ID and try again.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      setCameraType('front');
      setTimeout(() => startCamera(), 300);
    }
  };

  // ✅ FIXED: Correct data submission
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // ✅ Use correct field names that backend expects
      const borrowData = {
        book: book.id,  // Backend expects 'book' not 'book_id'
        borrower_role: formData.role,
        student_id: formData.student_id,
        student_name: formData.student_name,
        staff_id: formData.staff_id,
        staff_name: formData.staff_name,
        staff_position: formData.staff_position,
        borrow_duration_days: parseInt(formData.borrow_duration),
        id_front_image: capturedImages.front,
        id_back_image: capturedImages.back,
        selfie_image: capturedImages.selfie,
      };
      
      // Log the data being sent for debugging
      console.log('Sending borrow data:', borrowData);
      
      // ✅ Pass borrowData to the service
      await borrowingService.borrowBook(book.id, borrowData);
      toast.success('Book borrowed successfully!');
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error('Error borrowing book:', error);
      // ✅ Better error handling
      let errorMsg = 'Failed to borrow book';
      if (error.response?.data) {
        const data = error.response.data;
        if (data.error) {
          errorMsg = data.error;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.student_id) {
          errorMsg = `Student ID: ${data.student_id}`;
        } else if (typeof data === 'string') {
          errorMsg = data;
        } else {
          errorMsg = JSON.stringify(data);
        }
      }
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const renderStep1 = () => (
    <div>
      <h5 className="mb-3">📋 Borrower Information</h5>
      
      <div className="mb-3">
        <label className="form-label fw-semibold">Role *</label>
        <select
          className="form-select"
          name="role"
          value={formData.role}
          onChange={handleInputChange}
        >
          <option value="student">Student</option>
          <option value="academic_staff">Academic Staff</option>
          <option value="librarian">Librarian</option>
        </select>
      </div>

      {formData.role === 'student' ? (
        <>
          <div className="mb-3">
            <label className="form-label fw-semibold">Student ID *</label>
            <div className="input-group">
              <input
                type="text"
                className={`form-control ${errors.student_id ? 'is-invalid' : ''}`}
                name="student_id"
                value={formData.student_id}
                onChange={handleInputChange}
                placeholder="Enter student ID (e.g., MAU1400629)"
              />
              {verifying && (
                <span className="input-group-text">
                  <span className="spinner-border spinner-border-sm"></span>
                </span>
              )}
            </div>
            {errors.student_id && <div className="invalid-feedback">{errors.student_id}</div>}
          </div>
          
          {/* Verification Status */}
          {verificationStatus !== null && (
            <div className={`alert alert-${verificationStatus ? 'success' : 'warning'} mb-3`}>
              <i className={`bi bi-${verificationStatus ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
              {verificationMessage}
              {userExists && (
                <span className="badge bg-success ms-2">User Found</span>
              )}
            </div>
          )}
          
          <div className="mb-3">
            <label className="form-label fw-semibold">Student Name *</label>
            <input
              type="text"
              className={`form-control ${errors.student_name ? 'is-invalid' : ''}`}
              name="student_name"
              value={formData.student_name}
              onChange={handleInputChange}
              placeholder="Enter full name"
            />
            {errors.student_name && <div className="invalid-feedback">{errors.student_name}</div>}
          </div>
        </>
      ) : formData.role === 'academic_staff' ? (
        <>
          <div className="mb-3">
            <label className="form-label fw-semibold">Staff ID *</label>
            <div className="input-group">
              <input
                type="text"
                className={`form-control ${errors.staff_id ? 'is-invalid' : ''}`}
                name="staff_id"
                value={formData.staff_id}
                onChange={handleInputChange}
                placeholder="Enter staff ID"
              />
              {verifying && (
                <span className="input-group-text">
                  <span className="spinner-border spinner-border-sm"></span>
                </span>
              )}
            </div>
            {errors.staff_id && <div className="invalid-feedback">{errors.staff_id}</div>}
          </div>
          
          {/* Verification Status */}
          {verificationStatus !== null && (
            <div className={`alert alert-${verificationStatus ? 'success' : 'warning'} mb-3`}>
              <i className={`bi bi-${verificationStatus ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
              {verificationMessage}
              {userExists && (
                <span className="badge bg-success ms-2">User Found</span>
              )}
            </div>
          )}
          
          <div className="mb-3">
            <label className="form-label fw-semibold">Staff Name *</label>
            <input
              type="text"
              className={`form-control ${errors.staff_name ? 'is-invalid' : ''}`}
              name="staff_name"
              value={formData.staff_name}
              onChange={handleInputChange}
              placeholder="Enter full name"
            />
            {errors.staff_name && <div className="invalid-feedback">{errors.staff_name}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold">Staff Position *</label>
            <input
              type="text"
              className={`form-control ${errors.staff_position ? 'is-invalid' : ''}`}
              name="staff_position"
              value={formData.staff_position}
              onChange={handleInputChange}
              placeholder="e.g., Lecturer, Researcher, Professor"
            />
            {errors.staff_position && <div className="invalid-feedback">{errors.staff_position}</div>}
          </div>
        </>
      ) : (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Librarian borrowing will be processed with admin privileges.
        </div>
      )}

      {errors.id_verification && (
        <div className="alert alert-danger">
          <i className="bi bi-x-circle me-2"></i>
          {errors.id_verification}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label fw-semibold">Borrow Duration (days)</label>
        <select
          className="form-select"
          name="borrow_duration"
          value={formData.borrow_duration}
          onChange={handleInputChange}
        >
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="21">21 days</option>
          <option value="30">30 days</option>
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h5 className="mb-3">
        📸 Document Capture
        <span className="badge bg-info ms-2">
          {cameraType === 'front' ? 'Front of ID' : cameraType === 'back' ? 'Back of ID' : 'Selfie'}
        </span>
      </h5>
      
      <div className="camera-container mb-3">
        <video
          ref={videoRef}
          className="camera-preview"
          style={{ width: '100%', maxHeight: '400px', background: '#000', borderRadius: '8px' }}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="text-center mb-3">
        <button 
          className="btn btn-primary btn-lg"
          onClick={captureImage}
        >
          <i className="bi bi-camera me-2"></i>
          Capture {cameraType === 'front' ? 'Front' : cameraType === 'back' ? 'Back' : 'Selfie'}
        </button>
      </div>

      <div className="row">
        <div className="col-4 text-center">
          <div className="border p-2 rounded">
            {capturedImages.front ? (
              <img src={capturedImages.front} alt="Front" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
            ) : (
              <span className="text-muted">Front</span>
            )}
            <small className="d-block text-muted">Front ID</small>
          </div>
        </div>
        <div className="col-4 text-center">
          <div className="border p-2 rounded">
            {capturedImages.back ? (
              <img src={capturedImages.back} alt="Back" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
            ) : (
              <span className="text-muted">Back</span>
            )}
            <small className="d-block text-muted">Back ID</small>
          </div>
        </div>
        <div className="col-4 text-center">
          <div className="border p-2 rounded">
            {capturedImages.selfie ? (
              <img src={capturedImages.selfie} alt="Selfie" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
            ) : (
              <span className="text-muted">Selfie</span>
            )}
            <small className="d-block text-muted">Selfie</small>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h5 className="mb-3">✅ Confirmation</h5>
      
      <div className="alert alert-success">
        <i className="bi bi-check-circle-fill me-2"></i>
        All information has been captured successfully.
        {verificationStatus && (
          <span className="badge bg-success ms-2">ID Verified ✓</span>
        )}
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h6>Book Details</h6>
          <p className="mb-1"><strong>Title:</strong> {book.title}</p>
          <p className="mb-1"><strong>Author:</strong> {book.author}</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h6>Borrower Details</h6>
          <p className="mb-1"><strong>Role:</strong> {formData.role}</p>
          {formData.role === 'student' ? (
            <>
              <p className="mb-1"><strong>Student ID:</strong> {formData.student_id}</p>
              <p className="mb-1"><strong>Student Name:</strong> {formData.student_name}</p>
            </>
          ) : formData.role === 'academic_staff' ? (
            <>
              <p className="mb-1"><strong>Staff ID:</strong> {formData.staff_id}</p>
              <p className="mb-1"><strong>Staff Name:</strong> {formData.staff_name}</p>
              <p className="mb-1"><strong>Position:</strong> {formData.staff_position}</p>
            </>
          ) : null}
          <p className="mb-1"><strong>Duration:</strong> {formData.borrow_duration} days</p>
        </div>
      </div>

      <div className="row">
        <div className="col-4 text-center">
          <img src={capturedImages.front} alt="Front ID" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
        </div>
        <div className="col-4 text-center">
          <img src={capturedImages.back} alt="Back ID" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
        </div>
        <div className="col-4 text-center">
          <img src={capturedImages.selfie} alt="Selfie" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              📖 Borrow Book: {book.title}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="progress mb-4">
              <div 
                className="progress-bar" 
                style={{ width: `${(step / 3) * 100}%` }}
              >
                Step {step} of 3
              </div>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>
          <div className="modal-footer">
            {step > 1 && (
              <button 
                className="btn btn-secondary"
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button 
                className="btn btn-primary"
                onClick={handleNextStep}
                disabled={loading || verifying}
              >
                {verifying ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Verifying...
                  </>
                ) : (
                  'Next'
                )}
              </button>
            )}
            {step === 3 && (
              <button 
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Processing...
                  </>
                ) : (
                  'Confirm Borrow'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BorrowBookModal;