export interface SalaryFormPersonRow {
  personnel_no?: string
  full_name?: string
  national_id?: string
  documents?: string
}

export interface SalaryFormDepartureRow extends SalaryFormPersonRow {
  leave_date?: string
  leave_reason?: string
}

export interface SalaryFormStarterRow extends SalaryFormPersonRow {
  iban?: string
  start_reason?: string
  start_date?: string
}

export interface SalaryFormOtherChangeRow extends SalaryFormPersonRow {
  previous_status?: string
  new_status?: string
}

export interface SalaryFormDeductionRow extends SalaryFormPersonRow {
  reason?: string
  amount?: string
}

export interface SalaryFormReportDayRow extends SalaryFormPersonRow {
  start_date?: string
  days_after_7?: number | string
}

export interface SalaryFormUnionChangeRow extends SalaryFormPersonRow {
  left_union?: string
  joined_union?: string
}

export interface SalaryFormDraftPayload {
  institution_name?: string
  bank_branch?: string
  accounting_code?: string
  principal?: string
  form_date?: string
  previous_month_count?: number | null
  started_count?: number | null
  left_count?: number | null
  payable_count?: number | null
  departures?: SalaryFormDepartureRow[]
  starters?: SalaryFormStarterRow[]
  other_changes?: SalaryFormOtherChangeRow[]
  deductions?: SalaryFormDeductionRow[]
  report_days?: SalaryFormReportDayRow[]
  union_changes?: SalaryFormUnionChangeRow[]
}

export interface SalaryFormDraftResponse {
  month: number
  year: number
  period_label?: string
  payload: SalaryFormDraftPayload
  promotion_count?: number
  updated_at?: string | null
}
