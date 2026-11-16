// Rijtypes: 1-op-1 dezelfde kolommen als in Supabase (snake_case), zodat de sync generiek kan blijven.

export type DatePrecision = 'day' | 'month' | 'year';
export type GroupKey = 'family' | 'friends' | 'colleagues' | 'acquaintances' | 'other';
export type RelationshipType = 'partner' | 'family' | 'friend' | 'colleague' | 'other';
export type EventSystemKey = 'first_meeting' | 'new_relationship' | 'family' | 'friendship' | 'social_change' | 'memory' | 'birthday';

export interface BaseRow {
  id: string;
  created_at: string;
  /** Lokaal: tijdstip van de laatste wijziging. Na sync: door de server gezet. */
  updated_at: string;
  deleted_at: string | null;
  created_by?: string | null;
  /** Alleen lokaal: de serverversie (updated_at) waarop deze rij gebaseerd is. null = nog nooit op de server. */
  _base?: string | null;
}

export interface Profile extends BaseRow {
  slot: 1 | 2;
  name: string;
  avatar_path: string | null;
  user_id: string | null;
}

export interface Category extends BaseRow {
  name: string;
  description: string | null;
  color: string;
  icon: string;
  ring: 1 | 2 | 3 | 4;
  avatar_size: number;
  group_key: GroupKey;
  display_order: number;
  archived_at: string | null;
}

export interface ContactDetail {
  label: string;
  value: string;
}

export interface Person extends BaseRow {
  first_name: string;
  last_name: string | null;
  avatar_path: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  other_contacts: ContactDetail[];
  description: string | null;
  notes: string | null;
  hobbies: string | null;
  interests: string | null;
  important_info: string | null;
  met_via: string | null;
  first_met_at: string | null;
  first_met_precision: DatePrecision;
  added_at: string;
  category_id: string;
  ring_override: 1 | 2 | 3 | 4 | null;
  archived_at: string | null;
}

export interface PersonConnection extends BaseRow {
  person_id: string;
  profile_id: string;
  description: string | null;
}

export interface Relationship extends BaseRow {
  person_id: string;
  related_person_id: string;
  relationship_type: RelationshipType;
  description: string | null;
  since_date: string | null;
}

export interface NetworkPosition extends BaseRow {
  person_id: string;
  x_position: number;
  y_position: number;
}

export interface ContactHistory extends BaseRow {
  person_id: string;
  contact_date: string;
  kind: 'meeting' | 'call' | 'message' | 'visit' | 'other';
  description: string | null;
}

export interface EventCategory extends BaseRow {
  system_key: EventSystemKey | null;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  archived_at: string | null;
}

export interface StoryEvent extends BaseRow {
  title: string;
  description: string | null;
  personal_note: string | null;
  event_date: string;
  date_precision: DatePrecision;
  event_end_date: string | null;
  event_category_id: string;
  theme: string | null;
  location: string | null;
  is_highlight: boolean;
  is_private: boolean;
}

export interface EventPerson extends BaseRow {
  event_id: string;
  person_id: string;
}

export interface EventProfile extends BaseRow {
  event_id: string;
  profile_id: string;
}

export interface EventPhoto extends BaseRow {
  event_id: string;
  storage_path: string;
  thumb_path: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
}

export interface PhotoPerson extends BaseRow {
  photo_id: string;
  person_id: string;
}

export interface RelationshipHistory extends BaseRow {
  person_id: string;
  change_type: 'category' | 'status';
  category_id: string | null;
  previous_category_id: string | null;
  status: 'active' | 'archived' | null;
  effective_date: string;
  date_precision: DatePrecision;
  description: string | null;
}

/** Volgorde = afhankelijkheden: ouders vóór kinderen (pull én push). */
export const SYNC_TABLES = [
  'profiles',
  'categories',
  'event_categories',
  'persons',
  'person_connections',
  'relationships',
  'network_positions',
  'contact_history',
  'relationship_history',
  'events',
  'event_persons',
  'event_profiles',
  'event_photos',
  'photo_persons',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export interface RowTypes {
  profiles: Profile;
  categories: Category;
  event_categories: EventCategory;
  persons: Person;
  person_connections: PersonConnection;
  relationships: Relationship;
  network_positions: NetworkPosition;
  contact_history: ContactHistory;
  relationship_history: RelationshipHistory;
  events: StoryEvent;
  event_persons: EventPerson;
  event_profiles: EventProfile;
  event_photos: EventPhoto;
  photo_persons: PhotoPerson;
}

