import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="legal-page terms-of-service">
      <div className="legal-content">
        <h1>Terms of Service</h1>
        
        <section>
          <h2>1. Introduction</h2>
          <p>Welcome to Olive Site Evaluator ("we," "our," or "us"). By accessing or using our website evaluation service, you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the service.</p>
        </section>

        <section>
          <h2>2. Service Description</h2>
          <p>Olive Site Evaluator provides automated website analysis and evaluation services, including but not limited to:</p>
          <ul>
            <li>Performance analysis using Lighthouse and custom metrics</li>
            <li>Security assessment and vulnerability scanning</li>
            <li>SEO analysis and recommendations</li>
            <li>Accessibility compliance checking</li>
            <li>AI-powered chat interface for website analysis</li>
            <li>Professional report generation</li>
          </ul>
          <p>While we strive for accuracy, our service provides automated analysis and recommendations that should not be considered as professional consulting advice.</p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>To use our service, you must:</p>
          <ul>
            <li>Create an account with valid information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Be at least 18 years old or have legal guardian consent</li>
          </ul>
          <p>We reserve the right to terminate accounts that violate these terms or engage in unauthorized activities.</p>
        </section>

        <section>
          <h2>4. Payment Terms</h2>
          <p>Our service operates on a credit-based system with the following terms:</p>
          <ul>
            <li>Credits can be purchased through our secure payment system</li>
            <li>We offer both prepaid credits and pay-as-you-go options</li>
            <li>All payments are processed securely through Stripe</li>
            <li>Prices are subject to change with notice</li>
            <li>Refunds are handled on a case-by-case basis</li>
          </ul>
          <p>Detailed pricing information is available on our website. Unused credits remain valid indefinitely unless otherwise specified.</p>
        </section>

        <section>
          <h2>5. Data Usage</h2>
          <p>By using our service, you grant us permission to:</p>
          <ul>
            <li>Analyze and store information about the websites you submit</li>
            <li>Generate and store reports based on our analysis</li>
            <li>Use aggregated, anonymized data for service improvement</li>
            <li>Process your data as outlined in our Privacy Policy</li>
          </ul>
          <p>We do not claim ownership of the websites you analyze or their content.</p>
        </section>

        <section>
          <h2>6. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul>
            <li>Only analyze websites you own or have permission to analyze</li>
            <li>Not use our service for any illegal or unauthorized purpose</li>
            <li>Not attempt to probe, scan, or test the vulnerability of our system</li>
            <li>Not interfere with or disrupt our service or servers</li>
            <li>Comply with all applicable laws and regulations</li>
          </ul>
        </section>

        <section>
          <h2>7. Service Limitations</h2>
          <p>Our service is provided "as is" with the following limitations:</p>
          <ul>
            <li>We do not guarantee 100% accuracy of analysis results</li>
            <li>Some websites may block our automated analysis tools</li>
            <li>Service availability may be affected by maintenance or technical issues</li>
            <li>Analysis speed depends on website size and complexity</li>
            <li>Report storage is limited to 100 reports per user</li>
          </ul>
        </section>

        <section>
          <h2>8. Intellectual Property</h2>
          <p>All rights, title, and interest in and to the service (excluding content provided by users) remain our exclusive property. Our service, including software, features, and functionality, is protected by copyright, trademark, and other laws.</p>
        </section>

        <section>
          <h2>9. Third-Party Services</h2>
          <p>Our service integrates with third-party services including:</p>
          <ul>
            <li>Firebase for authentication and data storage</li>
            <li>Stripe for payment processing</li>
            <li>OpenAI for AI-powered analysis</li>
            <li>Google Lighthouse for performance metrics</li>
          </ul>
          <p>Use of these services is subject to their respective terms and conditions.</p>
        </section>

        <section>
          <h2>10. Termination</h2>
          <p>We may terminate or suspend your account and access to the service immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the service will immediately cease.</p>
        </section>

        <section>
          <h2>11. Limitation of Liability</h2>
          <p>In no event shall Olive Site Evaluator, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
        </section>

        <section>
          <h2>12. Changes to Terms</h2>
          <p>We reserve the right to modify or replace these Terms at any time. Material changes will be notified to users. Continued use of the service after changes constitutes acceptance of the new Terms.</p>
        </section>

        <section>
          <h2>13. Contact Information</h2>
          <p>For questions about these Terms, please contact us through our website. We will make every reasonable effort to address your concerns.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService; 