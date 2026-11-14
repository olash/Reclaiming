import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="Effective date: May 19, 2026">
      <h2>1. Introduction &amp; Regulatory Framework</h2>
      <p>
        Reclaimng (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a specialized digital estate transition protocol designed to assist verified beneficiaries in
        recovering unclaimed dividends and banking assets of deceased individuals within the Federal Republic of Nigeria. This Privacy Policy outlines our strict
        operational standards regarding the processing, collection, storage, and cross-border transmission of Personal Data and Sensitive Personal Data.
      </p>
      <p>
        This document is compiled in strict alignment with the Constitution of the Federal Republic of Nigeria 1999, the Nigeria Data Protection Act 2023 (NDPA),
        and the Nigeria Data Protection Regulation (NDPR).
      </p>

      <h2>2. Data Categories We Process</h2>
      <p>To execute the automated asset discovery and migration routines, we process the following distinct data profiles:</p>
      <ul>
        <li><strong>User/Beneficiary Identity Data:</strong> Full legal name, verified email address, telephone contact data, and government identification records.</li>
        <li><strong>Deceased Person Data:</strong> Full legal name, date of death records, and the 11-digit Bank Verification Number (BVN).</li>
        <li><strong>Physical Verification Ingestion Records:</strong> Uploaded digital assets comprising High Court Probate Registries documents, Letters of Administration, and official Death Certificates.</li>
      </ul>

      <h2>3. Integrated Third-Party Processing &amp; The QoreID Validation Node</h2>
      <p>
        To maintain absolute compliance and prevent fraudulent estate claims, Reclaimng partners with QoreID Limited (an identity and data compliance verification
        network infrastructure).
      </p>
      <ul>
        <li><strong>Scope of Transfer:</strong> Your uploaded Probate documents, Letters of Administration, and BVN parameters are securely transmitted via encrypted API communication protocols to the QoreID validation engine.</li>
        <li><strong>Verification Authority:</strong> QoreID verifies these data points against official public records, the National Identity Management Commission (NIMC) database, and relevant state judicial archives.</li>
        <li><strong>Data Integrity:</strong> All such transfers are guarded by end-to-end Transport Layer Security (TLS 1.3) encryption layers.</li>
      </ul>

      <h2>4. Data Security &amp; Storage Limitations</h2>
      <p>
        All personal information sets gathered through the platform engine are retained exclusively for the duration necessary to satisfy regulatory auditing
        obligations under the Central Bank of Nigeria (CBN) and Securities and Exchange Commission (SEC) guidelines. Data is stored within secure,
        access-controlled cloud repositories utilizing AES-256 military-grade encryption models at rest.
      </p>

      <h2>5. Your Legal Data Rights</h2>
      <p>
        Pursuant to the provisions of the NDPA 2023, you retain absolute rights to request access to, rectification of, or complete erasure of your personal
        records from our active indices, subject to overriding statutory asset monitoring and anti-money laundering reporting requirements. For inquiries
        regarding data rights, contact our privacy desk via the integrated floating support interface.
      </p>
    </LegalPage>
  );
}
