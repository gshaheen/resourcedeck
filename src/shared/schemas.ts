import { z } from 'zod'

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

export const ProjectStatusSchema = z.enum(['on_deck', 'timeline'])
export const ProjectCertaintySchema = z.enum(['confirmed', 'tentative'])
export const ProjectCostModeSchema = z.enum(['fixed', 'calculated'])
export const PersonCostTypeSchema = z.enum(['capex', 'opex', 'project_default'])
export const AllocationModeSchema = z.enum(['total_hours', 'hours_per_day', 'percent'])

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  parentScenarioId: z.string().nullable(),
  name: z.string().min(1),
  description: z.string().default(''),
  isBaseline: z.boolean().default(false),
  createdAt: z.string(),
  meta: z.record(z.unknown()).default({})
})

export const ProjectSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  name: z.string().min(1),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  status: ProjectStatusSchema.default('on_deck'),
  certainty: ProjectCertaintySchema.default('confirmed'),
  priorityRank: z.number().int().min(1).default(1),
  valueScore: z.number().min(0).max(100).default(75),
  costMode: ProjectCostModeSchema.default('fixed'),
  fixedCost: z.number().min(0).default(0),
  capexPercent: z.number().min(0).max(100).default(0),
  blendedHourlyRate: z.number().min(0).default(0),
  color: z.string().default('#4f46e5'),
  meta: z.record(z.unknown()).default({})
})

export const PersonSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  name: z.string().min(1),
  isPlaceholder: z.boolean().default(false),
  role: z.string().default('General'),
  department: z.string().default('Delivery'),
  skills: z.array(z.string()).default([]),
  hoursPerDay: z.number().min(0).max(24).default(8),
  hourlyRate: z.number().min(0).default(0),
  costType: PersonCostTypeSchema.default('project_default'),
  startDate: IsoDateSchema.nullable().default(null),
  endDate: IsoDateSchema.nullable().default(null),
  meta: z.record(z.unknown()).default({})
})

export const AssignmentSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  projectId: z.string().min(1),
  personId: z.string().min(1),
  requiredRole: z.string().default(''),
  requiredSkills: z.array(z.string()).default([]),
  allocationMode: AllocationModeSchema.default('total_hours'),
  allocationValue: z.number().min(0).default(0),
  meta: z.record(z.unknown()).default({})
})

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  targetDate: IsoDateSchema,
  color: z.string().default('#10b981')
})

export const DependencySchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  fromProjectId: z.string().min(1),
  toProjectId: z.string().min(1)
})

export const HolidaySchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  name: z.string().min(1),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema
})

export const TimeOffSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  personId: z.string().min(1),
  reason: z.string().default('PTO'),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  hoursPerDayOff: z.number().min(0).max(24).default(8)
})

export const MonthlyBudgetSchema = z.object({
  scenarioId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  budgetAmount: z.number().min(0).default(0),
  capexBudget: z.number().min(0).default(0),
  opexBudget: z.number().min(0).default(0),
  meta: z.record(z.unknown()).default({})
})
