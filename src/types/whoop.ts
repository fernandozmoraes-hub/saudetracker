export interface WhoopConnection {
  id: string;
  user_id: string;
  whoop_user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  needs_reauth: boolean;
  created_at: string;
  updated_at: string;
}
