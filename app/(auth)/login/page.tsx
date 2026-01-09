'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-emerald-500">버스타볼까</h1>
        <p className="text-sm text-slate-500 mt-1">로그인</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <Button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600"
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-4">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="text-emerald-500 hover:underline">
          회원가입
        </Link>
      </p>
    </Card>
  );
}
