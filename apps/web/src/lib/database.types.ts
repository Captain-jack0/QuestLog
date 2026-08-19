export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          description: string
          icon: string
          id: string
          name: string
        }
        Insert: {
          code: string
          description: string
          icon: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      focus_items: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          id: string
          project_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'focus_items_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'focus_items_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      life_areas: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          digest_enabled: boolean
          digest_time: string
          display_name: string | null
          id: string
          push_enabled: boolean
          stale_days: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          display_name?: string | null
          id: string
          push_enabled?: boolean
          stale_days?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          digest_time?: string
          display_name?: string | null
          id?: string
          push_enabled?: boolean
          stale_days?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          created_at: string
          id: string
          left_off: string | null
          next_step: string | null
          note: string | null
          project_id: string
          source: Database['public']['Enums']['log_source']
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          left_off?: string | null
          next_step?: string | null
          note?: string | null
          project_id: string
          source?: Database['public']['Enums']['log_source']
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          left_off?: string | null
          next_step?: string | null
          note?: string | null
          project_id?: string
          source?: Database['public']['Enums']['log_source']
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'progress_logs_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'progress_logs_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          area_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority: Database['public']['Enums']['priority']
          snoozed_until: string | null
          status: Database['public']['Enums']['item_status']
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database['public']['Enums']['priority']
          snoozed_until?: string | null
          status?: Database['public']['Enums']['item_status']
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database['public']['Enums']['priority']
          snoozed_until?: string | null
          status?: Database['public']['Enums']['item_status']
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'life_areas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'v_area_stats'
            referencedColumns: ['area_id']
          },
        ]
      }
      streaks: {
        Row: {
          best: number
          current: number
          freeze_tokens: number
          last_active_date: string | null
          user_id: string
        }
        Insert: {
          best?: number
          current?: number
          freeze_tokens?: number
          last_active_date?: string | null
          user_id: string
        }
        Update: {
          best?: number
          current?: number
          freeze_tokens?: number
          last_active_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          difficulty: Database['public']['Enums']['difficulty']
          id: string
          project_id: string
          snoozed_until: string | null
          sort_order: number
          status: Database['public']['Enums']['item_status']
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          difficulty?: Database['public']['Enums']['difficulty']
          id?: string
          project_id: string
          snoozed_until?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['item_status']
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          difficulty?: Database['public']['Enums']['difficulty']
          id?: string
          project_id?: string
          snoozed_until?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['item_status']
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_badges_badge_id_fkey'
            columns: ['badge_id']
            isOneToOne: false
            referencedRelation: 'badges'
            referencedColumns: ['id']
          },
        ]
      }
      xp_events: {
        Row: {
          action_type: string
          area_id: string | null
          created_at: string
          id: string
          project_id: string | null
          task_id: string | null
          user_id: string
          xp: number
        }
        Insert: {
          action_type: string
          area_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          user_id: string
          xp: number
        }
        Update: {
          action_type?: string
          area_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: 'xp_events_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'life_areas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'xp_events_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'v_area_stats'
            referencedColumns: ['area_id']
          },
          {
            foreignKeyName: 'xp_events_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'xp_events_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v_area_stats: {
        Row: {
          area_id: string | null
          color: string | null
          icon: string | null
          level: number | null
          name: string | null
          open_projects: number | null
          open_tasks: number | null
          total_xp: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_hanging_threads: {
        Row: {
          area_color: string | null
          area_id: string | null
          area_name: string | null
          item_id: string | null
          item_type: string | null
          last_activity_at: string | null
          left_off: string | null
          logged_at: string | null
          next_step: string | null
          project_id: string | null
          project_title: string | null
          status: Database['public']['Enums']['item_status'] | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_xp: {
        Args: {
          p_action: string
          p_area?: string
          p_project?: string
          p_task?: string
          p_user: string
          p_xp: number
        }
        Returns: number
      }
      grant_badge: {
        Args: { p_code: string; p_user: string }
        Returns: boolean
      }
      level_for_xp: { Args: { total_xp: number }; Returns: number }
      rpc_groom_stale: {
        Args: { p_item_id: string; p_item_type: string }
        Returns: Json
      }
      rpc_pick_focus: { Args: { p_date: string; p_items: Json }; Returns: Json }
      rpc_snooze: {
        Args: { p_item_id: string; p_item_type: string; p_until: string }
        Returns: Json
      }
      rpc_update_status: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_left_off: string
          p_new_status: Database['public']['Enums']['item_status']
          p_next_step: string
          p_note?: string
          p_source?: string
        }
        Returns: Json
      }
    }
    Enums: {
      difficulty: 'S' | 'M' | 'L'
      item_status: 'idea' | 'planned' | 'in_progress' | 'paused' | 'blocked' | 'done' | 'dropped'
      log_source: 'user' | 'ai'
      priority: 'low' | 'med' | 'high'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      difficulty: ['S', 'M', 'L'],
      item_status: ['idea', 'planned', 'in_progress', 'paused', 'blocked', 'done', 'dropped'],
      log_source: ['user', 'ai'],
      priority: ['low', 'med', 'high'],
    },
  },
} as const
