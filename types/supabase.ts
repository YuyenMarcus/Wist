/**
 * Supabase Database Types
 * Generated from your database schema
 * 
 * Run this to regenerate: npx supabase gen types typescript --project-id "your-project-id" --schema public > types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          created_at: string
          url: string
          title: string | null
          price: string | null
          price_raw: string | null
          image: string | null
          description: string | null
          domain: string | null
          currency: string | null
          last_scraped: string | null
          meta: Json | null
          user_id: string | null
          reserved_by: string | null
          reserved_at: string | null
          is_public: boolean
          share_token: string | null
          image_source: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          url: string
          title?: string | null
          price?: string | null
          price_raw?: string | null
          image?: string | null
          description?: string | null
          domain?: string | null
          currency?: string | null
          last_scraped?: string | null
          meta?: Json | null
          user_id?: string | null
          reserved_by?: string | null
          reserved_at?: string | null
          is_public?: boolean
          share_token?: string | null
          image_source?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          url?: string
          title?: string | null
          price?: string | null
          price_raw?: string | null
          image?: string | null
          description?: string | null
          domain?: string | null
          currency?: string | null
          last_scraped?: string | null
          meta?: Json | null
          user_id?: string | null
          reserved_by?: string | null
          reserved_at?: string | null
          is_public?: boolean
          share_token?: string | null
          image_source?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          updated_at: string
          username: string | null
          username_set_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
          username?: string | null
          username_set_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
          username?: string | null
          username_set_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

