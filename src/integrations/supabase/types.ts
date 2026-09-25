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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          subject: string
          user_type: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          subject: string
          user_type: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          subject?: string
          user_type?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          contact_role: string | null
          created_at: string
          id: string
          name: string
          name_hi: string | null
        }
        Insert: {
          active?: boolean
          contact_role?: string | null
          created_at?: string
          id?: string
          name: string
          name_hi?: string | null
        }
        Update: {
          active?: boolean
          contact_role?: string | null
          created_at?: string
          id?: string
          name?: string
          name_hi?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          citizen_id: string | null
          comment: string | null
          created_at: string
          demo_owner_email: string | null
          id: string
          rating: number
          report_id: string
          resolved_successfully: boolean
        }
        Insert: {
          citizen_id?: string | null
          comment?: string | null
          created_at?: string
          demo_owner_email?: string | null
          id?: string
          rating: number
          report_id: string
          resolved_successfully?: boolean
        }
        Update: {
          citizen_id?: string | null
          comment?: string | null
          created_at?: string
          demo_owner_email?: string | null
          id?: string
          rating?: number
          report_id?: string
          resolved_successfully?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feedback_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      innovation_projects: {
        Row: {
          assigned_partner_id: string | null
          category_key: string | null
          created_at: string
          deadline: string | null
          deployment_approved: boolean
          description: string
          district: string | null
          expected_outcome: string | null
          government_comments: string | null
          id: string
          pilot_notes: string | null
          prototype_url: string | null
          research_notes: string | null
          source_report_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_partner_id?: string | null
          category_key?: string | null
          created_at?: string
          deadline?: string | null
          deployment_approved?: boolean
          description: string
          district?: string | null
          expected_outcome?: string | null
          government_comments?: string | null
          id?: string
          pilot_notes?: string | null
          prototype_url?: string | null
          research_notes?: string | null
          source_report_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_partner_id?: string | null
          category_key?: string | null
          created_at?: string
          deadline?: string | null
          deployment_approved?: boolean
          description?: string
          district?: string | null
          expected_outcome?: string | null
          government_comments?: string | null
          id?: string
          pilot_notes?: string | null
          prototype_url?: string | null
          research_notes?: string | null
          source_report_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "innovation_projects_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_categories: {
        Row: {
          active: boolean
          created_at: string
          default_department: string | null
          description: string | null
          id: string
          key: string
          name: string
          name_hi: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_department?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
          name_hi?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          default_department?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
          name_hi?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          demo_owner_email: string | null
          id: string
          message: string
          read: boolean
          report_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          demo_owner_email?: string | null
          id?: string
          message: string
          read?: boolean
          report_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          demo_owner_email?: string | null
          id?: string
          message?: string
          read?: boolean
          report_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          applicant_id: string | null
          created_at: string
          id: string
          innovation_project_id: string
          organization_name: string | null
          proposal: string | null
          status: string
          support_type: string | null
        }
        Insert: {
          applicant_id?: string | null
          created_at?: string
          id?: string
          innovation_project_id: string
          organization_name?: string | null
          proposal?: string | null
          status?: string
          support_type?: string | null
        }
        Update: {
          applicant_id?: string | null
          created_at?: string
          id?: string
          innovation_project_id?: string
          organization_name?: string | null
          proposal?: string | null
          status?: string
          support_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_innovation_project_id_fkey"
            columns: ["innovation_project_id"]
            isOneToOne: false
            referencedRelation: "innovation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          block: string | null
          created_at: string
          department_id: string | null
          district: string | null
          email: string | null
          full_name: string | null
          id: string
          mobile: string | null
          municipality: string | null
          organization_name: string | null
          preferred_language: string
          updated_at: string
          village_or_ward: string | null
        }
        Insert: {
          block?: string | null
          created_at?: string
          department_id?: string | null
          district?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          mobile?: string | null
          municipality?: string | null
          organization_name?: string | null
          preferred_language?: string
          updated_at?: string
          village_or_ward?: string | null
        }
        Update: {
          block?: string | null
          created_at?: string
          department_id?: string | null
          district?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          mobile?: string | null
          municipality?: string | null
          organization_name?: string | null
          preferred_language?: string
          updated_at?: string
          village_or_ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      report_media: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          report_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          report_id: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_updates: {
        Row: {
          created_at: string
          id: string
          new_status: string | null
          old_status: string | null
          remark: string | null
          report_id: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          remark?: string | null
          report_id: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          remark?: string | null
          report_id?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_updates_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_category: string | null
          ai_duplicate_count: number
          ai_next_action: string | null
          ai_priority: string | null
          ai_recommended_department: string | null
          assigned_department_id: string | null
          assigned_officer_id: string | null
          block: string | null
          category_key: string
          citizen_id: string | null
          created_at: string
          demo_owner_email: string | null
          description: string
          district: string
          id: string
          is_innovation: boolean
          latitude: number | null
          longitude: number | null
          municipality: string | null
          officer_remark: string | null
          priority: string
          public_issue_id: string
          reporter_name: string | null
          resolved_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
          village_or_ward: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_duplicate_count?: number
          ai_next_action?: string | null
          ai_priority?: string | null
          ai_recommended_department?: string | null
          assigned_department_id?: string | null
          assigned_officer_id?: string | null
          block?: string | null
          category_key: string
          citizen_id?: string | null
          created_at?: string
          demo_owner_email?: string | null
          description: string
          district: string
          id?: string
          is_innovation?: boolean
          latitude?: number | null
          longitude?: number | null
          municipality?: string | null
          officer_remark?: string | null
          priority?: string
          public_issue_id: string
          reporter_name?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          village_or_ward?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_duplicate_count?: number
          ai_next_action?: string | null
          ai_priority?: string | null
          ai_recommended_department?: string | null
          assigned_department_id?: string | null
          assigned_officer_id?: string | null
          block?: string | null
          category_key?: string
          citizen_id?: string | null
          created_at?: string
          demo_owner_email?: string | null
          description?: string
          district?: string
          id?: string
          is_innovation?: boolean
          latitude?: number | null
          longitude?: number | null
          municipality?: string | null
          officer_remark?: string | null
          priority?: string
          public_issue_id?: string
          reporter_name?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          village_or_ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_department_id_fkey"
            columns: ["assigned_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_report: { Args: { _report_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_partner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_department: { Args: { _user_id: string }; Returns: string }
      notify_staff: {
        Args: {
          _message: string
          _report_id: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "citizen"
        | "officer"
        | "dept_admin"
        | "university"
        | "partner"
        | "admin"
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
      app_role: [
        "citizen",
        "officer",
        "dept_admin",
        "university",
        "partner",
        "admin",
      ],
    },
  },
} as const
