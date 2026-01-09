export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          nickname: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nickname?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string | null;
          created_at?: string;
        };
      };
      transport_history: {
        Row: {
          id: string;
          user_id: string;
          origin_name: string;
          dest_name: string;
          route_data: Record<string, unknown> | null;
          boarded_at: string;
          total_time: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          origin_name: string;
          dest_name: string;
          route_data?: Record<string, unknown> | null;
          boarded_at?: string;
          total_time?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          origin_name?: string;
          dest_name?: string;
          route_data?: Record<string, unknown> | null;
          boarded_at?: string;
          total_time?: number | null;
          created_at?: string;
        };
      };
      transport_memo: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          route_name: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          route_name?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          route_id?: string;
          route_name?: string | null;
          content?: string;
          created_at?: string;
        };
      };
      // 새 테이블들
      favorite_stations: {
        Row: {
          id: string;
          user_id: string;
          station_id: string;
          station_name: string;
          x: string | null;
          y: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          station_id: string;
          station_name: string;
          x?: string | null;
          y?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          station_id?: string;
          station_name?: string;
          x?: string | null;
          y?: string | null;
          created_at?: string;
        };
      };
      favorite_routes: {
        Row: {
          id: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bus_id?: string;
          bus_no?: string;
          created_at?: string;
        };
      };
      search_history: {
        Row: {
          id: string;
          user_id: string;
          search_type: string;
          search_query: string;
          result_id: string | null;
          result_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          search_type: string;
          search_query: string;
          result_id?: string | null;
          result_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          search_type?: string;
          search_query?: string;
          result_id?: string | null;
          result_name?: string | null;
          created_at?: string;
        };
      };
      commute_routes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          origin_name: string;
          origin_x: string | null;
          origin_y: string | null;
          dest_name: string;
          dest_x: string | null;
          dest_y: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          origin_name: string;
          origin_x?: string | null;
          origin_y?: string | null;
          dest_name: string;
          dest_x?: string | null;
          dest_y?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          origin_name?: string;
          origin_x?: string | null;
          origin_y?: string | null;
          dest_name?: string;
          dest_x?: string | null;
          dest_y?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      notification_settings: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          target_id: string | null;
          target_name: string | null;
          minutes_before: number;
          webhook_type: string;
          webhook_url: string;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_type: string;
          target_id?: string | null;
          target_name?: string | null;
          minutes_before?: number;
          webhook_type: string;
          webhook_url: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_type?: string;
          target_id?: string | null;
          target_name?: string | null;
          minutes_before?: number;
          webhook_type?: string;
          webhook_url?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
      };
      bus_arrival_logs: {
        Row: {
          id: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          station_id: string;
          station_name: string;
          arrival_time: string;
          day_of_week: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          station_id: string;
          station_name: string;
          arrival_time: string;
          day_of_week: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bus_id?: string;
          bus_no?: string;
          station_id?: string;
          station_name?: string;
          arrival_time?: string;
          day_of_week?: number;
          created_at?: string;
        };
      };
      bus_tracking_targets: {
        Row: {
          id: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          station_id: string;
          station_name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bus_id: string;
          bus_no: string;
          station_id: string;
          station_name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bus_id?: string;
          bus_no?: string;
          station_id?: string;
          station_name?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
    };
  };
}
