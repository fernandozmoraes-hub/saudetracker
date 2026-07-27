export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alcohol_intake: {
        Row: {
          abv_percent: number
          alcohol_grams: number
          created_at: string
          date: string
          drink_type: string
          id: string
          notes: string | null
          num_drinks: number
          time: string | null
          user_id: string
          volume_ml: number
        }
        Insert: {
          abv_percent: number
          alcohol_grams: number
          created_at?: string
          date: string
          drink_type: string
          id?: string
          notes?: string | null
          num_drinks?: number
          time?: string | null
          user_id: string
          volume_ml: number
        }
        Update: {
          abv_percent?: number
          alcohol_grams?: number
          created_at?: string
          date?: string
          drink_type?: string
          id?: string
          notes?: string | null
          num_drinks?: number
          time?: string | null
          user_id?: string
          volume_ml?: number
        }
        Relationships: []
      }
      body_composition: {
        Row: {
          body_fat_pct: number
          created_at: string
          data_source: string
          date: string
          flagged_inconsistent: boolean
          id: string
          muscle_mass_kg: number
          notes: string | null
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct: number
          created_at?: string
          data_source?: string
          date: string
          flagged_inconsistent?: boolean
          id?: string
          muscle_mass_kg: number
          notes?: string | null
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number
          created_at?: string
          data_source?: string
          date?: string
          flagged_inconsistent?: boolean
          id?: string
          muscle_mass_kg?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      coach_athletes: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          status: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          status?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      daily_checks: {
        Row: {
          alcohol_yesterday: boolean | null
          body_battery: number | null
          created_at: string
          date: string
          hrv: number
          id: string
          mood: number | null
          notes: string | null
          resting_hr: number
          sleep_hours: number
          sleep_quality: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alcohol_yesterday?: boolean | null
          body_battery?: number | null
          created_at?: string
          date: string
          hrv: number
          id?: string
          mood?: number | null
          notes?: string | null
          resting_hr: number
          sleep_hours: number
          sleep_quality: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alcohol_yesterday?: boolean | null
          body_battery?: number | null
          created_at?: string
          date?: string
          hrv?: number
          id?: string
          mood?: number | null
          notes?: string | null
          resting_hr?: number
          sleep_hours?: number
          sleep_quality?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          active_for_selection: boolean
          brand: string | null
          created_at: string
          id: string
          max_km: number
          name: string
          start_date: string
          status: string
          total_km: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_for_selection?: boolean
          brand?: string | null
          created_at?: string
          id?: string
          max_km?: number
          name: string
          start_date?: string
          status?: string
          total_km?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_for_selection?: boolean
          brand?: string | null
          created_at?: string
          id?: string
          max_km?: number
          name?: string
          start_date?: string
          status?: string
          total_km?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          athlete_id: string
          coach_id: string
          content: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      performance_coach_history: {
        Row: {
          answer: string
          created_at: string
          data_sections_used: string[]
          entry_type: string
          favorite: boolean
          id: string
          intent_detected: string
          question: string
          report_period_end: string | null
          report_period_start: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          data_sections_used?: string[]
          entry_type?: string
          favorite?: boolean
          id?: string
          intent_detected: string
          question: string
          report_period_end?: string | null
          report_period_start?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          data_sections_used?: string[]
          entry_type?: string
          favorite?: boolean
          id?: string
          intent_detected?: string
          question?: string
          report_period_end?: string | null
          report_period_start?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_connections: {
        Row: {
          access_token: string
          athlete_name: string | null
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          strava_athlete_id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_name?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          strava_athlete_id: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_name?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          planned_duration_min: number | null
          planned_tss: number | null
          planned_zone: string | null
          status: string
          type: string
          workout_id: string | null
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          planned_duration_min?: number | null
          planned_tss?: number | null
          planned_zone?: string | null
          status?: string
          type: string
          workout_id?: string | null
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          planned_duration_min?: number | null
          planned_tss?: number | null
          planned_zone?: string | null
          status?: string
          type?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          lthr: number | null
          max_hr: number | null
          resting_hr: number | null
          updated_at: string | null
          user_id: string
          zone1_upper_pct: number | null
          zone2_upper_pct: number | null
          zone3_upper_pct: number | null
          zone4_upper_pct: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lthr?: number | null
          max_hr?: number | null
          resting_hr?: number | null
          updated_at?: string | null
          user_id: string
          zone1_upper_pct?: number | null
          zone2_upper_pct?: number | null
          zone3_upper_pct?: number | null
          zone4_upper_pct?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lthr?: number | null
          max_hr?: number | null
          resting_hr?: number | null
          updated_at?: string | null
          user_id?: string
          zone1_upper_pct?: number | null
          zone2_upper_pct?: number | null
          zone3_upper_pct?: number | null
          zone4_upper_pct?: number | null
        }
        Relationships: []
      }
      whoop_connections: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          needs_reauth: boolean
          refresh_token: string
          scope: string | null
          updated_at: string | null
          user_id: string
          whoop_user_id: number
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          needs_reauth?: boolean
          refresh_token: string
          scope?: string | null
          updated_at?: string | null
          user_id: string
          whoop_user_id: number
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          needs_reauth?: boolean
          refresh_token?: string
          scope?: string | null
          updated_at?: string | null
          user_id?: string
          whoop_user_id?: number
        }
        Relationships: []
      }
      workout_evaluations: {
        Row: {
          created_at: string
          efficiency_quality: string | null
          feeling_after: string | null
          follow_up_qa: Json | null
          general_suggestions: string | null
          id: string
          max_hr: number | null
          observations: string | null
          pain_discomfort: string | null
          risks_redflags: string | null
          summary_technical: string | null
          updated_at: string
          user_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          efficiency_quality?: string | null
          feeling_after?: string | null
          follow_up_qa?: Json | null
          general_suggestions?: string | null
          id?: string
          max_hr?: number | null
          observations?: string | null
          pain_discomfort?: string | null
          risks_redflags?: string | null
          summary_technical?: string | null
          updated_at?: string
          user_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          efficiency_quality?: string | null
          feeling_after?: string | null
          follow_up_qa?: Json | null
          general_suggestions?: string | null
          id?: string
          max_hr?: number | null
          observations?: string | null
          pain_discomfort?: string | null
          risks_redflags?: string | null
          summary_technical?: string | null
          updated_at?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_evaluations_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_feedback: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          text: string
          workout_id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          text: string
          workout_id: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          text?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_feedback_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          planned_duration_min: number | null
          planned_tss: number | null
          planned_zone: string | null
          type: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          planned_duration_min?: number | null
          planned_tss?: number | null
          planned_zone?: string | null
          type: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          planned_duration_min?: number | null
          planned_tss?: number | null
          planned_zone?: string | null
          type?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          avg_hr: number | null
          created_at: string
          date: string
          distance_km: number | null
          duration_min: number
          equipment_id: string | null
          id: string
          lthr_used: number | null
          muscle_groups: string[] | null
          rpe: number
          session_type: string | null
          strava_activity_id: number | null
          time_z1_min: number | null
          time_z2_min: number | null
          time_z3_min: number | null
          time_z4_min: number | null
          time_z5_min: number | null
          tss_final: number | null
          tss_method: string | null
          tss_subjective: number
          tss_version: string | null
          type: string
          user_id: string
          validated: boolean
        }
        Insert: {
          avg_hr?: number | null
          created_at?: string
          date: string
          distance_km?: number | null
          duration_min?: number
          equipment_id?: string | null
          id?: string
          lthr_used?: number | null
          muscle_groups?: string[] | null
          rpe?: number
          session_type?: string | null
          strava_activity_id?: number | null
          time_z1_min?: number | null
          time_z2_min?: number | null
          time_z3_min?: number | null
          time_z4_min?: number | null
          time_z5_min?: number | null
          tss_final?: number | null
          tss_method?: string | null
          tss_subjective?: number
          tss_version?: string | null
          type: string
          user_id: string
          validated?: boolean
        }
        Update: {
          avg_hr?: number | null
          created_at?: string
          date?: string
          distance_km?: number | null
          duration_min?: number
          equipment_id?: string | null
          id?: string
          lthr_used?: number | null
          muscle_groups?: string[] | null
          rpe?: number
          session_type?: string | null
          strava_activity_id?: number | null
          time_z1_min?: number | null
          time_z2_min?: number | null
          time_z3_min?: number | null
          time_z4_min?: number | null
          time_z5_min?: number | null
          tss_final?: number | null
          tss_method?: string | null
          tss_subjective?: number
          tss_version?: string | null
          type?: string
          user_id?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "workouts_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of: {
        Args: { _athlete_id: string; _coach_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "coach" | "athlete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["coach", "athlete"],
    },
  },
} as const
