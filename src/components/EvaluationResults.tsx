import React from 'react';

interface EvaluationResultsProps {
  results: {
    overall: number;
    categories: {
      [key: string]: number;
    };
    aiAnalysis: string;
  };
}

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ results }) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'green';
    if (score >= 6) return 'orange';
    return 'red';
  };

  return (
    <div>
      <h2>Evaluation Results</h2>
      <p>Overall Score: <span style={{ color: getScoreColor(results.overall) }}>{results.overall.toFixed(1)}</span></p>
      <h3>Category Scores:</h3>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {Object.entries(results.categories).map(([category, score]) => (
          <li key={category} style={{ marginBottom: '10px' }}>
            <strong>{category.charAt(0).toUpperCase() + category.slice(1)}:</strong> 
            <span style={{ color: getScoreColor(score) }}> {score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <h3>AI Content Analysis:</h3>
      <p>{results.aiAnalysis}</p>
    </div>
  );
};

export default EvaluationResults;