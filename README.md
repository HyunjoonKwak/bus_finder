# 버스타볼까 (Bus Tabolka)

나만의 맞춤형 환승 추천과 탑승 이력/메모를 기록하는 개인 맞춤 버스 앱

## 주요 기능

### 정류소 검색 및 도착 정보
- 정류소 이름/번호로 검색
- 현재 위치 기반 주변 정류소 조회
- 실시간 버스 도착 정보 (15초 자동 갱신)
- 정류소/노선 즐겨찾기

### 버스 노선 정보
- 버스 번호로 노선 검색
- 노선 경유 정류소 목록
- 실시간 버스 위치 표시 (지도)

### 길찾기
- 출발지/도착지 대중교통 경로 검색
- 지도에서 위치 선택
- 경로별 소요시간, 환승횟수, 요금 비교

### 출퇴근 모드
- 자주 가는 경로 저장
- 원터치 경로 검색

### 버스 도착 추적
- 특정 버스+정류소 조합 추적
- 도착 시간 통계 및 분석
- 알림 설정 (텔레그램/디스코드 웹훅)

### 탑승 기록 및 메모
- 탑승 이력 자동 저장
- 버스/정류소별 메모 기록

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **UI 컴포넌트**: shadcn/ui
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **지도**: Kakao Map API
- **대중교통 API**:
  - 공공데이터포털 (서울/경기 버스 정보) - 우선 사용
  - ODSay API (경로 검색, 폴백)

## 프로젝트 구조

```
bus_finder/
├── app/
│   ├── (auth)/              # 인증 페이지 (로그인, 회원가입)
│   ├── (main)/              # 메인 앱 페이지
│   │   ├── page.tsx         # 랜딩 페이지 (대시보드)
│   │   ├── bus/             # 버스/정류소 페이지
│   │   ├── explore/         # 지도 탐색 페이지
│   │   ├── search/          # 길찾기 페이지
│   │   ├── tracking/        # 버스 추적 페이지
│   │   ├── settings/        # 설정 페이지
│   │   └── memo/            # 메모 페이지
│   ├── api/                 # API 라우트
│   │   ├── bus/             # 버스 관련 API
│   │   ├── search/          # 경로 검색 API (ODSay)
│   │   ├── favorites/       # 즐겨찾기 API
│   │   ├── tracking/        # 추적 API
│   │   └── notifications/   # 알림 API
│   └── layout.tsx           # 루트 레이아웃
├── components/
│   ├── layout/              # 레이아웃 컴포넌트 (TopNav)
│   ├── ui/                  # shadcn/ui 컴포넌트
│   ├── station/             # 정류소 관련 컴포넌트
│   ├── bus/                 # 버스 관련 컴포넌트
│   ├── map/                 # 지도 컴포넌트
│   └── search/              # 검색 컴포넌트
├── lib/
│   ├── kakao/               # Kakao Map 유틸리티
│   ├── odsay/               # ODSay API 래퍼
│   ├── publicdata/          # 공공데이터포털 API 래퍼
│   ├── supabase/            # Supabase 클라이언트
│   ├── notifications/       # 알림 유틸리티
│   └── store.ts             # Zustand 상태 관리
├── public/
│   ├── favicon.svg          # 파비콘
│   ├── manifest.json        # PWA 매니페스트
│   └── icons/               # PWA 아이콘
└── supabase/
    └── migrations/          # DB 마이그레이션
```

## 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Kakao Map
NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_js_key
KAKAO_REST_API_KEY=your_kakao_rest_api_key

# ODSay
ODSAY_API_KEY=your_odsay_api_key

# 공공데이터포털
PUBLIC_DATA_API_KEY=your_public_data_api_key
```

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인

### 빌드

```bash
npm run build
```

### Docker 실행

```bash
docker-compose up -d
```

## API 데이터 소스

| 기능 | 1순위 (우선) | 2순위 (폴백) |
|------|-------------|-------------|
| 정류소 검색 | 공공데이터포털 | - |
| 주변 정류소 | 공공데이터포털 | - |
| 버스 검색 | 공공데이터포털 | ODSay |
| 노선 상세 | 공공데이터포털 | ODSay |
| 도착 정보 | 공공데이터포털 | ODSay |
| 경로 검색 | ODSay | Mock 데이터 |

## 지원 지역

현재 **수도권 (서울, 경기, 인천)** 지역만 지원합니다.

## 라이선스

MIT License
