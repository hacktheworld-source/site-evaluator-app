import React from 'react';
import { EvaluationResult } from '../services/evaluator';

interface EvaluationResultsProps {
  result: EvaluationResult;
}

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ result }) => {
  console.log('Evaluation result:', result);
  
  const formatMetric = (value: number | string | undefined, decimals: number = 2): string => {
    if (typeof value === 'number') {
      return value.toFixed(decimals);
    }
    return value?.toString() ?? 'N/A';
  };

  return (
    <div className="evaluation-results">
      <h2>Overall Score: {result.aiAnalysis?.overallScore ?? 'N/A'}</h2>
      
      {/* Performance Metrics */}
      <h3>Performance Metrics</h3>
      <ul>
        <li>Load Time: {formatMetric(result.loadTime)} ms</li>
        <li>DOM Content Loaded: {formatMetric(result.domContentLoaded)} ms</li>
        <li>First Paint: {formatMetric(result.firstPaint)} ms</li>
        <li>First Contentful Paint: {formatMetric(result.firstContentfulPaint)} ms</li>
        <li>Time to Interactive: {formatMetric(result.timeToInteractive)} ms</li>
        <li>Largest Contentful Paint: {formatMetric(result.largestContentfulPaint)} ms</li>
        <li>Cumulative Layout Shift: {formatMetric(result.cumulativeLayoutShift, 4)}</li>
        <li>Time to First Byte (TTFB): {formatMetric(result.ttfb)} ms</li>
        <li>Total Blocking Time (TBT): {formatMetric(result.tbt)} ms</li>
        <li>Estimated First Input Delay (FID): {formatMetric(result.estimatedFid)} ms</li>
        <li>DOM Elements: {result.domElements ?? 'N/A'}</li>
        <li>Page Size: {result.pageSize ? (result.pageSize / 1024).toFixed(2) : 'N/A'} KB</li>
        <li>Total Requests: {result.requests ?? 'N/A'}</li>
      </ul>

      {/* SEO Metrics */}
      <h3>SEO Metrics</h3>
      <ul>
        <li>Title: {result.seo?.title ?? 'N/A'}</li>
        <li>Meta Description: {result.seo?.metaDescription ?? 'N/A'}</li>
        <li>Canonical URL: {result.seo?.canonicalUrl ?? 'N/A'}</li>
        <li>H1 Tag: {result.seo?.h1 ?? 'N/A'}</li>
        <li>Meta Viewport: {result.seo?.metaViewport ?? 'N/A'}</li>
      </ul>

      {/* Best Practices */}
      <h3>Best Practices</h3>
      <ul>
        <li>Semantic Elements Usage:
          <ul>
            {Object.entries(result.bestPractices?.semanticUsage || {}).map(([element, count]) => (
              <li key={element}>{element}: {count}</li>
            ))}
          </ul>
        </li>
        <li>Optimized Images: {result.bestPractices?.optimizedImages ?? 'N/A'} / {result.bestPractices?.totalImages ?? 'N/A'}</li>
      </ul>

      <h3>Lighthouse Scores</h3>
      <ul>
        <li>Performance: {formatMetric(result.lighthouse?.performance)}</li>
        <li>Accessibility: {formatMetric(result.lighthouse?.accessibility)}</li>
        <li>Best Practices: {formatMetric(result.lighthouse?.bestPractices)}</li>
        <li>SEO: {formatMetric(result.lighthouse?.seo)}</li>
      </ul>
    </div>
  );
};

export default EvaluationResults;