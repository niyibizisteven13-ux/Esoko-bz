import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';

export default function AcceptableUsePolicy() {
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
              <h1 className="text-3xl font-bold text-neutral-900">Acceptable Use Policy</h1>
              <p className="text-neutral-600">Last updated: May 1, 2026</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">1. Purpose</h2>
            <p className="text-neutral-700 leading-relaxed">
              This Acceptable Use Policy outlines the rules for using Makasi services. By
              using our platform, you agree to comply with these guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">2. Permitted Use</h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Personal and business financial transactions</li>
              <li>Inventory management and sales tracking</li>
              <li>Marketplace browsing and purchasing</li>
              <li>Loyalty program participation</li>
              <li>Communication with other users through approved channels</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">3. Prohibited Activities</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                  Financial Violations
                </h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Money laundering or terrorist financing</li>
                  <li>Fraudulent transactions or scams</li>
                  <li>Using stolen payment methods</li>
                  <li>Manipulating transaction fees or rewards</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">Security Violations</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Hacking or unauthorized access attempts</li>
                  <li>Distributing malware or viruses</li>
                  <li>Exploiting system vulnerabilities</li>
                  <li>Sharing account credentials</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">Content Violations</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Posting illegal, harmful, or offensive content</li>
                  <li>Violating intellectual property rights</li>
                  <li>Harassment or discrimination</li>
                  <li>Spam or unsolicited communications</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">System Abuse</h3>
                <ul className="list-disc list-inside text-neutral-700 space-y-1">
                  <li>Automated bots or scripts without permission</li>
                  <li>Excessive API calls or system overload</li>
                  <li>Reverse engineering or unauthorized modifications</li>
                  <li>Circumventing security measures</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              4. Account Responsibilities
            </h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Maintain accurate account information</li>
              <li>Protect your login credentials</li>
              <li>Report suspicious activities immediately</li>
              <li>Not share accounts with others</li>
              <li>Use strong, unique passwords</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              5. Monitoring and Enforcement
            </h2>
            <p className="text-neutral-700 leading-relaxed">
              We monitor platform usage to ensure compliance with this policy. We may investigate
              violations and take appropriate action, including account suspension or termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              6. Consequences of Violation
            </h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Warning or temporary suspension</li>
              <li>Permanent account termination</li>
              <li>Legal action where appropriate</li>
              <li>Reporting to authorities for serious violations</li>
              <li>Forfeiture of funds or rewards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">7. Reporting Violations</h2>
            <p className="text-neutral-700 leading-relaxed">
              If you encounter prohibited activities or suspect a violation, please report it to us
              at abuse@esoko.rw. We take all reports seriously and investigate promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">8. Policy Updates</h2>
            <p className="text-neutral-700 leading-relaxed">
              This policy may be updated to address new threats or regulatory requirements. Users
              will be notified of significant changes.
            </p>
          </section>

          <div className="pt-8 border-t border-neutral-200">
            <p className="text-neutral-600 text-sm">
              Violations may result in immediate account suspension. Contact support for questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
