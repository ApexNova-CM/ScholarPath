import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { toSnake } from '../src/lib/mapper';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORIES = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'STEM & Tech',
    slug: 'stem-tech',
    description: 'Computer Science, AI, Engineering, Mathematics, and Physical Sciences scholarships.',
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Health & Medicine',
    slug: 'health-medicine',
    description: 'Medicine, Biomedical Sciences, Nursing, Public Health, and Global Healthcare awards.',
  },
  {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Business & Finance',
    slug: 'business-finance',
    description: 'Economics, MBA, International Trade, FinTech, and Entrepreneurship funding.',
  },
  {
    id: '44444444-4444-4444-a444-444444444444',
    name: 'Arts & Humanities',
    slug: 'arts-humanities',
    description: 'Literature, Philosophy, Visual Arts, History, and Cultural Studies programs.',
  },
  {
    id: '55555555-5555-4555-a555-555555555555',
    name: 'Undergraduate',
    slug: 'undergraduate',
    description: 'Bachelor degree scholarships, freshman entry grants, and undergraduate bursaries.',
  },
  {
    id: '66666666-6666-4666-a666-666666666666',
    name: 'Postgraduate & PhD',
    slug: 'postgraduate-phd',
    description: 'Masters degrees, doctoral fellowships, and post-doctoral research endowments.',
  },
  {
    id: '77777777-7777-4777-a777-777777777777',
    name: 'Law & Public Policy',
    slug: 'law-public-policy',
    description: 'International Relations, Human Rights, Governance, and Legal Studies funding.',
  },
];

const PROVIDERS = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    name: 'Bill & Melinda Gates Foundation',
    type: 'Global Philanthropic Foundation',
    website: 'https://www.gatesfoundation.org',
    description: 'Dedicated to fighting poverty, disease, and inequity around the world through educational access.',
    contactEmail: 'scholarships@gatesfoundation.org',
    country: 'United States',
    verified: true,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    name: 'The Rhodes Trust',
    type: 'Endowed Educational Trust',
    website: 'https://www.rhodeshouse.ox.ac.uk',
    description: 'The Rhodes Scholarship brings outstanding students from around the world to the University of Oxford.',
    contactEmail: 'scholarships@rhodeshouse.ox.ac.uk',
    country: 'United Kingdom',
    verified: true,
  },
  {
    id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    name: 'US-UK Fulbright Commission',
    type: 'Government Bilateral Exchange',
    website: 'https://fulbright.org.uk',
    description: 'Fosters international leadership through merit-based cultural and academic exchange scholarships.',
    contactEmail: 'advising@fulbright.org.uk',
    country: 'United States',
    verified: true,
  },
  {
    id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    name: 'DAAD (German Academic Exchange Service)',
    type: 'National Higher Education Agency',
    website: 'https://www.daad.de',
    description: 'German national agency for international academic cooperation and exchange programs worldwide.',
    contactEmail: 'postmaster@daad.de',
    country: 'Germany',
    verified: true,
  },
  {
    id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
    name: 'Mastercard Foundation Scholars Program',
    type: 'International Development Foundation',
    website: 'https://mastercardfdn.org',
    description: 'Provides education and leadership opportunities for academically talented young people globally.',
    contactEmail: 'scholars@mastercardfdn.org',
    country: 'Canada',
    verified: true,
  },
];

