import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../components/Logo';

export default function TermsOfService() {
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
              <h1 className="text-3xl font-bold text-neutral-900">Terms of Service</h1>
              <p className="text-neutral-600">Last updated: May 1, 2026</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-neutral-700 leading-relaxed">
              By accessing and using Bwenge, you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the above, please do not
              use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">2. Services</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              Bwenge provides digital payment solutions, inventory management, and marketplace
              services for traders and customers in Rwanda.
            </p>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Digital wallet and payment processing</li>
              <li>Inventory management for traders</li>
              <li>Marketplace for goods and services</li>
              <li>Loyalty and rewards programs</li>
              <li>Analytics and reporting tools</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">3. User Obligations</h2>
            <ul className="list-disc list-inside text-neutral-700 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account</li>
              <li>Use the service only for lawful purposes</li>
              <li>Not engage in fraudulent activities</li>
              <li>Respect intellectual property rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">4. Fees and Payments</h2>
            <p className="text-neutral-700 leading-relaxed">
              Transaction fees apply as outlined in our pricing. All payments are processed securely
              through authorized payment providers. Refunds are subject to our refund policy and
              applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">5. Intellectual Property</h2>
            <p className="text-neutral-700 leading-relaxed">
              All content, trademarks, and data on Bwenge are owned by us or our licensors.
              You may not reproduce, distribute, or create derivative works without permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">6. Termination</h2>
            <p className="text-neutral-700 leading-relaxed">
              We may terminate or suspend your account for violations of these terms. You may
              terminate your account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">7. Limitation of Liability</h2>
            <p className="text-neutral-700 leading-relaxed">
              Bwenge shall not be liable for any indirect, incidental, or consequential
              damages. Our total liability shall not exceed the amount paid by you in the 12 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">8. Governing Law</h2>
            <p className="text-neutral-700 leading-relaxed">
              These terms are governed by the laws of Rwanda. Any disputes shall be resolved in
              Rwandan courts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">9. Updates to Terms</h2>
            <p className="text-neutral-700 leading-relaxed">
              We may update these terms at any time. Continued use constitutes acceptance of updated
              terms. We will notify users of significant changes.
            </p>
          </section>

          <div className="pt-8 border-t border-neutral-200">
            <p className="text-neutral-600 text-sm">
              For questions about these terms, contact us at legal@esoko.rw
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
