import Joi from "joi";

// reusable fields
let objectIdPattern = /^[a-f0-9]{24}$/i

const objectId = Joi.string().pattern(objectIdPattern)

const user = Joi.object({
  id: objectId.required(),
  name: Joi.string().min(1).max(100).required()
}).unknown(true)

const loanAmount = Joi.number().greater(0)

const duration = Joi.number().integer().min(1)

const loanDate = Joi.date().greater("2020-01-01")

const loanType = Joi.valid("Standard", "Interest-Free")

const loanStatus = Joi.valid("Pending Approval", "Ongoing", "Ended", "Cancelled")

const cashLocation = Joi.object({
  id: objectId.required(),
  name: Joi.string().required()
}).unknown(true)

const sources = Joi.array().items(Joi.object({
  id: objectId.required(),
  amount: Joi.number().greater(0).required()
}))

// exported schemas
export const getLoans = Joi.object({
  filter: Joi.object({
    borrowerId: objectId,
    status: loanStatus,
    type: loanType,
    year: Joi.number().integer().min(2020).max(3000),
    month: Joi.number().integer().min(1).max(12)
  }).unknown(false),

  sort: Joi.object({
    field: Joi.valid("amount", "date"),
    order: Joi.valid(1, -1),
  }).unknown(false),

  pagination: Joi.object({
    page: Joi.number().integer().min(1),
    perPage: Joi.number().integer().min(1).max(100),
  }).unknown(false)

}).unknown(false)

export const getLoanById = objectId.required()

export const getLoanPayments = objectId.required()

export const getLoanPayment = Joi.object({
  loanId: objectId.required(),
  paymentId: objectId.required()
}).unknown(false)

export const initiateLoan = Joi.object({
  amount: loanAmount.required(),
  duration: duration.required(),
  earliestDate: loanDate.required(),
  latestDate: loanDate.required(),
  borrowerId: objectId.required(),
  loanType: loanType.required()
}).required().unknown(false)

export const approveLoan = Joi.object({
  loanId: objectId.required(),
  sources: sources.required()
}).required().unknown(false)

export const cancelLoanRequest = objectId.required()

export const processLoanPayment = Joi.object({
  loanId: objectId.required(),
  paymentAmount: loanAmount.required(),
  cashLocationId: objectId.required(),
  paymentDate: loanDate.required()
}).required().unknown(false)

export const calculateTotalMonthsDue = Joi.object({
  startDate: loanDate.required(),
  endDate: loanDate.required()
}).unknown(false)

export const calculatePointMonthsAccrued = Joi.object({
  loanStartDate: loanDate.required(),
  calculationEndDate: loanDate.required()
}).unknown(false)

export const calculateStandardLoanLimit = objectId.required()

export const getAggregatedLoanInterestByPeriod = Joi.object({
  memberIds: Joi.alternatives().try(objectId.required(), Joi.array().items(objectId).required()),
  periodStart: loanDate.required(),
  periodEnd: loanDate.required()
}).unknown(false)

export const getLoanEffectiveEndDate = Joi.object({
  loanId: objectId.required()
}).unknown(false)

export const getLimitMultiplier = Joi.object({
  interestPaid: Joi.number().required(),
  currentSavings: Joi.number().required()
}).unknown(false)

export const calculateStandardLoanPrincipalPaid = Joi.object({
  paymentAmount: loanAmount.required(),
  totalInterestDue: Joi.number().required(),
  principalLeft: Joi.number().required()
}).unknown(false)

export const calculateTotalInterestDueAmount = Joi.object({
  amount: loanAmount.required(),
  startDate: loanDate.required(),
  dueDate: loanDate.required()
}).unknown(false)

export const calculateCashInterestDueAmount = Joi.object({
  loanId: objectId.required(),
  dueDate: loanDate.required(),
  availablePoints: Joi.number().min(0).required()
}).unknown(false)

export const calculatePointsConsumed = Joi.object({
  pointsInterestDueAmount: Joi.number().min(0).required()
}).unknown(false)

export const calculatePointsInterestDueAmount = Joi.object({
  loanId: objectId.required(),
  availablePoints: Joi.number().min(0).required(),
  dueDate: loanDate.required()
}).unknown(false)

export const calculatePointsMonthsDue = Joi.object({
  loanStartDate: loanDate.required(),
  lastPaymentDate: loanDate.required(),
  currentDueDate: loanDate.required()
}).unknown(false)

export const calculateFreeLoanEligibility = Joi.object({
  userId: objectId.required(),
  requestedAmount: loanAmount.required(),
  requestedPeriod: duration.required()
}).unknown(false)

export const calculateFreeLoanPrincipleLeft = Joi.object({
  userId: objectId.required(),
  loanId: objectId.required(),
  paymentAmount: loanAmount.required(),
  paymentDate: loanDate.required()
}).unknown(false)

export const calculateFreeLoanOverdueMetrics = Joi.object({
  loanId: objectId.required(),
  userId: objectId.required(),
  paymentDate: loanDate.required()
}).unknown(false)