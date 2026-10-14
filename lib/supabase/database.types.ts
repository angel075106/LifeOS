/**
 * Database types for the LifeOS schema (supabase/migrations).
 *
 * Written in the same shape as `supabase gen types typescript` output so it can be replaced
 * by generated types at any time:
 *   npx supabase gen types typescript --project-id <project-ref> > lib/supabase/database.types.ts
 * (then re-export the aliases at the bottom of this file from lib/types.ts if needed).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          currency: string;
          timezone: string;
          default_calendar_view: string;
          week_starts_on: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          currency?: string;
          timezone?: string;
          default_calendar_view?: string;
          week_starts_on?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          currency?: string;
          timezone?: string;
          default_calendar_view?: string;
          week_starts_on?: number;
        };
        Relationships: [];
      };
      activity_categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          is_archived: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color: string;
          is_archived?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          is_archived?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          title: string;
          notes: string | null;
          start_at: string;
          end_at: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          category_id: string;
          title: string;
          notes?: string | null;
          start_at: string;
          end_at: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          title?: string;
          notes?: string | null;
          start_at?: string;
          end_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_category_fk";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "activity_categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      finance_categories: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          name: string;
          color: string;
          is_archived: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          kind: string;
          name: string;
          color: string;
          is_archived?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          is_archived?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          amount_minor: number;
          currency: string;
          occurred_on: string;
          category_id: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          type: string;
          amount_minor: number;
          currency: string;
          occurred_on: string;
          category_id: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: string;
          amount_minor?: number;
          currency?: string;
          occurred_on?: string;
          category_id?: string;
          description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_category_fk";
            columns: ["category_id", "type", "user_id"];
            isOneToOne: false;
            referencedRelation: "finance_categories";
            referencedColumns: ["id", "kind", "user_id"];
          },
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          category_kind: string;
          month: string;
          currency: string;
          amount_minor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          category_id: string;
          category_kind?: string;
          month: string;
          currency: string;
          amount_minor: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_fk";
            columns: ["category_id", "category_kind", "user_id"];
            isOneToOne: false;
            referencedRelation: "finance_categories";
            referencedColumns: ["id", "kind", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bootstrap_current_user: {
        Args: never;
        Returns: undefined;
      };
      delete_activity_category: {
        Args: { p_category_id: string; p_replacement_id?: string };
        Returns: undefined;
      };
      delete_finance_category: {
        Args: { p_category_id: string; p_replacement_id?: string };
        Returns: undefined;
      };
      upsert_budget: {
        Args: { p_category_id: string; p_month: string; p_currency: string; p_amount_minor: number };
        Returns: Database["public"]["Tables"]["budgets"]["Row"];
      };
      copy_budgets: {
        Args: { p_from_month: string; p_to_month: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
