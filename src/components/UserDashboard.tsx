import React, { useEffect, useState } from 'react';
import { getUserEvaluations, Evaluation, deleteEvaluation, clearAllEvaluations } from '../services/database';

interface UserDashboardProps {
  userId: string;
  refreshTrigger: number;
  onDetailPopupOpen: (evaluation: Evaluation) => void;
  onConfirmDialogOpen: (action: () => void) => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ 
  userId, 
  refreshTrigger, 
  onDetailPopupOpen, 
  onConfirmDialogOpen 
}) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvaluations();
  }, [userId, refreshTrigger]);

  const fetchEvaluations = async () => {
    try {
      const userEvaluations = await getUserEvaluations(userId);
      setEvaluations(userEvaluations);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (evaluation: Evaluation) => {
    onConfirmDialogOpen(async () => {
      if (evaluation.id) {
        await deleteEvaluation(userId, evaluation.id);
        fetchEvaluations();
      } else {
        console.error('Evaluation ID is missing');
      }
    });
  };

  const handleClearAll = () => {
    onConfirmDialogOpen(async () => {
      await clearAllEvaluations(userId);
      fetchEvaluations();
    });
  };

  if (isLoading) {
    return <p>Loading your evaluations...</p>;
  }

  return (
    <div className="history-panel-content">
      <h3 className="history-panel-title">Your Evaluations</h3>
      <button className="clear-all-button" onClick={handleClearAll}>Clear All</button>
      {evaluations.length === 0 ? (
        <p>You haven't evaluated any websites yet.</p>
      ) : (
        <div>
          {evaluations.map((evaluation) => (
            <div 
              key={evaluation.id || evaluation.websiteUrl} 
              className="history-item"
              onClick={() => onDetailPopupOpen(evaluation)}
            >
              <p>Website: {evaluation.websiteUrl}</p>
              <p>Overall Score: {evaluation.aiAnalysis.overallScore}</p>
              <p>Date: {evaluation.timestamp.toLocaleString()}</p>
              <div className="history-item-actions">
                {evaluation.id && (
                  <button 
                    className="delete-button" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDelete(evaluation); 
                    }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;