-- Migration: 20260220200000_epic011_contracts.sql
-- EPIC-011: Business Manager — Contract templates and contracts
-- ON DELETE RESTRICT for contracts (financial records must never cascade-delete)

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('sponsorship', 'licensing', 'freelance', 'collaboration', 'general')),
  template_text TEXT NOT NULL,
  red_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  template_id UUID REFERENCES contract_templates(id),
  counterparty TEXT NOT NULL,
  filled_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'terminated')),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_creator_id ON contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(creator_id, status);

-- RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates"
  ON contract_templates FOR SELECT USING (true);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own contracts"
  ON contracts FOR ALL USING (creator_id = (select auth.uid()));

-- Seed initial contract templates
INSERT INTO contract_templates (name, category, template_text, red_flags) VALUES
(
  'Brand Sponsorship Agreement',
  'sponsorship',
  E'BRAND SPONSORSHIP AGREEMENT\n\nThis Agreement is entered into between {{CREATOR_NAME}} ("Creator") and {{BRAND_NAME}} ("Brand").\n\n1. SCOPE OF WORK\nCreator agrees to produce {{DELIVERABLES}} for Brand.\n\n2. COMPENSATION\nBrand shall pay Creator {{AMOUNT}} within {{PAYMENT_TERMS}} days of delivery.\n\n3. INTELLECTUAL PROPERTY\nCreator retains all intellectual property rights. Brand receives a limited, non-exclusive license to use the Content for {{LICENSE_DURATION}}.\n\n4. EXCLUSIVITY\nThis agreement is non-exclusive unless otherwise specified.\n\n5. TERM\nThis Agreement begins on {{START_DATE}} and ends on {{END_DATE}}.',
  '[]'
),
(
  'Content Licensing Agreement',
  'licensing',
  E'CONTENT LICENSING AGREEMENT\n\nThis Agreement grants {{LICENSEE_NAME}} ("Licensee") a limited license to use content created by {{CREATOR_NAME}} ("Creator").\n\n1. LICENSED CONTENT\n{{CONTENT_DESCRIPTION}}\n\n2. LICENSE GRANT\nCreator grants Licensee a non-exclusive, limited license for {{LICENSE_DURATION}} in {{TERRITORY}}.\n\n3. COMPENSATION\nLicensee shall pay Creator {{AMOUNT}} within 30 days of execution.\n\n4. RESTRICTIONS\nLicensee may not sublicense, assign, or transfer this license without Creator''s written consent.',
  '[]'
),
(
  'Freelance Services Agreement',
  'freelance',
  E'FREELANCE SERVICES AGREEMENT\n\nThis Agreement is between {{CLIENT_NAME}} ("Client") and {{CREATOR_NAME}} ("Creator").\n\n1. SERVICES\nCreator will provide: {{SERVICES_DESCRIPTION}}\n\n2. TIMELINE\nServices will be completed by {{DEADLINE}}.\n\n3. PAYMENT\nClient shall pay {{AMOUNT}} within 30 days of invoice.\n\n4. INTELLECTUAL PROPERTY\nUpon receipt of full payment, Creator grants Client a limited license to use the deliverables. Creator retains all underlying IP rights.',
  '[]'
),
(
  'Collaboration Agreement',
  'collaboration',
  E'COLLABORATION AGREEMENT\n\nThis Agreement is between {{CREATOR_1_NAME}} and {{CREATOR_2_NAME}} for collaborative content creation.\n\n1. PROJECT\n{{PROJECT_DESCRIPTION}}\n\n2. REVENUE SPLIT\nNet revenue shall be split: {{CREATOR_1_PCT}}% to {{CREATOR_1_NAME}}, {{CREATOR_2_PCT}}% to {{CREATOR_2_NAME}}.\n\n3. INTELLECTUAL PROPERTY\nEach creator retains rights to their contributions. Joint content is co-owned.\n\n4. TERM\nThis collaboration covers content published between {{START_DATE}} and {{END_DATE}}.',
  '[]'
);
