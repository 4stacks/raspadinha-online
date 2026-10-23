export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      admin_users: Table<
        { user_id: string; created_at: string },
        { user_id: string; created_at?: string },
        { user_id?: string; created_at?: string }
      >;
      campaigns: Table<
        {
          id: string;
          slug: string;
          title: string;
          description: string;
          status: "draft" | "active" | "paused" | "ended";
          starts_at: string;
          ends_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          slug: string;
          title: string;
          description?: string;
          status?: "draft" | "active" | "paused" | "ended";
          starts_at: string;
          ends_at: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          slug?: string;
          title?: string;
          description?: string;
          status?: "draft" | "active" | "paused" | "ended";
          starts_at?: string;
          ends_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      prizes: Table<
        {
          id: string;
          campaign_id: string;
          title: string;
          description: string;
          probability: number;
          quantity: number | null;
          awarded_count: number;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          campaign_id: string;
          title: string;
          description?: string;
          probability: number;
          quantity?: number | null;
          awarded_count?: number;
          is_active?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          campaign_id?: string;
          title?: string;
          description?: string;
          probability?: number;
          quantity?: number | null;
          awarded_count?: number;
          is_active?: boolean;
          created_at?: string;
        }
      >;
      plays: Table<
        {
          id: string;
          campaign_id: string;
          participant_token: string;
          prize_id: string | null;
          prize_title_snapshot: string | null;
          prize_description_snapshot: string | null;
          created_at: string;
        },
        {
          id?: string;
          campaign_id: string;
          participant_token: string;
          prize_id?: string | null;
          prize_title_snapshot?: string | null;
          prize_description_snapshot?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          campaign_id?: string;
          participant_token?: string;
          prize_id?: string | null;
          prize_title_snapshot?: string | null;
          prize_description_snapshot?: string | null;
          created_at?: string;
        }
      >;
      redemptions: Table<
        {
          id: string;
          play_id: string;
          full_name: string;
          email: string;
          status: "pending" | "approved" | "redeemed" | "rejected";
          created_at: string;
        },
        {
          id?: string;
          play_id: string;
          full_name: string;
          email: string;
          status?: "pending" | "approved" | "redeemed" | "rejected";
          created_at?: string;
        },
        {
          id?: string;
          play_id?: string;
          full_name?: string;
          email?: string;
          status?: "pending" | "approved" | "redeemed" | "rejected";
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_public_campaign: {
        Args: { p_campaign_slug: string };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      play_scratchcard: {
        Args: { p_campaign_slug: string; p_participant_token: string };
        Returns: Json;
      };
      submit_redemption: {
        Args: { p_play_id: string; p_full_name: string; p_email: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
