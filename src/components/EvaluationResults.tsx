import React from 'react';
import { EvaluationResult } from '../services/evaluator'; // Make sure to import the correct type

interface EvaluationResultsProps {
  result: EvaluationResult;
}

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ result }) => {
  return (
    <div className="evaluation-results">
      {result.isLimited && (
        <div className="limited-warning">
          <p className="text-yellow-500 font-bold mb-2">
            ⚠️ Limited Evaluation
          </p>
          <p className="text-sm text-gray-600 mb-4">
            We were unable to fully access the website content. This evaluation may be incomplete or less accurate.
          </p>
        </div>
      )}

      <h2 className="text-xl font-bold mb-2">Overall Score: {result.overall}</h2>
      
      <div className="categories mb-4">
        <h3 className="text-lg font-semibold mb-2">Category Scores:</h3>
        <ul>
          {Object.entries(result.categories).map(([category, score]) => (
            <li key={category} className="mb-1">
              <span className="capitalize">{category}:</span> {score}
            </li>
          ))}
        </ul>
      </div>

      <div className="ai-analysis">
        <h3 className="text-lg font-semibold mb-2">AI Analysis:</h3>
        <p>{result.aiAnalysis}</p>
      </div>
    </div>
  );
};

export default EvaluationResults;