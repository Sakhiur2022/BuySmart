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
      activity_logs: {
        Row: {
          action: string | null
          activity_type: Database["public"]["Enums"]["activity_type_enum"]
          agent_name: string | null
          agent_version: string | null
          confidence_score: number | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          input_data: Json | null
          ip_address: unknown
          log_id: string
          metadata: Json | null
          model_used: string | null
          output_data: Json | null
          processing_time_ms: number | null
          session_id: string | null
          severity: Database["public"]["Enums"]["log_severity_enum"]
          status: Database["public"]["Enums"]["log_status_enum"]
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          activity_type: Database["public"]["Enums"]["activity_type_enum"]
          agent_name?: string | null
          agent_version?: string | null
          confidence_score?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          input_data?: Json | null
          ip_address?: unknown
          log_id?: string
          metadata?: Json | null
          model_used?: string | null
          output_data?: Json | null
          processing_time_ms?: number | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["log_severity_enum"]
          status?: Database["public"]["Enums"]["log_status_enum"]
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type_enum"]
          agent_name?: string | null
          agent_version?: string | null
          confidence_score?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          input_data?: Json | null
          ip_address?: unknown
          log_id?: string
          metadata?: Json | null
          model_used?: string | null
          output_data?: Json | null
          processing_time_ms?: number | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["log_severity_enum"]
          status?: Database["public"]["Enums"]["log_status_enum"]
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_model_configs: {
        Row: {
          agent_name: string
          config_id: number
          configuration: Json
          created_at: string
          is_active: boolean
          model_name: string
          performance_metrics: Json | null
          updated_at: string
          version: string
        }
        Insert: {
          agent_name: string
          config_id?: number
          configuration: Json
          created_at?: string
          is_active?: boolean
          model_name: string
          performance_metrics?: Json | null
          updated_at?: string
          version: string
        }
        Update: {
          agent_name?: string
          config_id?: number
          configuration?: Json
          created_at?: string
          is_active?: boolean
          model_name?: string
          performance_metrics?: Json | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_id: number
          created_at: string
          description: string | null
          is_active: boolean
          level: number | null
          name: string
          parent_category_id: number | null
          updated_at: string
        }
        Insert: {
          category_id?: number
          created_at?: string
          description?: string | null
          is_active?: boolean
          level?: number | null
          name: string
          parent_category_id?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: number
          created_at?: string
          description?: string | null
          is_active?: boolean
          level?: number | null
          name?: string
          parent_category_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      feedback: {
        Row: {
          ai_category:
            | Database["public"]["Enums"]["ai_feedback_category_enum"]
            | null
          ai_confidence_score: number | null
          ai_keywords: string[] | null
          ai_processed_at: string | null
          ai_sentiment: Database["public"]["Enums"]["ai_sentiment_enum"] | null
          ai_urgency: Database["public"]["Enums"]["ai_urgency_enum"] | null
          comment: string | null
          created_at: string
          feedback_id: string
          feedback_type: Database["public"]["Enums"]["feedback_type_enum"]
          images: Json | null
          is_helpful: number
          is_reported: boolean
          is_verified_purchase: boolean
          moderated_at: string | null
          moderator_id: string | null
          order_id: string | null
          order_item_id: string | null
          product_id: string | null
          rating: number | null
          status: Database["public"]["Enums"]["feedback_status_enum"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category?:
            | Database["public"]["Enums"]["ai_feedback_category_enum"]
            | null
          ai_confidence_score?: number | null
          ai_keywords?: string[] | null
          ai_processed_at?: string | null
          ai_sentiment?: Database["public"]["Enums"]["ai_sentiment_enum"] | null
          ai_urgency?: Database["public"]["Enums"]["ai_urgency_enum"] | null
          comment?: string | null
          created_at?: string
          feedback_id?: string
          feedback_type: Database["public"]["Enums"]["feedback_type_enum"]
          images?: Json | null
          is_helpful?: number
          is_reported?: boolean
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderator_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status_enum"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category?:
            | Database["public"]["Enums"]["ai_feedback_category_enum"]
            | null
          ai_confidence_score?: number | null
          ai_keywords?: string[] | null
          ai_processed_at?: string | null
          ai_sentiment?: Database["public"]["Enums"]["ai_sentiment_enum"] | null
          ai_urgency?: Database["public"]["Enums"]["ai_urgency_enum"] | null
          comment?: string | null
          created_at?: string
          feedback_id?: string
          feedback_type?: Database["public"]["Enums"]["feedback_type_enum"]
          images?: Json | null
          is_helpful?: number
          is_reported?: boolean
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderator_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["feedback_status_enum"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "feedback_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          order_id: string
          order_item_id: string
          product_id: string
          product_snapshot: Json | null
          quantity: number
          seller_id: string
          status: Database["public"]["Enums"]["order_item_status_enum"]
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          order_id: string
          order_item_id?: string
          product_id: string
          product_snapshot?: Json | null
          quantity: number
          seller_id: string
          status?: Database["public"]["Enums"]["order_item_status_enum"]
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          order_id?: string
          order_item_id?: string
          product_id?: string
          product_snapshot?: Json | null
          quantity?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["order_item_status_enum"]
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          buyer_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          discount_amount: number
          notes: string | null
          order_id: string
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at: string | null
          shipping_address: Json | null
          shipping_amount: number
          status: Database["public"]["Enums"]["order_status_enum"]
          subtotal: number
          tax_amount: number
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          buyer_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          discount_amount?: number
          notes?: string | null
          order_id?: string
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          subtotal: number
          tax_amount?: number
          total_amount: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          buyer_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          discount_amount?: number
          notes?: string | null
          order_id?: string
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: number | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string | null
          dimensions: Json | null
          embedding: string | null
          embedding_model: string | null
          embedding_updated_at: string | null
          featured: boolean
          images: Json | null
          inventory_quantity: number
          inventory_tracked: boolean
          meta_data: Json | null
          name: string
          price: number
          product_id: string
          seller_id: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status_enum"]
          tags: string[] | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          category_id?: number | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          featured?: boolean
          images?: Json | null
          inventory_quantity?: number
          inventory_tracked?: boolean
          meta_data?: Json | null
          name: string
          price: number
          product_id?: string
          seller_id: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status_enum"]
          tags?: string[] | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          category_id?: number | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          featured?: boolean
          images?: Json | null
          inventory_quantity?: number
          inventory_tracked?: boolean
          meta_data?: Json | null
          name?: string
          price?: number
          product_id?: string
          seller_id?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status_enum"]
          tags?: string[] | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      refunds: {
        Row: {
          ai_analysis: Json | null
          ai_processed_at: string | null
          ai_recommendation:
            | Database["public"]["Enums"]["ai_refund_decision_enum"]
            | null
          ai_risk_score: number | null
          created_at: string
          evidence_images: Json | null
          order_id: string
          order_item_id: string | null
          payment_reference: string | null
          processed_at: string | null
          processed_by: string | null
          processing_notes: string | null
          reason_code: Database["public"]["Enums"]["refund_reason_enum"]
          reason_description: string | null
          refund_amount: number
          refund_id: string
          refund_number: string
          refund_type: Database["public"]["Enums"]["refund_type_enum"]
          refunded_at: string | null
          requested_amount: number
          return_received_at: string | null
          return_required: boolean
          return_tracking: string | null
          status: Database["public"]["Enums"]["refund_status_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_processed_at?: string | null
          ai_recommendation?:
            | Database["public"]["Enums"]["ai_refund_decision_enum"]
            | null
          ai_risk_score?: number | null
          created_at?: string
          evidence_images?: Json | null
          order_id: string
          order_item_id?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          reason_code: Database["public"]["Enums"]["refund_reason_enum"]
          reason_description?: string | null
          refund_amount: number
          refund_id?: string
          refund_number: string
          refund_type: Database["public"]["Enums"]["refund_type_enum"]
          refunded_at?: string | null
          requested_amount: number
          return_received_at?: string | null
          return_required?: boolean
          return_tracking?: string | null
          status?: Database["public"]["Enums"]["refund_status_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_processed_at?: string | null
          ai_recommendation?:
            | Database["public"]["Enums"]["ai_refund_decision_enum"]
            | null
          ai_risk_score?: number | null
          created_at?: string
          evidence_images?: Json | null
          order_id?: string
          order_item_id?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          reason_code?: Database["public"]["Enums"]["refund_reason_enum"]
          reason_description?: string | null
          refund_amount?: number
          refund_id?: string
          refund_number?: string
          refund_type?: Database["public"]["Enums"]["refund_type_enum"]
          refunded_at?: string | null
          requested_amount?: number
          return_received_at?: string | null
          return_required?: boolean
          return_tracking?: string | null
          status?: Database["public"]["Enums"]["refund_status_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "refunds_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users_profile: {
        Row: {
          address: Json | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean
          full_name: string | null
          is_active: boolean
          phone: string | null
          preferences: Json | null
          profile_completed: boolean
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: Json | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          full_name?: string | null
          is_active?: boolean
          phone?: string | null
          preferences?: Json | null
          profile_completed?: boolean
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: Json | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          full_name?: string | null
          is_active?: boolean
          phone?: string | null
          preferences?: Json | null
          profile_completed?: boolean
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_type_enum:
        | "auth"
        | "product_view"
        | "search"
        | "cart"
        | "order"
        | "payment"
        | "feedback"
        | "refund"
        | "ai_action"
        | "system_event"
        | "security_event"
      ai_feedback_category_enum:
        | "product_quality"
        | "delivery"
        | "customer_service"
        | "pricing"
        | "user_experience"
        | "other"
      ai_refund_decision_enum: "auto_approve" | "manual_review" | "auto_reject"
      ai_sentiment_enum: "positive" | "neutral" | "negative" | "mixed"
      ai_urgency_enum: "low" | "medium" | "high" | "critical"
      feedback_status_enum:
        | "draft"
        | "published"
        | "hidden"
        | "flagged"
        | "archived"
      feedback_type_enum:
        | "product_review"
        | "seller_review"
        | "service_feedback"
        | "general_feedback"
      log_severity_enum: "debug" | "info" | "warning" | "error" | "critical"
      log_status_enum: "success" | "failure" | "partial" | "timeout"
      order_item_status_enum:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      order_status_enum:
        | "draft"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
      payment_status_enum:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      product_status_enum:
        | "draft"
        | "active"
        | "inactive"
        | "out_of_stock"
        | "archived"
      refund_reason_enum:
        | "damaged"
        | "defective"
        | "wrong_item"
        | "not_as_described"
        | "size_issue"
        | "changed_mind"
        | "duplicate_order"
        | "late_delivery"
        | "other"
      refund_status_enum:
        | "pending"
        | "ai_review"
        | "manual_review"
        | "approved"
        | "processing"
        | "completed"
        | "rejected"
        | "cancelled"
      refund_type_enum: "full_order" | "partial_order" | "single_item"
      user_role_enum: "buyer" | "seller" | "admin" | "moderator"
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
      activity_type_enum: [
        "auth",
        "product_view",
        "search",
        "cart",
        "order",
        "payment",
        "feedback",
        "refund",
        "ai_action",
        "system_event",
        "security_event",
      ],
      ai_feedback_category_enum: [
        "product_quality",
        "delivery",
        "customer_service",
        "pricing",
        "user_experience",
        "other",
      ],
      ai_refund_decision_enum: ["auto_approve", "manual_review", "auto_reject"],
      ai_sentiment_enum: ["positive", "neutral", "negative", "mixed"],
      ai_urgency_enum: ["low", "medium", "high", "critical"],
      feedback_status_enum: [
        "draft",
        "published",
        "hidden",
        "flagged",
        "archived",
      ],
      feedback_type_enum: [
        "product_review",
        "seller_review",
        "service_feedback",
        "general_feedback",
      ],
      log_severity_enum: ["debug", "info", "warning", "error", "critical"],
      log_status_enum: ["success", "failure", "partial", "timeout"],
      order_item_status_enum: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      order_status_enum: [
        "draft",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
      ],
      payment_status_enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      product_status_enum: [
        "draft",
        "active",
        "inactive",
        "out_of_stock",
        "archived",
      ],
      refund_reason_enum: [
        "damaged",
        "defective",
        "wrong_item",
        "not_as_described",
        "size_issue",
        "changed_mind",
        "duplicate_order",
        "late_delivery",
        "other",
      ],
      refund_status_enum: [
        "pending",
        "ai_review",
        "manual_review",
        "approved",
        "processing",
        "completed",
        "rejected",
        "cancelled",
      ],
      refund_type_enum: ["full_order", "partial_order", "single_item"],
      user_role_enum: ["buyer", "seller", "admin", "moderator"],
    },
  },
} as const
