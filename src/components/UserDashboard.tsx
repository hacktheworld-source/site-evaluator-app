import React, { useEffect, useState, useCallback } from 'react';
import { getUserEvaluations, Evaluation } from '../services/database';

interface UserDashboardProps {
  userId: string;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ userId }) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const fetchEvaluations = useCallback(async () => {
    const userEvaluations = await getUserEvaluations(userId);
    setEvaluations(userEvaluations);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  if (isLoading) {
    return <p>Loading your evaluations...</p>;
  }

  return (
    <div>
      <h2>Your Past Evaluations</h2>
      {evaluations.length === 0 ? (
        <p>You haven't evaluated any websites yet.</p>
      ) : (
        <div>
          <ul>
            {evaluations.map((evaluation, index) => (
              <li key={index}>
                <p>Website: {evaluation.websiteUrl}</p>
                <p>Overall Score: {evaluation.overall}</p>
                <p>Date: {evaluation.timestamp.toLocaleString()}</p>
                <button onClick={() => setSelectedEvaluation(evaluation)}>View Details</button>
              </li>
            ))}
          </ul>
          {selectedEvaluation && (
            <div>
              <h3>Detailed Evaluation for {selectedEvaluation.websiteUrl}</h3>
              <p>Overall Score: {selectedEvaluation.overall}</p>
              <h4>Category Scores:</h4>
              <ul>
                {Object.entries(selectedEvaluation.categories).map(([category, score]) => (
                  <li key={category}>{category}: {score}</li>
                ))}
              </ul>
              <h4>AI Analysis:</h4>
              <p>{selectedEvaluation.aiAnalysis}</p>
              <button onClick={() => setSelectedEvaluation(null)}>Close Details</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;