# 버스타볼까 디자인 시스템 (DESIGN_SYSTEM)

## 1. 디자인 컨셉
- **키워드**: 심플, 미니멀, 정보 중심
- **메인 컬러**: 편안한 녹색/파란색 계열 (교통 앱 표준) + 다크 그레이

## 2. 색상 팔레트
| 역할 | Tailwind Class | Hex | 용도 |
| :--- | :--- | :--- | :--- |
| Primary | `bg-emerald-500` | `#10B981` | 주요 버튼, 강조, 활성 아이콘 |
| Secondary | `bg-slate-800` | `#1E293B` | 헤더, 네비게이션, 중요 텍스트 |
| Background | `bg-slate-50` | `#F8FAFC` | 전체 배경 |
| Card | `bg-white` | `#FFFFFF` | 컨텐츠 박스 |
| Text Main | `text-slate-900` | `#0F172A` | 본문 |
| Text Muted | `text-slate-500` | `#64748B` | 부가 정보(시간, 정류장명) |
| Warning | `text-amber-500` | `#F59E0B` | 지연, 혼잡 |

## 3. UI 컴포넌트 가이드
### 버튼
- **Primary**: `h-10 px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600`
- **Ghost**: `h-10 px-4 py-2 hover:bg-slate-100 rounded-md`

### 카드 (버스 노선 정보)
- `bg-white p-4 rounded-xl shadow-sm border border-slate-200`
- 터치 영역 확보를 위해 `min-h-[64px]` 유지

### 폰트
- **Pretendard** (Next.js font optimization 사용)
- **제목**: `text-xl font-bold tracking-tight`
- **본문**: `text-base font-normal`
- **상세**: `text-sm text-slate-500`

## 4. shadcn/ui 설치 목록
```bash
npx shadcn-ui@latest add button card input badge sheet drawer scroll-area tabs
```
