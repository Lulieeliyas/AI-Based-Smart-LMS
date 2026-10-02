import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import userService from '../../services/userService';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    student_id: '',
    profile_picture: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
        student_id: user.student_id || '',
        profile_picture: null
      });
      setPreviewImage(user.profile_picture || null);
    }
  }, [user]);

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfile({ ...profile, profile_picture: file });
      
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      Object.keys(profile).forEach(key => {
        if (profile[key] !== null && profile[key] !== undefined && profile[key] !== '') {
          formData.append(key, profile[key]);
        }
      });

      const response = await userService.updateProfile(formData);
      
      setSuccess('Profile updated successfully!');
      toast.success('Profile updated successfully!');
      
      // Update user context
      if (response.data) {
        updateUser(response.data);
      } else {
        const updatedUser = await userService.getProfile();
        updateUser(updatedUser.data);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to update profile';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="card shadow-lg border-0 rounded-4">
          <div className="card-body p-4">
            <h2 className="text-center mb-4">👤 User Profile</h2>

            {error && (
              <div className="alert alert-danger alert-dismissible fade show">
                {error}
                <button type="button" className="btn-close" onClick={() => setError('')}></button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success alert-dismissible fade show">
                {success}
                <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
              </div>
            )}

            {/* Avatar */}
            <div className="text-center mb-4">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile"
                  className="rounded-circle"
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center"
                  style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}
                >
                  {user?.first_name?.charAt(0)?.toUpperCase() || 
                   user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <h5 className="mt-3 mb-1">
                {user?.first_name} {user?.last_name}
              </h5>
              <span className="badge bg-secondary">
                {user?.role?.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Name Fields */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="first_name"
                    value={profile.first_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="last_name"
                    value={profile.last_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Phone */}
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-control"
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  placeholder="e.g., 0912345678"
                />
              </div>

              {/* Department */}
              <div className="mb-3">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-control"
                  name="department"
                  value={profile.department}
                  onChange={handleChange}
                  placeholder="e.g., Software Engineering"
                />
              </div>

              {/* Student ID */}
              {user?.role === 'student' && (
                <div className="mb-3">
                  <label className="form-label">Student ID</label>
                  <input
                    type="text"
                    className="form-control"
                    name="student_id"
                    value={profile.student_id}
                    onChange={handleChange}
                    placeholder="e.g., MAU1400629"
                  />
                </div>
              )}

              {/* Profile Picture */}
              <div className="mb-4">
                <label className="form-label">Profile Picture</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <small className="text-muted">
                  Max size: 5MB. Supported formats: JPG, PNG, GIF
                </small>
              </div>

              {/* Buttons */}
              <div className="d-grid gap-2">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Update Profile
                    </>
                  )}
                </button>
                
                <Link to="/change-password" className="btn btn-outline-secondary">
                  <i className="bi bi-key me-2"></i>
                  Change Password
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;