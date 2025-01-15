import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getUserPoints } from '../services/database';
import { reportStorage, StoredReport } from '../services/reportStorage';
import defaultUserIcon from '../assets/default-user-icon.png';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAuthState } from 'react-firebase-hooks/auth';

const ProfilePage: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Fetch points first to ensure user document exists
        const points = await getUserPoints(user.uid);
        setUserPoints(points);

        // Then fetch reports
        const userReports = await reportStorage.getUserReports(user.uid);
        // Sort reports by date, newest first
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="profile-page">Loading profile...</div>;
  }

  if (!user) {
    return <div className="profile-page">Please sign in to view your profile.</div>;
  }

  return (
    <div className="profile-page">
      <h2>User Profile</h2>
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
        <p><strong>Points:</strong> {userPoints !== null ? userPoints : 'Loading...'}</p>
      </div>
      
      <div className="reports-section">
        <h3>Your Reports</h3>
        {isLoading ? (
          <div className="loading-state">
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Loading reports...</p>
          </div>
        ) : reports.length > 0 ? (
          <div className="reports-list">
            {reports.map(report => (
              <div key={report.id} className="report-item">
                <div className="report-info">
                  <h4>{report.websiteUrl}</h4>
                  <p className="report-date">Generated on {formatDate(report.timestamp)}</p>
                  <div className="report-metrics">
                    <span className="metric">
                      <strong>Overall Score:</strong> {report.overallScore}%
                    </span>
                    {report.essentialMetrics.performance.loadTime && (
                      <span className="metric">
                        <strong>Load Time:</strong> {report.essentialMetrics.performance.loadTime}ms
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload(report)}
                  className="download-report-button"
                  disabled={downloadingReportId === report.id}
                >
                  {downloadingReportId === report.id ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faDownload} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>No reports generated yet.</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;