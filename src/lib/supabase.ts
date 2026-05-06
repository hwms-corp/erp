import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경 변수가 없습니다. 프로젝트 루트에 .env 파일을 만들고 (.env.example 복사) VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY 또는 NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정한 뒤 개발 서버를 다시 실행하세요.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