const SCHOLARSHIPS = [
  {
    id: '10000000-0000-4000-a000-000000000001',
    title: 'Gates Cambridge Postgraduate Fellowship',
    providerId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    providerName: 'Bill & Melinda Gates Foundation',
    category: 'STEM & Tech',
    tags: ['Cambridge', 'Postgraduate', 'Fully Funded', 'Research', 'STEM'],
    amount: 65000,
    currency: 'GBP',
    fundingType: 'Fully funded',
    eligibleCountries: ['All'],
    educationLevels: ['Postgraduate (Masters)', 'Doctorate (PhD)'],
    fieldsOfStudy: ['Computer Science', 'Biomedical Engineering', 'Data Science', 'Mathematics', 'Physics'],
    minimumGpa: 3.7,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 142,
    saveCount: 38,
    requiredDocuments: ['CV / Resume', 'Official Transcript', 'Recommendation Letter 1', 'Recommendation Letter 2', 'Statement of Purpose / Essay'],
    description: 'Gates Cambridge Scholarships are prestigious, highly competitive full-cost awards for graduate study in any subject available at the University of Cambridge. The programme covers the university composition fee, maintenance allowance, travel visa, and discretionary development funding.',
    shortDescription: 'Full-cost postgraduate scholarship to study at the University of Cambridge for outstanding applicants from outside the UK.',
    applicationInstructions: 'Apply directly via the University of Cambridge Graduate Application Portal. Submit research proposal and 2 academic references.',
    applicationUrl: 'https://www.gatescambridge.org/apply/',
  },
  {
    id: '10000000-0000-4000-a000-000000000002',
    title: 'Rhodes Global Scholarship at University of Oxford',
    providerId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    providerName: 'The Rhodes Trust',
    category: 'Postgraduate & PhD',
    tags: ['Oxford', 'Leadership', 'Fully Funded', 'International', 'Humanities'],
    amount: 72000,
    currency: 'GBP',
    fundingType: 'Fully funded',
    eligibleCountries: ['All'],
    educationLevels: ['Postgraduate (Masters)', 'Doctorate (PhD)'],
    fieldsOfStudy: ['All'],
    minimumGpa: 3.75,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 215,
    saveCount: 76,
    requiredDocuments: ['Official Transcript', 'CV / Resume', 'Statement of Purpose / Essay', 'Recommendation Letter 1', 'Recommendation Letter 2'],
    description: 'The Rhodes Scholarship is the oldest and perhaps most prestigious international scholarship programme, enabling outstanding young people from around the world to study full-time at the University of Oxford.',
    shortDescription: 'World-renowned fully funded scholarship supporting graduate study at Oxford University for ethical, transformative young leaders.',
    applicationInstructions: 'Submit formal application via Rhodes Trust constituency portal with personal statement and 4-6 reference letters.',
    applicationUrl: 'https://www.rhodeshouse.ox.ac.uk/scholarships/applications/',
  },
  {
    id: '10000000-0000-4000-a000-000000000003',
    title: 'Fulbright Foreign Student Exchange Program',
    providerId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    providerName: 'US-UK Fulbright Commission',
    category: 'Undergraduate',
    tags: ['USA', 'Exchange', 'Tuition', 'Stipend', 'Global'],
    amount: 50000,
    currency: 'USD',
    fundingType: 'Fully funded',
    eligibleCountries: ['All'],
    educationLevels: ['Undergraduate', 'Postgraduate (Masters)'],
    fieldsOfStudy: ['All'],
    minimumGpa: 3.2,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 189,
    saveCount: 52,
    requiredDocuments: ['Official Transcript', 'Standardized Test Score (SAT/GRE/TOEFL)', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    description: 'The Fulbright Foreign Student Program enables graduate students, young professionals, and artists from abroad to research and study in the United States. Fulbright awards operate in more than 160 countries worldwide.',
    shortDescription: 'Prestigious bilateral exchange funding tuition, living stipend, health insurance, and airfare for studies in the United States.',
    applicationInstructions: 'Apply through the binational Fulbright Commission or US Embassy public affairs section in your home country.',
    applicationUrl: 'https://foreign.fulbrightonline.org/',
  },
  {
    id: '10000000-0000-4000-a000-000000000004',
    title: 'DAAD Helmut Schmidt Master Scholarship in Public Policy',
    providerId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    providerName: 'DAAD (German Academic Exchange Service)',
    category: 'Law & Public Policy',
    tags: ['Germany', 'Public Policy', 'Good Governance', 'Europe', 'Stipend'],
    amount: 36000,
    currency: 'EUR',
    fundingType: 'Fully funded',
    eligibleCountries: ['All'],
    educationLevels: ['Postgraduate (Masters)'],
    fieldsOfStudy: ['Law & Public Policy', 'Economics', 'Political Science', 'International Relations'],
    minimumGpa: 3.0,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 94,
    saveCount: 29,
    requiredDocuments: ['CV / Resume', 'Official Transcript', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    description: 'This DAAD program supports future leaders from developing countries who wish to promote democracy and social justice. Master courses are offered in social sciences, public management, economics, and law at German institutions.',
    shortDescription: 'Full German scholarship for future leaders pursuing a Masters degree in Public Policy and Good Governance.',
    applicationInstructions: 'Submit application directly to participating German universities during the annual application window.',
    applicationUrl: 'https://www.daad.de/en/information-services-for-higher-education-institutions/further-information-on-daad-programmes/helmut-schmidt-programme/',
  },
  {
    id: '10000000-0000-4000-a000-000000000005',
    title: 'Mastercard Foundation STEM Leadership Award',
    providerId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
    providerName: 'Mastercard Foundation Scholars Program',
    category: 'STEM & Tech',
    tags: ['Africa', 'Leadership', 'Undergraduate', 'Tech', 'Full Tuition'],
    amount: 45000,
    currency: 'USD',
    fundingType: 'Fully funded',
    eligibleCountries: ['All'],
    educationLevels: ['Undergraduate', 'Postgraduate (Masters)'],
    fieldsOfStudy: ['Computer Science', 'Software Engineering', 'Information Technology', 'Civil Engineering', 'Electrical Engineering'],
    minimumGpa: 3.3,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 310,
    saveCount: 88,
    requiredDocuments: ['Official Transcript', 'Financial Need Statement', 'Statement of Purpose / Essay', 'Recommendation Letter 1'],
    description: 'Comprehensive scholarship covering tuition, accommodation, books, living stipend, and laptop for academically gifted students committed to giving back to their communities through science and technology.',
    shortDescription: 'Full undergraduate & graduate funding covering tuition, living expenses, and tech equipment for promising STEM leaders.',
    applicationInstructions: 'Apply through partner university admissions offices participating in the Mastercard Foundation Scholars Program.',
    applicationUrl: 'https://mastercardfdn.org/all/scholars/becoming-a-scholar/apply-to-the-scholars-program/',
  },
  {
    id: '10000000-0000-4000-a000-000000000006',
    title: 'International Biomedical Research Grant',
    providerId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    providerName: 'Bill & Melinda Gates Foundation',
    category: 'Health & Medicine',
    tags: ['Biomedical', 'Medicine', 'Research', 'Healthcare', 'Fellowship'],
    amount: 40000,
    currency: 'USD',
    fundingType: 'Grant',
    eligibleCountries: ['All'],
    educationLevels: ['Postgraduate (Masters)', 'Doctorate (PhD)', 'Postdoctoral'],
    fieldsOfStudy: ['Medicine', 'Health & Medicine', 'Biochemistry', 'Epidemiology'],
    minimumGpa: 3.5,
    gpaScale: 4.0,
    deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'verified',
    verificationStatus: 'verified',
    verifiedBy: 'System Administrator',
    verifiedAt: new Date().toISOString(),
    viewCount: 160,
    saveCount: 44,
    requiredDocuments: ['Official Transcript', 'CV / Resume', 'Portfolio / Project Sample', 'Statement of Purpose / Essay'],
    description: 'Direct grant funding for researchers advancing infectious disease treatment, diagnostic innovation, and community health interventions.',
    shortDescription: 'Research grant supporting graduate and post-doctoral research projects tackling infectious disease prevention.',
    applicationInstructions: 'Submit research outline and faculty sponsorship letter through the foundation portal.',
    applicationUrl: 'https://www.gatesfoundation.org/our-work/programs/global-health',
  }
];

const ADMIN_USERS = [
  {
    id: '99999999-9999-4999-a999-999999999999',
    first_name: 'Lead',
    last_name: 'Administrator',
    email: 'admin@scholarpath.org',
    role: 'Super Admin',
    status: 'Active',
    assigned_department: 'Governance & Operations',
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  },
  {
    id: '99999999-9999-4999-a999-999999999998',
    first_name: 'Chris',
    last_name: 'Ekpe',
    email: 'chrisekpe18@gmail.com',
    role: 'Admin',
    status: 'Active',
    assigned_department: 'Scholarship Operations',
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  },
];

async function seed() {
  console.log('🚀 Starting Scholar Path Supabase Seed...');

  // 1. Seed Categories
  console.log('📦 Seeding Categories...');
  for (const cat of CATEGORIES) {
    const row = toSnake(cat);
    const { error } = await supabase.from('categories').upsert(row, { onConflict: 'id' });
    if (error) console.error(`  ❌ Error inserting category ${cat.name}:`, error.message);
    else console.log(`  ✓ Category: ${cat.name}`);
  }

  // 2. Seed Providers
  console.log('\n🏛️ Seeding Providers...');
  for (const prov of PROVIDERS) {
    const row = toSnake({
      ...prov,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { error } = await supabase.from('providers').upsert(row, { onConflict: 'id' });
    if (error) console.error(`  ❌ Error inserting provider ${prov.name}:`, error.message);
    else console.log(`  ✓ Provider: ${prov.name}`);
  }

  // 3. Seed Scholarships
  console.log('\n🎓 Seeding Scholarships...');
  for (const sch of SCHOLARSHIPS) {
    const row = toSnake({
      ...sch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { error } = await supabase.from('scholarships').upsert(row, { onConflict: 'id' });
    if (error) console.error(`  ❌ Error inserting scholarship ${sch.title}:`, error.message);
    else console.log(`  ✓ Scholarship: ${sch.title}`);
  }

  // 4. Seed Admin Users
  console.log('\n🛡️ Seeding Admin Directory...');
  for (const adm of ADMIN_USERS) {
    const { error } = await supabase.from('admin_users').upsert(adm, { onConflict: 'id' });
    if (error) console.error(`  ❌ Error inserting admin ${adm.email}:`, error.message);
    else console.log(`  ✓ Admin: ${adm.email}`);
  }

  console.log('\n🎉 Seed completed successfully!');
}

seed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
