'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/login?message=이메일을 확인해주세요');
  };

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-emerald-500">버스타볼까</h1>
        <p className="text-sm text-slate-500 mt-1">회원가입</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
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
        <div>
          <Input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? '가입 중...' : '회원가입'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-4">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-emerald-500 hover:underline">
          로그인
        </Link>
      </p>
    </Card>
  );
}
