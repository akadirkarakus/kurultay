export interface AdminCharacter {
  id: string;
  slug: string;
  name: string;
  category: string;
  image_url: string | null;
  attributes: Record<string, number>;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  archived_at: string | null;
}

export interface AdminScenario {
  id: string;
  text: string;
  suggested_attributes: string[];
}

export interface AdminAccount {
  id: string;
  username: string;
  is_super_admin: boolean;
  created_at: string;
}
