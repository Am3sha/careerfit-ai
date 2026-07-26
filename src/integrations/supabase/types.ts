export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      applicants: {
        Row: {
          challenges: string | null;
          created_at: string;
          cv_path: string;
          email: string;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          phone: string;
          previous_experience: string | null;
          track: string;
          why_this_track: string;
          years_experience: string;
        };
        Insert: {
          challenges?: string | null;
          created_at?: string;
          cv_path: string;
          email: string;
          full_name: string;
          id?: string;
          linkedin_url?: string | null;
          phone: string;
          previous_experience?: string | null;
          track: string;
          why_this_track: string;
          years_experience: string;
        };
        Update: {
          challenges?: string | null;
          created_at?: string;
          cv_path?: string;
          email?: string;
          full_name?: string;
          id?: string;
          linkedin_url?: string | null;
          phone?: string;
          previous_experience?: string | null;
          track?: string;
          why_this_track?: string;
          years_experience?: string;
        };
        Relationships: [];
      };
      placements: {
        Row: {
          applicant_id: string;
          assigned_at: string;
          assigned_by: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          project_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          applicant_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          applicant_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          project_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "placements_applicant_id_fkey";
            columns: ["applicant_id"];
            isOneToOne: false;
            referencedRelation: "applicants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      cv_analyses: {
        Row: {
          ai_agrees_with_selection: boolean | null;
          applicant_id: string;
          ats_score: number | null;
          best_track: string | null;
          created_at: string;
          disagreement_reason: string | null;
          error_message: string | null;
          id: string;
          improvement_tips: string[];
          last_attempted_at: string | null;
          missing_skills: string[];
          raw_response: Json | null;
          recommended_tracks: Json;
          status: string;
          strengths: string[];
          summary: string | null;
          track_fit: boolean | null;
          track_fit_reason: string | null;
          updated_at: string;
          weaknesses: string[];
        };
        Insert: {
          ai_agrees_with_selection?: boolean | null;
          applicant_id: string;
          ats_score?: number | null;
          best_track?: string | null;
          created_at?: string;
          disagreement_reason?: string | null;
          error_message?: string | null;
          id?: string;
          improvement_tips?: string[];
          last_attempted_at?: string | null;
          missing_skills?: string[];
          raw_response?: Json | null;
          recommended_tracks?: Json;
          status?: string;
          strengths?: string[];
          summary?: string | null;
          track_fit?: boolean | null;
          track_fit_reason?: string | null;
          updated_at?: string;
          weaknesses?: string[];
        };
        Update: {
          ai_agrees_with_selection?: boolean | null;
          applicant_id?: string;
          ats_score?: number | null;
          best_track?: string | null;
          created_at?: string;
          disagreement_reason?: string | null;
          error_message?: string | null;
          id?: string;
          improvement_tips?: string[];
          last_attempted_at?: string | null;
          missing_skills?: string[];
          raw_response?: Json | null;
          recommended_tracks?: Json;
          status?: string;
          strengths?: string[];
          weaknesses?: string[];
          summary?: string | null;
          track_fit?: boolean | null;
          track_fit_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cv_analyses_applicant_id_fkey";
            columns: ["applicant_id"];
            isOneToOne: true;
            referencedRelation: "applicants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "ops" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ops", "user"],
    },
  },
} as const;
