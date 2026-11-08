
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import userService from '../../services/userService';

const emptyProfile = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  phone: '',
  department: '',
  student_id: '',
  role: '',
  is_email_verified: false,
  is_active: false,
  profile_picture: null,
};

const getProfileData = (response) => {
  const data = response?.data ?? response;

  // Support common API response structures.
  return data?.user ?? data?.profile ?? data;
};

const UserProfile = () => {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(emptyProfile);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        // Get complete profile information from the backend.
        const response = await userService.getProfile();
        const data = getProfileData(response);

        if (!data || typeof data !== 'object') {
          throw new Error('The server returned invalid profile information.');
        }

        if (!mounted) return;

        const combined = {
          ...emptyProfile,
          ...(user || {}),
          ...data,
        };

        setProfile({
          ...emptyProfile,
          first_name: combined.first_name || '',
          last_name: combined.last_name || '',
          username: combined.username || '',
          email: combined.email || '',
          phone: combined.phone || combined.phone_number || '',
          department: combined.department || '',
          student_id: combined.student_id || '',
          role: combined.role || '',
          is_email_verified: Boolean(combined.is_email_verified),
          is_active: Boolean(combined.is_active),
          profile_picture: combined.profile_picture || null,
        });

        setPreviewImage(combined.profile_picture || null);

        // Refresh the authenticated user context with the latest data.
        if (typeof updateUser === 'function') {
          updateUser(combined);
        }
      } catch (err) {
        console.error('Profile loading error:', err);

        if (!mounted) return;

        // Show available authentication data if the profile endpoint fails.
        if (user) {
          setProfile({
            ...emptyProfile,
            ...user,
            phone: user.phone || user.phone_number || '',
          });
          setPreviewImage(user.profile_picture || null);
        }

        const message =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          err.message ||
          'Unable to load your profile.';

        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile picture must not exceed 5 MB.');
      e.target.value = '';
      return;
    }

    setSelectedPicture(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setError('');

    try {
      let payload;

      if (selectedPicture) {
        payload = new FormData();
        payload.append('first_name', profile.first_name);
        payload.append('last_name', profile.last_name);
        payload.append('email', profile.email);
        payload.append('phone', profile.phone);
        payload.append('profile_picture', selectedPicture);
      } else {
        payload = {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
        };
      }

      // PATCH changes only the editable fields.
      const response = await userService.partialUpdateProfile(payload);
      const updatedData = getProfileData(response);

      const updatedUser = {
        ...profile,
        ...(updatedData || {}),
      };

      setProfile((previous) => ({
        ...previous,
        ...updatedUser,
        phone: updatedUser.phone || updatedUser.phone_number || '',
      }));

      if (updatedUser.profile_picture) {
        setPreviewImage(updatedUser.profile_picture);
      }

      setSelectedPicture(null);

      if (typeof updateUser === 'function') {
        updateUser(updatedUser);
      }

      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        Object.values(err.response?.data || {})
          .flat()
          .find((value) => typeof value === 'string') ||
        'Failed to update your profile.';

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const displayValue = (value) => value || 'Not provided';

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-xl-7">
          <div className="card shadow border-0 rounded-4">
            <div className="card-header text-white py-3 rounded-top-4"
              style={{ backgroundColor: '#17243a' }}>
              <h4 className="mb-0">
                <i className="bi bi-person-circle me-2" />
                My Profile
              </h4>
            </div>

            <div className="card-body p-4">

              {error && (
                <div className="alert alert-warning" role="alert">
                  {error}
                </div>
              )}

              {/* Profile picture and identity */}
              <div className="text-center mb-4">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="rounded-circle border"
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    className="rounded-circle text-white mx-auto d-flex align-items-center justify-content-center"
                    style={{
                      width: 120,
                      height: 120,
                      fontSize: '2.5rem',
                      backgroundColor: '#17243a',
                    }}
                  >
                    {(profile.first_name || profile.username || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <h5 className="mt-3 mb-1">
                  {[profile.first_name, profile.last_name]
                    .filter(Boolean)
                    .join(' ') || profile.username || 'User'}
                </h5>

                <span className="badge bg-secondary">
                  {(profile.role || 'User').replaceAll('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Account information */}
              <h5 className="mb-3">
                <i className="bi bi-person-vcard me-2" />
                Account Information
              </h5>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label text-muted">Username</label>
                  <div className="form-control bg-light">
                    {displayValue(profile.username)}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted">Role</label>
                  <div className="form-control bg-light">
                    {displayValue(profile.role?.replaceAll('_', ' '))}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted">Student ID</label>
                  <div className="form-control bg-light">
                    {displayValue(profile.student_id)}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted">Department</label>
                  <div className="form-control bg-light">
                    {displayValue(profile.department)}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted">Email Verification</label>
                  <div className="form-control bg-light">
                    {profile.is_email_verified ? 'Verified' : 'Not verified'}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label text-muted">Account Status</label>
                  <div className="form-control bg-light">
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              <hr />

              {/* Editable personal information */}
              <h5 className="mb-3">
                <i className="bi bi-pencil-square me-2" />
                Personal Information
              </h5>

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      name="first_name"
                      className="form-control"
                      value={profile.first_name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      name="last_name"
                      className="form-control"
                      value={profile.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    value={profile.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    className="form-control"
                    value={profile.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/png,image/jpeg,image/gif"
                    onChange={handleFileChange}
                  />
                  <small className="text-muted">
                    JPG, PNG, or GIF. Maximum size: 5 MB.
                  </small>
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2" />
                        Update Profile
                      </>
                    )}
                  </button>

                  <Link
                    to="/change-password"
                    className="btn btn-outline-secondary"
                  >
                    <i className="bi bi-key me-2" />
                    Change Password
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
