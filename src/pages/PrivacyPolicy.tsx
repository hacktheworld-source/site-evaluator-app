import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="legal-page privacy-policy">
      <div className="legal-content">
        <h1>Privacy Policy</h1>
        
        <section>
          <h2>1. Introduction</h2>
          <p>At Olive Site Evaluator ("we," "our," or "us"), we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website evaluation service. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the service.</p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>We collect several types of information for various purposes:</p>
          <h3>2.1 Personal Information</h3>
          <ul>
            <li>Email address (for authentication)</li>
            <li>Name (if provided through authentication)</li>
            <li>Profile picture (if provided through authentication)</li>
            <li>Payment information (processed securely through Stripe)</li>
          </ul>
          
          <h3>2.2 Usage Data</h3>
          <ul>
            <li>Websites submitted for analysis</li>
            <li>Analysis results and reports</li>
            <li>Chat interactions with our AI system</li>
            <li>Service usage statistics</li>
            <li>Technical metrics and performance data</li>
          </ul>

          <h3>2.3 Technical Data</h3>
          <ul>
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Time zone and location</li>
            <li>Browser plug-in types and versions</li>
            <li>Device information</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <p>We use the collected information for various purposes:</p>
          <ul>
            <li>To provide and maintain our service</li>
            <li>To notify you about changes to our service</li>
            <li>To provide customer support</li>
            <li>To process payments and prevent fraud</li>
            <li>To generate website analysis reports</li>
            <li>To improve our service through usage analysis</li>
            <li>To communicate with you about service-related matters</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Storage and Security</h2>
          <p>We implement appropriate technical and organizational security measures to protect your data:</p>
          <ul>
            <li>All data is stored securely in Google Cloud Platform through Firebase</li>
            <li>Payment information is processed and stored securely by Stripe</li>
            <li>Website analysis data is stored in secure cloud databases</li>
            <li>All data transmissions are encrypted using SSL/TLS protocols</li>
            <li>Access to personal data is strictly controlled and logged</li>
          </ul>
        </section>

        <section>
          <h2>5. Third-Party Services</h2>
          <p>We use the following third-party services to operate our service:</p>
          <ul>
            <li>Firebase (Google) - Authentication and data storage</li>
            <li>Stripe - Payment processing</li>
            <li>OpenAI - AI-powered analysis</li>
            <li>Google Lighthouse - Performance metrics</li>
          </ul>
          <p>Each third-party service has its own Privacy Policy governing their use of your information. We encourage you to review their privacy policies.</p>
        </section>

        <section>
          <h2>6. Data Retention</h2>
          <p>We retain your information as long as:</p>
          <ul>
            <li>Your account remains active</li>
            <li>The information is needed to provide our services</li>
            <li>We are required to by law</li>
            <li>It is needed for legitimate business purposes</li>
          </ul>
          <p>You can request deletion of your account and associated data at any time through your profile settings.</p>
        </section>

        <section>
          <h2>7. Your Data Rights</h2>
          <p>You have the following rights regarding your data:</p>
          <ul>
            <li>Right to access your personal data</li>
            <li>Right to correct inaccurate data</li>
            <li>Right to request data deletion</li>
            <li>Right to restrict or object to processing</li>
            <li>Right to data portability</li>
            <li>Right to withdraw consent</li>
          </ul>
        </section>

        <section>
          <h2>8. Cookies and Tracking</h2>
          <p>We use essential cookies and similar tracking technologies to:</p>
          <ul>
            <li>Maintain your authentication status</li>
            <li>Remember your preferences</li>
            <li>Analyze service usage patterns</li>
            <li>Improve service performance</li>
          </ul>
          <p>You can control cookie preferences through your browser settings.</p>
        </section>

        <section>
          <h2>9. Children's Privacy</h2>
          <p>Our service is not intended for use by children under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us.</p>
        </section>

        <section>
          <h2>10. International Data Transfers</h2>
          <p>Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. When we transfer your data, we ensure appropriate safeguards are in place.</p>
        </section>

        <section>
          <h2>11. Changes to Privacy Policy</h2>
          <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Continued use of the service after changes constitutes acceptance of the new Privacy Policy.</p>
        </section>

        <section>
          <h2>12. Contact Information</h2>
          <p>If you have questions about this Privacy Policy or our data practices, please contact us through our website. We will make every reasonable effort to address your concerns promptly.</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 