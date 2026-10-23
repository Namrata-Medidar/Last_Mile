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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          created_by: string | null
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      booking_comments: {
        Row: {
          author_id: string
          author_name: string
          author_role: string
          body: string
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          author_id?: string
          author_name: string
          author_role: string
          body: string
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_role?: string
          body?: string
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_comments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          event: string
          from_status: string | null
          id: string
          note: string | null
          status: string
          to_status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          event: string
          from_status?: string | null
          id?: string
          note?: string | null
          status?: string
          to_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          event?: string
          from_status?: string | null
          id?: string
          note?: string | null
          status?: string
          to_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number
          city: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_feedback: string | null
          customer_id: string
          customer_name: string | null
          customer_rating: number | null
          details: Json
          engineer_id: string | null
          engineer_name: string
          engineer_phone: string | null
          id: string
          invoice_no: string | null
          last_contact: string | null
          payment_status: string
          priority: string
          progress: number
          service_slug: string
          site_address: string | null
          started_at: string | null
          status: string
          ticket_no: string
          title: string
          total: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid?: number
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_feedback?: string | null
          customer_id: string
          customer_name?: string | null
          customer_rating?: number | null
          details?: Json
          engineer_id?: string | null
          engineer_name?: string
          engineer_phone?: string | null
          id?: string
          invoice_no?: string | null
          last_contact?: string | null
          payment_status?: string
          priority?: string
          progress?: number
          service_slug?: string
          site_address?: string | null
          started_at?: string | null
          status?: string
          ticket_no?: string
          title: string
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_feedback?: string | null
          customer_id?: string
          customer_name?: string | null
          customer_rating?: number | null
          details?: Json
          engineer_id?: string | null
          engineer_name?: string
          engineer_phone?: string | null
          id?: string
          invoice_no?: string | null
          last_contact?: string | null
          payment_status?: string
          priority?: string
          progress?: number
          service_slug?: string
          site_address?: string | null
          started_at?: string | null
          status?: string
          ticket_no?: string
          title?: string
          total?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineers: {
        Row: {
          approval_status: string
          available: boolean
          city: string
          created_at: string
          created_by: string | null
          full_name: string
          grade: string
          id: string
          kit: string | null
          max_active_jobs: number
          mode: string
          phone: string | null
          rating: number
          ratings_count: number
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          available?: boolean
          city: string
          created_at?: string
          created_by?: string | null
          full_name: string
          grade?: string
          id?: string
          kit?: string | null
          max_active_jobs?: number
          mode?: string
          phone?: string | null
          rating?: number
          ratings_count?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string
          available?: boolean
          city?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          grade?: string
          id?: string
          kit?: string | null
          max_active_jobs?: number
          mode?: string
          phone?: string | null
          rating?: number
          ratings_count?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          rate: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          rate: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          rate?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          booking_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          detail: string | null
          event: string
          id: string
          read_at: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          event: string
          id?: string
          read_at?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          event?: string
          id?: string
          read_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string
          note: string | null
          reference: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method: string
          note?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string
          note?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      priorities: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          dispatch_fee: number
          id: string
          label: string
          multiplier: number
          scheduled: boolean
          sla: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          dispatch_fee?: number
          id?: string
          label: string
          multiplier: number
          scheduled?: boolean
          sla: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          dispatch_fee?: number
          id?: string
          label?: string
          multiplier?: number
          scheduled?: boolean
          sla?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          card_code: string
          created_at: string
          created_by: string | null
          grade: string
          hourly: number
          id: string
          label: string
          min_charge: number
          min_hours: number
          off_hours_hourly: number
          off_hours_min: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          card_code: string
          created_at?: string
          created_by?: string | null
          grade: string
          hourly: number
          id?: string
          label: string
          min_charge: number
          min_hours: number
          off_hours_hourly: number
          off_hours_min: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          card_code?: string
          created_at?: string
          created_by?: string | null
          grade?: string
          hourly?: number
          id?: string
          label?: string
          min_charge?: number
          min_hours?: number
          off_hours_hourly?: number
          off_hours_min?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_key: string
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          image_key?: string
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_key?: string
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          status: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_engineer: { Args: { _booking_id: string }; Returns: string }
      engineer_job_action: {
        Args: { _action: string; _booking_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_engineer_id: { Args: never; Returns: string }
      pick_engineer: { Args: { _booking_id: string }; Returns: string }
      rate_booking: {
        Args: { _booking_id: string; _feedback: string; _rating: number }
        Returns: undefined
      }
      record_payment: {
        Args: {
          _amount: number
          _booking_id: string
          _kind: string
          _method: string
          _note: string
          _reference: string
        }
        Returns: undefined
      }
      set_my_availability: { Args: { _available: boolean }; Returns: undefined }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "ops_manager"
        | "engineer"
        | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "admin", "ops_manager", "engineer", "customer"],
    },
  },
} as const
