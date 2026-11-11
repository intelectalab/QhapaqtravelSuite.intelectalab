export interface RecordEvent {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  before: string | null;
  after: string | null;
  actor: string | null;
  occurred_at: string;
}
