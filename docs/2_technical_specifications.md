# 버스타볼까 기술 명세서 (TECH_SPEC)

## 1. 기술 스택
| 영역 | 선택 | 이유 |
| :--- | :--- | :--- |
| 프레임워크 | Next.js 14 (App Router) | React 최신 기능 활용, PWA 변환 용이 |
| 스타일링 | Tailwind CSS + shadcn/ui | 빠르고 깔끔한 심플 디자인 구현 |
| 백엔드/DB | Supabase | Auth(이메일), DB(Postgres), 무료 티어 충분 |
| 지도/교통 | Kakao Map API + 공공데이터포털 | 국내 최적화 지도 및 실시간 버스 정보 |
| 상태관리 | Zustand | 가볍고 직관적인 전역 상태 관리 (검색 조건 등) |
| 배포 | Vercel | Next.js 최적화 배포 |

## 2. 폴더 구조
```
/app
  /(auth)
    /login/page.tsx
    /signup/page.tsx
  /(main)
    /page.tsx           # 메인 (검색/즐겨찾기)
    /search/page.tsx    # 검색 결과 (FEAT-1)
    /history/page.tsx   # 탑승 기록 (FEAT-2)
    /memo/page.tsx      # 노선 메모 (FEAT-3)
    /routes/[id]/page.tsx # 노선 상세
  /api
    /search/route.ts    # 경로 검색 프록시 (ODSay or Public Data)
    /history/route.ts   # 기록 CRUD
  /layout.tsx
  /globals.css
/components
  /ui                   # shadcn 컴포넌트
  /map                  # 지도 관련 (MapContainer, Marker)
  /search               # 검색 폼, 필터 옵션
  /history              # 타임라인 컴포넌트
  /layout               # Header, BottomNav
/lib
  /supabase             # 클라이언트/서버 객체
  /kakao                # 카카오맵 유틸
  /utils.ts
/types
  /index.ts             # 버스, 경로, 유저 타입
  /database.ts          # Supabase DB 타입
```

## 3. 환경 변수
```bash
# .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Kakao Map
NEXT_PUBLIC_KAKAO_MAP_KEY=JAVASCRIPT_KEY
# 공공데이터 / ODSay (선택)
TRAFFIC_API_KEY=...
```

## 4. 데이터 흐름
- **검색**: Client -> Next.js API -> 공공데이터/카카오 API -> 정제 후 Client 반환
- **기록**: Client -> Supabase -> DB 저장
- **지도**: Kakao Maps SDK (Client Side Rendering)

## 5. 인증 흐름
- **방식**: 이메일/비밀번호 (Supabase Auth)
- **세션**: Supabase SSR 쿠키 기반 세션 관리
- **미들웨어**: `/search`, `/history` 등 보호된 라우트 접근 시 로그인 체크

## 6. PWA 고려
- `manifest.json` 설정하여 모바일 홈 화면에 추가 가능하도록 구현 (Web-to-App 전략의 첫 단계)
