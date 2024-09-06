import React from 'react';
import { EvaluationResult } from '../services/evaluator';

interface EvaluationResultsProps {
  result: EvaluationResult;
}

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ result }) => {
  return (
    <div className="evaluation-results">
      <h2>Overall Score: {result.aiAnalysis?.overallScore ?? 'N/A'}</h2>
      
      <h3>Performance Metrics</h3>
      <ul>
        <li>Load Time: {result.loadTime?.toFixed(2) ?? 'N/A'} ms</li>
        <li>DOM Content Loaded: {result.domContentLoaded?.toFixed(2) ?? 'N/A'} ms</li>
        <li>First Paint: {result.firstPaint?.toFixed(2) ?? 'N/A'} ms</li>
        <li>First Contentful Paint: {result.firstContentfulPaint?.toFixed(2) ?? 'N/A'} ms</li>
        <li>Time to Interactive: {result.timeToInteractive?.toFixed(2) ?? 'N/A'} ms</li>
        <li>Largest Contentful Paint: {result.largestContentfulPaint?.toFixed(2) ?? 'N/A'} ms</li>
        <li>Cumulative Layout Shift: {result.cumulativeLayoutShift?.toFixed(4) ?? 'N/A'}</li>
        <li>DOM Elements: {result.domElements ?? 'N/A'}</li>
        <li>Page Size: {result.pageSize ? (result.pageSize / 1024).toFixed(2) : 'N/A'} KB</li>
        <li>Total Requests: {result.requests ?? 'N/A'}</li>
      </ul>

      <h3>UI Analysis</h3>
      <p>{result.aiAnalysis?.uiAnalysis ?? 'N/A'}</p>
      <h4>Color Contrast</h4>
      <p>Low Contrast Elements: {result.colorContrast?.lowContrastElements ?? 'N/A'}</p>
      <h4>Font Sizes</h4>
      <ul>
        {Object.entries(result.fontSizes || {}).map(([size, count]) => (
          <li key={size}>{size}: {count} elements</li>
        ))}
      </ul>
      <h4>Responsiveness</h4>
      <p>Is Responsive: {result.responsiveness?.isResponsive ? 'Yes' : 'No'}</p>
      <p>Viewport Width: {result.responsiveness?.viewportWidth ?? 'N/A'}px</p>
      <p>Page Width: {result.responsiveness?.pageWidth ?? 'N/A'}px</p>

      <h3>Functionality Analysis</h3>
      <p>{result.aiAnalysis?.functionalityAnalysis ?? 'N/A'}</p>
      <h4>Links</h4>
      <p>Total Links: {result.brokenLinks?.totalLinks ?? 'N/A'}</p>
      <p>Broken Links: {result.brokenLinks?.brokenLinks ?? 'N/A'}</p>
      <h4>Forms</h4>
      <p>Total Forms: {result.formFunctionality?.totalForms ?? 'N/A'}</p>
      <p>Forms with Submit Button: {result.formFunctionality?.formsWithSubmitButton ?? 'N/A'}</p>

      <h3>Recommendations</h3>
      <ul>
        {result.aiAnalysis?.recommendations?.map((rec, index) => (
          <li key={index}>{rec}</li>
        )) ?? <li>No recommendations available</li>}
      </ul>

      <h3>Screenshot</h3>
      {result.screenshot && (
        <img src={`data:image/png;base64,${result.screenshot}`} alt="Website Screenshot" style={{maxWidth: '100%'}} />
      )}
    </div>
  );
};

export default EvaluationResults;