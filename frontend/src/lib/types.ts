export type ContractRow = {
  id: string;
  contract_number: string | null;
  advertiser_name: string;
  city: string | null;
  expiry_date: string;
  expiry_unknown?: boolean;
  contract_status: string;
  monthly_rent_net: number | null;
  custom_values: Record<string, ContractCustomValue>;
};

export type ContractsListResponse = {
  items: ContractRow[];
  custom_columns: CustomContractColumn[];
};

export type CustomContractColumn = {
  id: string;
  name: string;
  prompt_template: string;
  output_type: "text" | "number" | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ContractCustomColumn = CustomContractColumn;

export type ContractCustomValue = {
  status: "pending" | "computed" | "failed" | string;
  value_text: string | null;
  value_number: number | null;
  error_message: string | null;
  computed_at: string | null;
};

export type CreateCustomContractColumnRequest = {
  owner_user_id: string;
  name: string;
  prompt_template: string;
  output_type: "text" | "number";
};

export type HeaderMappingSuggestion = {
  source_column_name: string;
  target_field_name: string | null;
  guessed_confidence: number;
  guessed_rationale: string;
  transform_hint: string | null;
  is_required_target: boolean;
};

export type MappingProposalResponse = {
  session_id: string;
  file_name: string;
  owner_user_id: string;
  total_rows: number;
  columns: string[];
  mapping_suggestions: HeaderMappingSuggestion[];
  guessed_by_model: string;
  warning: string | null;
};

export type MappingConfirmationItem = {
  source_column_name: string;
  target_field_name: string | null;
  confirmed_by_user: boolean;
  user_override: boolean;
  transform_hint: string | null;
};

export type ImportMappingConfirmationRequest = {
  session_id: string;
  owner_user_id: string;
  mapping: MappingConfirmationItem[];
};

export type ImportExecuteResponse = {
  session_id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_rows: number;
  errors_preview: { row: number; errors: { field: string; reason: string }[] }[];
};

export type HubertChatResponse = {
  conversation_id: string | null;
  response: string;
  mode: string;
};

