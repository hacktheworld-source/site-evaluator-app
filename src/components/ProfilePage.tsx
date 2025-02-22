import React, { useState, useEffect } from 'react';
import { auth, deleteUserAccount } from '../services/firebase';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getUserBalance } from '../services/points';
import { reportStorage, StoredReport } from '../services/reportStorage';
import defaultUserIcon from '../assets/default-user-icon.png';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faSpinner, faTrash, faSquare, faCheckSquare, faSignOutAlt, faKey, faBolt } from '@fortawesome/free-solid-svg-icons';
import { useAuthState } from 'react-firebase-hooks/auth';
import { paymentService } from '../services/paymentService';

interface UserData {
  balance: number;
  isPayAsYouGo: boolean;
  hasAddedPayment: boolean;
}

const ProfilePage: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isDeletingReports, setIsDeletingReports] = useState(false);
  const [isDownloadingMultiple, setIsDownloadingMultiple] = useState(false);
  const [showDeleteReportConfirm, setShowDeleteReportConfirm] = useState<string | null>(null);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const [points, userDataResponse] = await Promise.all([
          getUserBalance(user.uid),
          paymentService.getUserData(user.uid),
          reportStorage.getUserReports(user.uid)
        ]);
        setUserPoints(points);
        setUserData(userDataResponse);

        const userReports = await reportStorage.getUserReports(user.uid);
        setReports(userReports.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load user data. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };

    if (!loading) {
      fetchUserData();
    }
  }, [user, loading]);

  const handleDownload = async (report: StoredReport) => {
    if (!user) {
      toast.error('Please sign in to download reports');
      return;
    }

    setDownloadingReportId(report.id);
    try {
      await reportStorage.regenerateAndDownloadReport(report);
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!user) return;

    setShowDeleteReportConfirm(reportId);
  };

  const confirmDelete = async (reportId: string) => {
    if (!user) return;

    try {
      await reportStorage.deleteReport(user.uid, reportId);
      setReports(prevReports => prevReports.filter(report => report.id !== reportId));
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    } finally {
      setShowDeleteReportConfirm(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (!user || selectedReports.size === 0) return;
    setShowDeleteSelectedConfirm(true);
  };

  const confirmDeleteSelected = async () => {
    if (!user || selectedReports.size === 0) return;

    setIsDeletingReports(true);
    try {
      await reportStorage.deleteMultipleReports(user.uid, Array.from(selectedReports));
      setReports(prevReports => prevReports.filter(report => !selectedReports.has(report.id)));
      setSelectedReports(new Set());
      setIsAllSelected(false);
      toast.success('Selected reports deleted successfully');
    } catch (error) {
      console.error('Error deleting reports:', error);
      toast.error('Failed to delete selected reports');
    } finally {
      setIsDeletingReports(false);
      setShowDeleteSelectedConfirm(false);
    }
  };

  const handleDownloadSelected = async () => {
    if (!user || selectedReports.size === 0) return;

    setIsDownloadingMultiple(true);
    try {
      const selectedReportObjects = reports.filter(report => selectedReports.has(report.id));
      await reportStorage.downloadMultipleReports(selectedReportObjects);
      toast.success('Selected reports downloaded successfully');
    } catch (error) {
      console.error('Error downloading reports:', error);
      toast.error('Failed to download selected reports');
    } finally {
      setIsDownloadingMultiple(false);
    }
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports.map(report => report.id)));
    }
    setIsAllSelected(!isAllSelected);
  };

  const toggleReportSelection = (reportId: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReports(newSelected);
    setIsAllSelected(newSelected.size === reports.length);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeletingAccount(true);
    try {
      await deleteUserAccount(user);
      toast.success('Account deleted successfully');
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('Failed to delete account. Please try again.');
      setIsDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully');
      window.location.reload();
    } catch (error) {
      console.error('Sign-out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      // First, reauthenticate the user
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Then update the password
      await updatePassword(user, newPassword);
      
      toast.success('Password updated successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      if (error instanceof Error) {
        if (error.message.includes('auth/wrong-password')) {
          toast.error('Current password is incorrect');
        } else {
          toast.error('Failed to change password. Please try again.');
        }
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="profile-page">Loading profile...</div>;
  }

  if (!user) {
    return <div className="profile-page">Please sign in to view your profile.</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-layout">
        <div className="profile-column">
          <div className="profile-info">
            <img 
              src={user.photoURL || defaultUserIcon} 
              alt="Profile" 
              className="profile-picture"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = defaultUserIcon;
              }}
            />
            <p><strong>Name:</strong> {user.displayName || 'N/A'}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p className="balance-info">
              <strong>Balance:</strong> {userPoints !== null ? `$${userPoints.toFixed(2)}` : 'Loading...'}
              {userData?.isPayAsYouGo && (
                <span className="pay-as-you-go-badge">
                  <FontAwesomeIcon icon={faBolt} className="pay-as-you-go-icon" />
                  Pay-as-you-go
                </span>
              )}
            </p>
          </div>

          <div className="account-actions">
            <button 
              className="change-password-button"
              onClick={() => setShowChangePassword(true)}
            >
              <FontAwesomeIcon icon={faKey} />
              Change Password
            </button>

            <button 
              className="sign-out-button"
              onClick={handleSignOut}
            >
              <FontAwesomeIcon icon={faSignOutAlt} />
              Sign Out
            </button>
          </div>

          <div className="danger-zone">
            <h3>Danger Zone</h3>
            <div className="delete-account-section">
              <p>Delete your account and all associated data. This action cannot be undone.</p>
              {!showDeleteConfirm ? (
                <button 
                  className="delete-account-button"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Account
                </button>
              ) : (
                <div className="delete-confirmation">
                  <p>Are you sure you want to delete your account? This cannot be undone.</p>
                  <div className="confirmation-buttons">
                    <button
                      className="confirm-delete-button"
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        'Yes, Delete My Account'
                      )}
                    </button>
                    <button
                      className="cancel-delete-button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeletingAccount}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="reports-column">
          <div className="reports-header">
            <h2>Your Reports</h2>
            {reports.length > 0 && (
              <div className="reports-actions">
                <button 
                  className="select-all-button"
                  onClick={toggleSelectAll}
                >
                  <FontAwesomeIcon icon={isAllSelected ? faCheckSquare : faSquare} />
                  {isAllSelected ? ' Deselect All' : ' Select All'}
                </button>
                {selectedReports.size > 0 && (
                  <>
                    <button
                      className="bulk-action-button"
                      onClick={handleDownloadSelected}
                      disabled={isDownloadingMultiple}
                    >
                      {isDownloadingMultiple ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <FontAwesomeIcon icon={faDownload} />
                      )}
                      {' Download Selected'}
                    </button>
                    <button
                      className="bulk-action-button delete"
                      onClick={handleDeleteSelected}
                      disabled={isDeletingReports}
                    >
                      {isDeletingReports ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <FontAwesomeIcon icon={faTrash} />
                      )}
                      {' Delete Selected'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="loading-state">
              <FontAwesomeIcon icon={faSpinner} spin />
              <p>Loading reports...</p>
            </div>
          ) : reports.length > 0 ? (
            <div className="reports-list">
              {reports.map(report => (
                <div key={report.id} className={`report-item ${selectedReports.has(report.id) ? 'selected' : ''}`}>
                  <div className="report-checkbox">
                    <button
                      className={`checkbox-button ${selectedReports.has(report.id) ? 'selected' : ''}`}
                      onClick={() => toggleReportSelection(report.id)}
                    >
                      <FontAwesomeIcon 
                        icon={selectedReports.has(report.id) ? faCheckSquare : faSquare}
                      />
                    </button>
                  </div>
                  <div className="report-info">
                    <h4>{report.websiteUrl}</h4>
                    <p className="report-date">Generated on {formatDate(report.timestamp)}</p>
                    <div className="report-metrics">
                      <span className="metric">
                        <strong>Overall Score:</strong> {report.overallScore}%
                      </span>
                      {Object.entries(report.phaseScores).map(([phase, score]) => (
                        <span key={phase} className="metric">
                          <strong>{phase}:</strong> {score}%
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="report-actions">
                    <button 
                      onClick={() => handleDownload(report)}
                      className="download-report-button"
                      disabled={downloadingReportId === report.id}
                      title="Download Report"
                    >
                      {downloadingReportId === report.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <FontAwesomeIcon icon={faDownload} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="delete-report-button"
                      title="Delete Report"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-reports">No reports generated yet.</p>
          )}
        </div>
      </div>

      {showDeleteReportConfirm && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-dialog">
            <p>Are you sure you want to delete this report?</p>
            <div className="confirmation-buttons">
              <button
                className="confirm-button"
                onClick={() => confirmDelete(showDeleteReportConfirm)}
              >
                Delete
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowDeleteReportConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSelectedConfirm && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-dialog">
            <p>Are you sure you want to delete {selectedReports.size} selected reports?</p>
            <div className="confirmation-buttons">
              <button
                className="confirm-button"
                onClick={confirmDeleteSelected}
                disabled={isDeletingReports}
              >
                {isDeletingReports ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  'Delete'
                )}
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowDeleteSelectedConfirm(false)}
                disabled={isDeletingReports}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="delete-confirmation-overlay">
          <div className="change-password-dialog">
            <h3>Change Password</h3>
            <div className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className="confirmation-buttons">
              <button
                className="confirm-button"
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {isChangingPassword ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  'Change Password'
                )}
              </button>
              <button
                className="cancel-button"
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isChangingPassword}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;