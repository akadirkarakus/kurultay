/**
 * Hand-authored to match supabase/migrations/*.sql until a real project is
 * linked and `supabase gen types typescript --linked` can regenerate this
 * file from the live schema.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      characters: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: string;
          image_url: string | null;
          attributes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["characters"]["Row"]> & {
          slug: string;
          name: string;
          category: string;
          attributes: Json;
        };
        Update: Partial<Database["public"]["Tables"]["characters"]["Row"]>;
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          room_code: string;
          status: "lobby" | "deck_selection" | "in_round" | "round_result" | "finished";
          current_round: number;
          max_rounds: number;
          host_player_id: string | null;
          created_at: string;
          draft_categories: string[];
          current_draft_step: number;
          draft_deadline_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["games"]["Row"]> & {
          room_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Row"]>;
        Relationships: [];
      };
      game_players: {
        Row: {
          id: string;
          game_id: string;
          nickname: string;
          session_token: string;
          draft_offer: string[];
          deck: string[];
          used_characters: string[];
          score: number;
          is_ready: boolean;
          joined_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["game_players"]["Row"]> & {
          game_id: string;
          nickname: string;
          session_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_players"]["Row"]>;
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          game_id: string;
          round_number: number;
          scenario_text: string;
          key_attributes: string[];
          deadline_at: string | null;
          status: "picking" | "resolving" | "resolved";
          winner_commentary: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["rounds"]["Row"]> & {
          game_id: string;
          round_number: number;
          scenario_text: string;
          key_attributes: string[];
        };
        Update: Partial<Database["public"]["Tables"]["rounds"]["Row"]>;
        Relationships: [];
      };
      round_picks: {
        Row: {
          id: string;
          round_id: string;
          player_id: string;
          character_id: string;
          average: number | null;
          is_auto_pick: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["round_picks"]["Row"]> & {
          round_id: string;
          player_id: string;
          character_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["round_picks"]["Row"]>;
        Relationships: [];
      };
      scenarios: {
        Row: {
          id: string;
          text: string;
          suggested_attributes: string[];
        };
        Insert: Partial<Database["public"]["Tables"]["scenarios"]["Row"]> & {
          text: string;
          suggested_attributes: string[];
        };
        Update: Partial<Database["public"]["Tables"]["scenarios"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      game_players_public: {
        Row: {
          id: string;
          game_id: string;
          nickname: string;
          score: number;
          is_ready: boolean;
          joined_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      resolve_round: {
        Args: { p_round_id: string };
        Returns: undefined;
      };
      resolve_tiebreak_round: {
        Args: { p_round_id: string; p_tied_player_ids: string[] };
        Returns: undefined;
      };
      submit_draft_pick: {
        Args: { p_player_id: string; p_step_number: number; p_character_id: string };
        Returns: boolean;
      };
    };
  };
}
