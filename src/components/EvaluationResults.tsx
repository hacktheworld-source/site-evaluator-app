import React from 'react';
import { EvaluationResult } from '../services/evaluator';

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

      <div className="metrics mb-4">
        <h3 className="text-lg font-semibold mb-2">Metrics:</h3>
        <ul>
          {Object.entries(result.metrics).map(([metric, value]) => (
            <li key={metric} className="mb-1">
              <span className="capitalize">{metric.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
              {renderMetricValue(metric, value)}
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

function renderMetricValue(metric: string, value: any): React.ReactNode {
  if (typeof value === 'number') {
    if (metric.includes('Time') || metric.includes('Paint')) {
      return `${value.toFixed(2)} ms`;
    } else if (metric === 'pageSize') {
      return `${(value / 1024).toFixed(2)} KB`;
    } else if (metric === 'domElements' || metric === 'requests') {
      return value.toFixed(0);
    } else {
      return value.toFixed(2);
    }
  }
  return value;
}

export default EvaluationResults;