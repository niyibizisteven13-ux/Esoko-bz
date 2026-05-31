import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <Logo />
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Privacy Policy</h1>
              <p className="text-neutral-600">Last updated: May 1, 2026</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">1. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  Personal Information
                </h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Name, email address, phone number</li>
                  <li>Business information (for traders)</li>
                  <li>Profile pictures and documents</li>
                  <li>Payment and transaction data</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">Usage Data</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Device information and IP address</li>
                  <li>Browser type and version</li>
                  <li>Pages visited and time spent</li>
                  <li>Transaction history and patterns</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>To provide and maintain our services</li>
              <li>To process payments and transactions</li>
              <li>To communicate with you about your account</li>
              <li>To improve our services and develop new features</li>
              <li>To ensure security and prevent fraud</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">3. Information Sharing</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              We do not sell your personal information to third parties. We may share information in
              the following cases:
            </p>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>With payment processors for transaction processing</li>
              <li>With service providers who assist our operations</li>
              <li>When required by law or to protect rights</li>
              <li>With your consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">4. Data Security</h2>
            <p className="text-neutral-700 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your
              personal information against unauthorized access, alteration, disclosure, or
              destruction. This includes encryption, secure servers, and regular security
              assessments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">5. Your Rights</h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and data</li>
              <li>Object to processing in certain circumstances</li>
              <li>Data portability</li>
              <li>Withdraw consent where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">6. Cookies and Tracking</h2>
            <p className="text-neutral-700 leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze usage, and
              maintain security. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">7. Data Retention</h2>
            <p className="text-neutral-700 leading-relaxed">
              We retain your information for as long as necessary to provide our services and comply
              with legal obligations. Financial records are retained for 7 years as required by
              Rwandan law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">8. International Transfers</h2>
            <p className="text-neutral-700 leading-relaxed">
              Your information may be transferred to and processed in countries other than Rwanda.
              We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">9. Changes to This Policy</h2>
            <p className="text-neutral-700 leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any
              material changes and obtain consent where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">10. Contact Us</h2>
            <p className="text-neutral-700 leading-relaxed">
              If you have questions about this privacy policy, please contact us at privacy@esoko.rw
            </p>
          </section>

          <div className="pt-8 border-t border-neutral-200">
            <p className="text-neutral-600 text-sm">
              This policy complies with Rwandan data protection laws and international standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
