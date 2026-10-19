import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { applyMigrations } from '../src/main/db/migrations'
import { initializeAiViewsAndReadme, syncAiMonthlyRollupForScenario } from '../src/main/db/aiViews'
import type { ScenarioDataset } from '../src/shared/types'

export function buildDemoDataset(): { baseline: ScenarioDataset; whatIf: ScenarioDataset } {
  const baselineId = 'scen-apex-baseline'
  const whatIfId = 'scen-apex-whatif-balanced'
  const now = new Date().toISOString()

  const people: ScenarioDataset['people'] = [
    {
      id: 'person-elena',
      scenarioId: baselineId,
      name: 'Elena Vance',
      isPlaceholder: false,
      role: 'Staff Engineer',
      department: 'Platform Architecture',
      skills: ['Architecture', 'Distributed Systems', 'Go', 'Cloud', 'PostgreSQL'],
      hoursPerDay: 8,
      hourlyRate: 140,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Principal Architect & Technical Director' }
    },
    {
      id: 'person-marcus',
      scenarioId: baselineId,
      name: 'Marcus Chen',
      isPlaceholder: false,
      role: 'Senior Backend Engineer',
      department: 'Core Banking',
      skills: ['Go', 'Kubernetes', 'gRPC', 'PostgreSQL', 'High Throughput'],
      hoursPerDay: 8,
      hourlyRate: 125,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Lead Core Transaction Engineer' }
    },
    {
      id: 'person-aisha',
      scenarioId: baselineId,
      name: 'Aisha Patel',
      isPlaceholder: false,
      role: 'Senior Frontend Engineer',
      department: 'Web & Apps',
      skills: ['React', 'TypeScript', 'Tailwind', 'Performance', 'State Management'],
      hoursPerDay: 8,
      hourlyRate: 115,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Design System & UI Lead' }
    },
    {
      id: 'person-vikram',
      scenarioId: baselineId,
      name: 'Dr. Vikram Seth',
      isPlaceholder: false,
      role: 'Principal ML Engineer',
      department: 'AI & Analytics',
      skills: ['Python', 'PyTorch', 'Vector Search', 'AI/ML', 'Data Pipelines', 'CUDA'],
      hoursPerDay: 8,
      hourlyRate: 145,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Head of Applied AI Research' }
    },
    {
      id: 'person-sofia',
      scenarioId: baselineId,
      name: 'Sofia Ramirez',
      isPlaceholder: false,
      role: 'Lead Product Designer',
      department: 'Product Design',
      skills: ['Design Systems', 'UX Research', 'Interactive Prototyping', 'Figma'],
      hoursPerDay: 8,
      hourlyRate: 110,
      costType: 'opex',
      startDate: null,
      endDate: null,
      meta: { title: 'Executive Experience Design Lead' }
    },
    {
      id: 'person-jordan',
      scenarioId: baselineId,
      name: 'Jordan Reed',
      isPlaceholder: false,
      role: 'Senior DevOps Engineer',
      department: 'Infrastructure & Security',
      skills: ['Terraform', 'AWS', 'Zero Trust', 'SOC2', 'Kubernetes', 'CI/CD'],
      hoursPerDay: 8,
      hourlyRate: 130,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Lead Cloud Infrastructure Architect' }
    },
    {
      id: 'person-david',
      scenarioId: baselineId,
      name: 'David Kim',
      isPlaceholder: false,
      role: 'Fullstack Engineer',
      department: 'Core Banking',
      skills: ['TypeScript', 'Node.js', 'React', 'REST APIs', 'PostgreSQL'],
      hoursPerDay: 8,
      hourlyRate: 105,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Fullstack Platform Engineer' }
    },
    {
      id: 'person-rachel',
      scenarioId: baselineId,
      name: 'Rachel Green',
      isPlaceholder: false,
      role: 'Lead Product Manager',
      department: 'Product Management',
      skills: ['Product Strategy', 'Fintech Regulations', 'Roadmapping', 'Metrics'],
      hoursPerDay: 8,
      hourlyRate: 120,
      costType: 'opex',
      startDate: null,
      endDate: null,
      meta: { title: 'Director of Product Strategy' }
    },
    {
      id: 'person-lucas',
      scenarioId: baselineId,
      name: 'Lucas Silva',
      isPlaceholder: false,
      role: 'Mobile Engineer',
      department: 'Web & Apps',
      skills: ['React Native', 'iOS', 'Android', 'TypeScript', 'Offline Sync'],
      hoursPerDay: 8,
      hourlyRate: 110,
      costType: 'capex',
      startDate: null,
      endDate: null,
      meta: { title: 'Senior Mobile Specialist' }
    },
    {
      id: 'person-samira',
      scenarioId: baselineId,
      name: 'Samira Khan',
      isPlaceholder: false,
      role: 'Technical Program Manager',
      department: 'PMO & Operations',
      skills: ['Agile Portfolio', 'Resource Planning', 'Risk Management', 'Governance'],
      hoursPerDay: 8,
      hourlyRate: 105,
      costType: 'opex',
      startDate: null,
      endDate: null,
      meta: { title: 'Principal Program Delivery Lead' }
    },
    {
      id: 'person-tbd-cloud',
      scenarioId: baselineId,
      name: 'TBD Senior Cloud Platform Engineer (Q3 Hire)',
      isPlaceholder: true,
      role: 'Senior Cloud Engineer',
      department: 'Platform Architecture',
      skills: ['Go', 'Cloud', 'Kubernetes', 'Terraform'],
      hoursPerDay: 8,
      hourlyRate: 125,
      costType: 'capex',
      startDate: '2026-08-17',
      endDate: null,
      meta: { requisitionId: 'REQ-ENG-4402' }
    },
    {
      id: 'person-tbd-sec',
      scenarioId: baselineId,
      name: 'TBD Compliance & InfoSec Analyst (Q4 Hire)',
      isPlaceholder: true,
      role: 'Security Specialist',
      department: 'Infrastructure & Security',
      skills: ['SOC2', 'FedRAMP', 'Auditing', 'Risk Assessment'],
      hoursPerDay: 8,
      hourlyRate: 115,
      costType: 'opex',
      startDate: '2026-10-05',
      endDate: null,
      meta: { requisitionId: 'REQ-SEC-4419' }
    }
  ]

  const projects: ScenarioDataset['projects'] = [
    {
      id: 'proj-ai-fraud',
      scenarioId: baselineId,
      name: 'Real-Time AI Fraud Prevention Engine',
      startDate: '2026-04-06',
      endDate: '2026-08-14',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 1,
      valueScore: 96,
      costMode: 'calculated',
      fixedCost: 38000, // Non-labor GPU compute & model fine-tuning cost
      capexPercent: 85,
      blendedHourlyRate: 135,
      color: '#0d9488',
      meta: { strategicTheme: 'AI & Automation', sponsor: 'Chief Risk Officer' }
    },
    {
      id: 'proj-payment-gw',
      scenarioId: baselineId,
      name: 'Next-Gen Core Payment Gateway (ISO 20022)',
      startDate: '2026-04-20',
      endDate: '2026-07-31',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 2,
      valueScore: 94,
      costMode: 'fixed',
      fixedCost: 168000,
      capexPercent: 80,
      blendedHourlyRate: 125,
      color: '#4f46e5',
      meta: { strategicTheme: 'Core Banking', sponsor: 'VP of Payments' }
    },
    {
      id: 'proj-zero-trust',
      scenarioId: baselineId,
      name: 'Zero-Trust Multi-Region Cloud Infrastructure',
      startDate: '2026-05-18',
      endDate: '2026-08-28',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 3,
      valueScore: 90,
      costMode: 'fixed',
      fixedCost: 145000,
      capexPercent: 75,
      blendedHourlyRate: 130,
      color: '#d97706',
      meta: { strategicTheme: 'Reliability & Cloud', sponsor: 'VP Infrastructure' }
    },
    {
      id: 'proj-mobile-suite',
      scenarioId: baselineId,
      name: 'Executive Mobile Banking & Portfolio Suite',
      startDate: '2026-06-08',
      endDate: '2026-09-25',
      status: 'timeline',
      certainty: 'tentative',
      priorityRank: 4,
      valueScore: 79,
      costMode: 'fixed',
      fixedCost: 98000,
      capexPercent: 70,
      blendedHourlyRate: 115,
      color: '#7c3aed',
      meta: { strategicTheme: 'Digital Channels', sponsor: 'Chief Product Officer' }
    },
    {
      id: 'proj-soc2-vault',
      scenarioId: baselineId,
      name: 'SOC2 Type II & FedRAMP Security Vault',
      startDate: '2026-08-03',
      endDate: '2026-11-13',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 5,
      valueScore: 86,
      costMode: 'fixed',
      fixedCost: 82000,
      capexPercent: 40,
      blendedHourlyRate: 120,
      color: '#2563eb',
      meta: { strategicTheme: 'Security & Compliance', sponsor: 'CISO' }
    },
    {
      id: 'proj-dev-portal',
      scenarioId: baselineId,
      name: 'Unified Developer Portal & Open Banking API',
      startDate: '2026-09-07',
      endDate: '2026-12-11',
      status: 'timeline',
      certainty: 'confirmed',
      priorityRank: 6,
      valueScore: 83,
      costMode: 'calculated',
      fixedCost: 16000,
      capexPercent: 65,
      blendedHourlyRate: 115,
      color: '#059669',
      meta: { strategicTheme: 'Developer Ecosystem', sponsor: 'VP Engineering' }
    },
    {
      id: 'proj-onboarding-flow',
      scenarioId: baselineId,
      name: 'Automated Enterprise Customer Onboarding',
      startDate: '2026-10-12',
      endDate: '2026-12-31',
      status: 'timeline',
      certainty: 'tentative',
      priorityRank: 7,
      valueScore: 74,
      costMode: 'fixed',
      fixedCost: 62000,
      capexPercent: 50,
      blendedHourlyRate: 110,
      color: '#db2777',
      meta: { strategicTheme: 'Growth & Onboarding', sponsor: 'Head of Sales' }
    },
    // Backlog Candidates in "Projects on Deck"
    {
      id: 'proj-graphql-mesh',
      scenarioId: baselineId,
      name: 'GraphQL Federation & Edge Mesh',
      startDate: '2026-11-02',
      endDate: '2027-02-12',
      status: 'on_deck',
      certainty: 'confirmed',
      priorityRank: 8,
      valueScore: 81,
      costMode: 'fixed',
      fixedCost: 75000,
      capexPercent: 80,
      blendedHourlyRate: 125,
      color: '#6366f1',
      meta: { strategicTheme: 'Architecture' }
    },
    {
      id: 'proj-ledger-v2',
      scenarioId: baselineId,
      name: 'Real-Time Settlement & Ledger v2',
      startDate: '2026-11-16',
      endDate: '2027-02-26',
      status: 'on_deck',
      certainty: 'tentative',
      priorityRank: 9,
      valueScore: 88,
      costMode: 'fixed',
      fixedCost: 110000,
      capexPercent: 85,
      blendedHourlyRate: 130,
      color: '#0891b2',
      meta: { strategicTheme: 'Core Banking' }
    },
    {
      id: 'proj-ai-reconciliation',
      scenarioId: baselineId,
      name: 'AI Automated Reconciliation Agent',
      startDate: '2027-01-04',
      endDate: '2027-03-26',
      status: 'on_deck',
      certainty: 'tentative',
      priorityRank: 10,
      valueScore: 85,
      costMode: 'calculated',
      fixedCost: 24000,
      capexPercent: 75,
      blendedHourlyRate: 135,
      color: '#e11d48',
      meta: { strategicTheme: 'AI & Automation' }
    }
  ]

  const assignments: ScenarioDataset['assignments'] = [
    // Real-Time AI Fraud Prevention Engine
    {
      id: 'asn-fraud-vikram',
      scenarioId: baselineId,
      projectId: 'proj-ai-fraud',
      personId: 'person-vikram',
      requiredRole: 'Principal ML Engineer',
      requiredSkills: ['Python', 'AI/ML', 'CUDA'],
      allocationMode: 'hours_per_day',
      allocationValue: 6,
      meta: {}
    },
    {
      id: 'asn-fraud-elena',
      scenarioId: baselineId,
      projectId: 'proj-ai-fraud',
      personId: 'person-elena',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Architecture', 'Distributed Systems'],
      allocationMode: 'total_hours',
      allocationValue: 240,
      meta: {}
    },
    {
      id: 'asn-fraud-marcus',
      scenarioId: baselineId,
      projectId: 'proj-ai-fraud',
      personId: 'person-marcus',
      requiredRole: 'Senior Backend Engineer',
      requiredSkills: ['Go', 'gRPC'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    },
    {
      id: 'asn-fraud-rachel',
      scenarioId: baselineId,
      projectId: 'proj-ai-fraud',
      personId: 'person-rachel',
      requiredRole: 'Lead Product Manager',
      requiredSkills: ['Product Strategy', 'Fintech Regulations'],
      allocationMode: 'percent',
      allocationValue: 40,
      meta: {}
    },

    // Next-Gen Core Payment Gateway (ISO 20022)
    {
      id: 'asn-pay-marcus',
      scenarioId: baselineId,
      projectId: 'proj-payment-gw',
      personId: 'person-marcus',
      requiredRole: 'Senior Backend Engineer',
      requiredSkills: ['Go', 'PostgreSQL', 'High Throughput'],
      allocationMode: 'total_hours',
      allocationValue: 340,
      meta: {}
    },
    {
      id: 'asn-pay-david',
      scenarioId: baselineId,
      projectId: 'proj-payment-gw',
      personId: 'person-david',
      requiredRole: 'Fullstack Engineer',
      requiredSkills: ['Node.js', 'REST APIs', 'PostgreSQL'],
      allocationMode: 'total_hours',
      allocationValue: 300,
      meta: {}
    },
    {
      id: 'asn-pay-elena',
      scenarioId: baselineId,
      projectId: 'proj-payment-gw',
      personId: 'person-elena',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Architecture', 'Go'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    },
    {
      id: 'asn-pay-samira',
      scenarioId: baselineId,
      projectId: 'proj-payment-gw',
      personId: 'person-samira',
      requiredRole: 'Technical Program Manager',
      requiredSkills: ['Agile Portfolio', 'Risk Management'],
      allocationMode: 'percent',
      allocationValue: 40,
      meta: {}
    },

    // Zero-Trust Multi-Region Cloud Infrastructure
    {
      id: 'asn-zt-jordan',
      scenarioId: baselineId,
      projectId: 'proj-zero-trust',
      personId: 'person-jordan',
      requiredRole: 'Senior DevOps Engineer',
      requiredSkills: ['Terraform', 'AWS', 'Zero Trust', 'Kubernetes'],
      allocationMode: 'hours_per_day',
      allocationValue: 6,
      meta: {}
    },
    {
      id: 'asn-zt-elena',
      scenarioId: baselineId,
      projectId: 'proj-zero-trust',
      personId: 'person-elena',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Architecture', 'Cloud'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    },
    {
      id: 'asn-zt-tbdcloud',
      scenarioId: baselineId,
      projectId: 'proj-zero-trust',
      personId: 'person-tbd-cloud',
      requiredRole: 'Senior Cloud Engineer',
      requiredSkills: ['Cloud', 'Kubernetes'],
      allocationMode: 'total_hours',
      allocationValue: 120,
      meta: {}
    },

    // Executive Mobile Banking & Portfolio Suite (Overlap bottleneck in Baseline!)
    {
      id: 'asn-mob-lucas',
      scenarioId: baselineId,
      projectId: 'proj-mobile-suite',
      personId: 'person-lucas',
      requiredRole: 'Mobile Engineer',
      requiredSkills: ['React Native', 'TypeScript', 'Offline Sync'],
      allocationMode: 'total_hours',
      allocationValue: 380,
      meta: {}
    },
    {
      id: 'asn-mob-aisha',
      scenarioId: baselineId,
      projectId: 'proj-mobile-suite',
      personId: 'person-aisha',
      requiredRole: 'Senior Frontend Engineer',
      requiredSkills: ['React', 'TypeScript', 'Performance'],
      allocationMode: 'total_hours',
      allocationValue: 320,
      meta: {}
    },
    {
      id: 'asn-mob-sofia',
      scenarioId: baselineId,
      projectId: 'proj-mobile-suite',
      personId: 'person-sofia',
      requiredRole: 'Lead Product Designer',
      requiredSkills: ['Design Systems', 'Interactive Prototyping'],
      allocationMode: 'total_hours',
      allocationValue: 260,
      meta: {}
    },
    {
      id: 'asn-mob-rachel',
      scenarioId: baselineId,
      projectId: 'proj-mobile-suite',
      personId: 'person-rachel',
      requiredRole: 'Lead Product Manager',
      requiredSkills: ['Product Strategy', 'Roadmapping'],
      allocationMode: 'percent',
      allocationValue: 40,
      meta: {}
    },

    // SOC2 Type II & FedRAMP Security Vault
    {
      id: 'asn-soc-jordan',
      scenarioId: baselineId,
      projectId: 'proj-soc2-vault',
      personId: 'person-jordan',
      requiredRole: 'Senior DevOps Engineer',
      requiredSkills: ['SOC2', 'Terraform'],
      allocationMode: 'total_hours',
      allocationValue: 200,
      meta: {}
    },
    {
      id: 'asn-soc-tbdsec',
      scenarioId: baselineId,
      projectId: 'proj-soc2-vault',
      personId: 'person-tbd-sec',
      requiredRole: 'Security Specialist',
      requiredSkills: ['SOC2', 'FedRAMP', 'Auditing'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    },
    {
      id: 'asn-soc-samira',
      scenarioId: baselineId,
      projectId: 'proj-soc2-vault',
      personId: 'person-samira',
      requiredRole: 'Technical Program Manager',
      requiredSkills: ['Governance', 'Risk Management'],
      allocationMode: 'percent',
      allocationValue: 35,
      meta: {}
    },

    // Unified Developer Portal & Open Banking API
    {
      id: 'asn-dev-aisha',
      scenarioId: baselineId,
      projectId: 'proj-dev-portal',
      personId: 'person-aisha',
      requiredRole: 'Senior Frontend Engineer',
      requiredSkills: ['React', 'TypeScript', 'Tailwind'],
      allocationMode: 'total_hours',
      allocationValue: 280,
      meta: {}
    },
    {
      id: 'asn-dev-david',
      scenarioId: baselineId,
      projectId: 'proj-dev-portal',
      personId: 'person-david',
      requiredRole: 'Fullstack Engineer',
      requiredSkills: ['TypeScript', 'REST APIs'],
      allocationMode: 'total_hours',
      allocationValue: 260,
      meta: {}
    },
    {
      id: 'asn-dev-sofia',
      scenarioId: baselineId,
      projectId: 'proj-dev-portal',
      personId: 'person-sofia',
      requiredRole: 'Lead Product Designer',
      requiredSkills: ['Design Systems', 'UX Research'],
      allocationMode: 'total_hours',
      allocationValue: 180,
      meta: {}
    },

    // Automated Enterprise Customer Onboarding
    {
      id: 'asn-onb-david',
      scenarioId: baselineId,
      projectId: 'proj-onboarding-flow',
      personId: 'person-david',
      requiredRole: 'Fullstack Engineer',
      requiredSkills: ['TypeScript', 'React'],
      allocationMode: 'total_hours',
      allocationValue: 200,
      meta: {}
    },
    {
      id: 'asn-onb-lucas',
      scenarioId: baselineId,
      projectId: 'proj-onboarding-flow',
      personId: 'person-lucas',
      requiredRole: 'Mobile Engineer',
      requiredSkills: ['React Native'],
      allocationMode: 'total_hours',
      allocationValue: 180,
      meta: {}
    },

    // Pre-assignments on On-Deck Projects (retained when dragged onto timeline!)
    {
      id: 'asn-mesh-elena',
      scenarioId: baselineId,
      projectId: 'proj-graphql-mesh',
      personId: 'person-elena',
      requiredRole: 'Staff Engineer',
      requiredSkills: ['Architecture', 'Distributed Systems'],
      allocationMode: 'total_hours',
      allocationValue: 180,
      meta: {}
    },
    {
      id: 'asn-reconcile-vikram',
      scenarioId: baselineId,
      projectId: 'proj-ai-reconciliation',
      personId: 'person-vikram',
      requiredRole: 'Principal ML Engineer',
      requiredSkills: ['Python', 'AI/ML'],
      allocationMode: 'total_hours',
      allocationValue: 220,
      meta: {}
    }
  ]

  const milestones: ScenarioDataset['milestones'] = [
    {
      id: 'ms-fraud-baseline',
      scenarioId: baselineId,
      projectId: 'proj-ai-fraud',
      name: 'AI Model Accuracy Benchmark (99.4%)',
      targetDate: '2026-05-29',
      color: '#0d9488'
    },
    {
      id: 'ms-pay-iso',
      scenarioId: baselineId,
      projectId: 'proj-payment-gw',
      name: 'Swift / ISO 20022 Integration Sign-Off',
      targetDate: '2026-06-19',
      color: '#4f46e5'
    },
    {
      id: 'ms-zt-pentest',
      scenarioId: baselineId,
      projectId: 'proj-zero-trust',
      name: 'Third-Party Pen Test Verification',
      targetDate: '2026-07-24',
      color: '#d97706'
    },
    {
      id: 'ms-mob-beta',
      scenarioId: baselineId,
      projectId: 'proj-mobile-suite',
      name: 'Boardroom VIP Pilot Release',
      targetDate: '2026-08-07',
      color: '#7c3aed'
    },
    {
      id: 'ms-soc-attest',
      scenarioId: baselineId,
      projectId: 'proj-soc2-vault',
      name: 'SOC2 Type II Clean Audit Opinion',
      targetDate: '2026-10-16',
      color: '#2563eb'
    },
    {
      id: 'ms-dev-sandbox',
      scenarioId: baselineId,
      projectId: 'proj-dev-portal',
      name: 'Developer Sandbox Public Preview',
      targetDate: '2026-11-06',
      color: '#059669'
    }
  ]

  const dependencies: ScenarioDataset['dependencies'] = [
    {
      id: 'dep-zt-to-soc',
      scenarioId: baselineId,
      fromProjectId: 'proj-zero-trust',
      toProjectId: 'proj-soc2-vault'
    },
    {
      id: 'dep-pay-to-mobile',
      scenarioId: baselineId,
      fromProjectId: 'proj-payment-gw',
      toProjectId: 'proj-mobile-suite'
    },
    {
      id: 'dep-fraud-to-onboard',
      scenarioId: baselineId,
      fromProjectId: 'proj-ai-fraud',
      toProjectId: 'proj-onboarding-flow'
    }
  ]

  const holidays: ScenarioDataset['holidays'] = [
    {
      id: 'hol-memorial',
      scenarioId: baselineId,
      name: 'Memorial Day',
      startDate: '2026-05-25',
      endDate: '2026-05-25'
    },
    {
      id: 'hol-juneteenth',
      scenarioId: baselineId,
      name: 'Juneteenth National Independence Day',
      startDate: '2026-06-19',
      endDate: '2026-06-19'
    },
    {
      id: 'hol-july4',
      scenarioId: baselineId,
      name: 'Independence Day (Observed)',
      startDate: '2026-07-03',
      endDate: '2026-07-03'
    },
    {
      id: 'hol-labor',
      scenarioId: baselineId,
      name: 'Labor Day',
      startDate: '2026-09-07',
      endDate: '2026-09-07'
    },
    {
      id: 'hol-thanksgiving',
      scenarioId: baselineId,
      name: 'Thanksgiving Break',
      startDate: '2026-11-26',
      endDate: '2026-11-27'
    },
    {
      id: 'hol-shutdown',
      scenarioId: baselineId,
      name: 'Year-End Executive Shutdown',
      startDate: '2026-12-24',
      endDate: '2026-12-31'
    }
  ]

  const timeOff: ScenarioDataset['timeOff'] = [
    {
      id: 'pto-elena-trek',
      scenarioId: baselineId,
      personId: 'person-elena',
      reason: 'Summer Mountain Trek & Family Vacation',
      startDate: '2026-07-13',
      endDate: '2026-07-24',
      hoursPerDayOff: 8
    },
    {
      id: 'pto-marcus-aug',
      scenarioId: baselineId,
      personId: 'person-marcus',
      reason: 'Annual Summer Leave',
      startDate: '2026-08-10',
      endDate: '2026-08-14',
      hoursPerDayOff: 8
    },
    {
      id: 'pto-sofia-conf',
      scenarioId: baselineId,
      personId: 'person-sofia',
      reason: 'Design Systems Conference & Workshop',
      startDate: '2026-09-14',
      endDate: '2026-09-18',
      hoursPerDayOff: 8
    },
    {
      id: 'pto-vikram-sabbatical',
      scenarioId: baselineId,
      personId: 'person-vikram',
      reason: 'Applied AI Symposium & Keynote',
      startDate: '2026-06-22',
      endDate: '2026-06-26',
      hoursPerDayOff: 8
    }
  ]

  const monthlyBudgets = [
    { month: 1, amount: 105000, capex: 75000, opex: 30000 },
    { month: 2, amount: 110000, capex: 80000, opex: 30000 },
    { month: 3, amount: 115000, capex: 85000, opex: 30000 },
    { month: 4, amount: 125000, capex: 95000, opex: 30000 },
    { month: 5, amount: 140000, capex: 105000, opex: 35000 },
    { month: 6, amount: 148000, capex: 112000, opex: 36000 }, // Baseline demands exceed this in June!
    { month: 7, amount: 152000, capex: 115000, opex: 37000 }, // Baseline demands exceed this in July!
    { month: 8, amount: 150000, capex: 115000, opex: 35000 },
    { month: 9, amount: 142000, capex: 107000, opex: 35000 },
    { month: 10, amount: 138000, capex: 103000, opex: 35000 },
    { month: 11, amount: 130000, capex: 95000, opex: 35000 },
    { month: 12, amount: 120000, capex: 85000, opex: 35000 }
  ]

  const budgets: ScenarioDataset['budgets'] = monthlyBudgets.map((b) => ({
    scenarioId: baselineId,
    year: 2026,
    month: b.month,
    budgetAmount: b.amount,
    capexBudget: b.capex,
    opexBudget: b.opex,
    meta: {}
  }))

  const baseline: ScenarioDataset = {
    scenario: {
      id: baselineId,
      parentScenarioId: null,
      name: 'FY26 Official Baseline Roadmap',
      description: 'Committed executive portfolio plan prior to summer peak leveling',
      isBaseline: true,
      createdAt: now,
      meta: { approvedBy: 'Portfolio Investment Committee', version: '1.0-final' }
    },
    projects,
    people,
    assignments,
    milestones,
    dependencies,
    holidays,
    timeOff,
    budgets
  }

  // What-If Scenario: Stagger Mobile Banking to August + Pull TBD Cloud Engineer hire to June 1
  const whatIfProjects = projects.map((p) => {
    if (p.id === 'proj-mobile-suite') {
      return {
        ...p,
        scenarioId: whatIfId,
        startDate: '2026-08-24',
        endDate: '2026-11-20'
      }
    }
    return { ...p, scenarioId: whatIfId }
  })

  const whatIfPeople = people.map((p) => {
    if (p.id === 'person-tbd-cloud') {
      return {
        ...p,
        scenarioId: whatIfId,
        name: 'Sarah Lin (Expedited Cloud Hire - June 1)',
        isPlaceholder: false,
        startDate: '2026-06-01'
      }
    }
    return { ...p, scenarioId: whatIfId }
  })

  const whatIfMilestones = milestones.map((m) => {
    if (m.projectId === 'proj-mobile-suite') {
      return {
        ...m,
        scenarioId: whatIfId,
        targetDate: '2026-10-23'
      }
    }
    return { ...m, scenarioId: whatIfId }
  })

  const whatIf: ScenarioDataset = {
    scenario: {
      id: whatIfId,
      parentScenarioId: baselineId,
      name: 'What-If: Stagger Mobile & Expedite Cloud Hire',
      description: 'Levels summer June/July overload, removes Overrun Red, and balances monthly CapEx/OpEx',
      isBaseline: false,
      createdAt: now,
      meta: { hypothesis: 'Staggering Mobile by 11 weeks completely levels team load under 100%' }
    },
    projects: whatIfProjects,
    people: whatIfPeople,
    assignments: assignments.map((a) => ({ ...a, scenarioId: whatIfId })),
    milestones: whatIfMilestones,
    dependencies: dependencies.map((d) => ({ ...d, scenarioId: whatIfId })),
    holidays: holidays.map((h) => ({ ...h, scenarioId: whatIfId })),
    timeOff: timeOff.map((t) => ({ ...t, scenarioId: whatIfId })),
    budgets: budgets.map((b) => ({ ...b, scenarioId: whatIfId }))
  }

  return { baseline, whatIf }
}

export function writeDemoDatabase(targetPath: string): void {
  const dir = path.dirname(targetPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }

  const db = new Database(targetPath)

  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')
  db.pragma('cache_size = -32000')

  applyMigrations(db)
  initializeAiViewsAndReadme(db)

  const { baseline, whatIf } = buildDemoDataset()

  const saveDataset = (dataset: ScenarioDataset): void => {
    const s = dataset.scenario
    db.prepare(`
      INSERT INTO scenarios (id, parent_scenario_id, name, description, is_baseline, created_at, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.id,
      s.parentScenarioId,
      s.name,
      s.description,
      s.isBaseline ? 1 : 0,
      s.createdAt,
      JSON.stringify(s.meta || {})
    )

    const insertProj = db.prepare(`
      INSERT INTO projects (
        id, scenario_id, name, start_date, end_date, status, certainty,
        priority_rank, value_score, cost_mode, fixed_cost, capex_percent,
        blended_hourly_rate, color, meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const p of dataset.projects) {
      insertProj.run(
        p.id,
        p.scenarioId,
        p.name,
        p.startDate,
        p.endDate,
        p.status,
        p.certainty,
        p.priorityRank,
        p.valueScore,
        p.costMode,
        p.fixedCost,
        p.capexPercent,
        p.blendedHourlyRate,
        p.color,
        JSON.stringify(p.meta || {})
      )
    }

    const insertPerson = db.prepare(`
      INSERT INTO people (
        id, scenario_id, name, is_placeholder, role, department, skills,
        hours_per_day, hourly_rate, cost_type, start_date, end_date, meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const pe of dataset.people) {
      insertPerson.run(
        pe.id,
        pe.scenarioId,
        pe.name,
        pe.isPlaceholder ? 1 : 0,
        pe.role,
        pe.department,
        JSON.stringify(pe.skills || []),
        pe.hoursPerDay,
        pe.hourlyRate,
        pe.costType,
        pe.startDate,
        pe.endDate,
        JSON.stringify(pe.meta || {})
      )
    }

    const insertAsn = db.prepare(`
      INSERT INTO assignments (
        id, scenario_id, project_id, person_id, required_role,
        required_skills, allocation_mode, allocation_value, meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const a of dataset.assignments) {
      insertAsn.run(
        a.id,
        a.scenarioId,
        a.projectId,
        a.personId,
        a.requiredRole,
        JSON.stringify(a.requiredSkills || []),
        a.allocationMode,
        a.allocationValue,
        JSON.stringify(a.meta || {})
      )
    }

    const insertMs = db.prepare(`
      INSERT INTO milestones (id, scenario_id, project_id, name, target_date, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const m of dataset.milestones) {
      insertMs.run(m.id, m.scenarioId, m.projectId, m.name, m.targetDate, m.color)
    }

    const insertDep = db.prepare(`
      INSERT INTO dependencies (id, scenario_id, from_project_id, to_project_id)
      VALUES (?, ?, ?, ?)
    `)
    for (const d of dataset.dependencies) {
      insertDep.run(d.id, d.scenarioId, d.fromProjectId, d.toProjectId)
    }

    const insertHol = db.prepare(`
      INSERT INTO holidays (id, scenario_id, name, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const h of dataset.holidays) {
      insertHol.run(h.id, h.scenarioId, h.name, h.startDate, h.endDate)
    }

    const insertTimeOff = db.prepare(`
      INSERT INTO time_off (id, scenario_id, person_id, reason, start_date, end_date, hours_per_day_off)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const t of dataset.timeOff) {
      insertTimeOff.run(t.id, t.scenarioId, t.personId, t.reason, t.startDate, t.endDate, t.hoursPerDayOff)
    }

    const insertBudget = db.prepare(`
      INSERT INTO budgets (scenario_id, year, month, budget_amount, capex_budget, opex_budget, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const b of dataset.budgets) {
      insertBudget.run(b.scenarioId, b.year, b.month, b.budgetAmount, b.capexBudget, b.opexBudget, JSON.stringify(b.meta || {}))
    }

    syncAiMonthlyRollupForScenario(db, dataset)
  }

  saveDataset(baseline)
  saveDataset(whatIf)

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()

  console.log(`Successfully generated demo .rdeck file at: ${targetPath}`)
}

if (process.argv[1] && process.argv[1].includes('generateDemoDeck')) {
  const target = process.argv[2] || path.join(process.cwd(), 'demo-portfolio.rdeck')
  writeDemoDatabase(target)
}
