---
description: "DaisyUI 기반 UI 구축 및 마이그레이션"
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash
  - WebFetch
user-invocable: true
---

# fireauto-ui: DaisyUI v5 UI 툴킷

DaisyUI v5 기반으로 UI를 구축하거나, shadcn/ui에서 DaisyUI로 마이그레이션하거나, 테마를 설정하는 통합 명령어입니다.

## 사용법

사용자 메시지에서 모드를 파악하세요:
- **migrate** 키워드 또는 "마이그레이션", "변환", "전환" -> 마이그레이션 모드
- **build** 키워드 또는 "만들어", "구축", "생성" -> 빌드 모드
- **theme** 키워드 또는 "테마", "색상", "컬러" -> 테마 모드

---

## 모드 1: migrate (shadcn/ui -> DaisyUI 마이그레이션)

### 단계별 절차

1. **스캔**: `@/components/ui/` 에서 import하는 파일들을 Grep으로 검색
2. **매핑**: 각 shadcn 컴포넌트를 DaisyUI 클래스로 변환
3. **교체**: import 제거, JSX에 DaisyUI 클래스 적용
4. **정리**: 미사용 shadcn 컴포넌트 파일 삭제

### 컴포넌트 매핑 테이블

| shadcn/ui | DaisyUI v5 | 비고 |
|-----------|-----------|------|
| `<Button>` | `<button className="btn">` | variant 아래 참조 |
| `<Button variant="default">` | `btn btn-primary` | |
| `<Button variant="destructive">` | `btn btn-error` | |
| `<Button variant="outline">` | `btn btn-outline` | |
| `<Button variant="secondary">` | `btn btn-secondary` | |
| `<Button variant="ghost">` | `btn btn-ghost` | |
| `<Button variant="link">` | `btn btn-link` | |
| `<Button size="sm">` | `btn btn-sm` | |
| `<Button size="lg">` | `btn btn-lg` | |
| `<Card>` | `<div className="card bg-base-100 shadow-xl">` | |
| `<CardHeader>` | `<div className="card-body">` (상단부) | |
| `<CardTitle>` | `<h2 className="card-title">` | |
| `<CardContent>` | `<div className="card-body">` | |
| `<CardFooter>` | `<div className="card-actions justify-end">` | |
| `<Badge>` | `<span className="badge">` | |
| `<Badge variant="destructive">` | `badge badge-error` | |
| `<Badge variant="outline">` | `badge badge-outline` | |
| `<Badge variant="secondary">` | `badge badge-secondary` | |
| `<Dialog>` | `<dialog className="modal">` | DaisyUI modal 패턴 사용 |
| `<DialogTrigger>` | `<button onclick="modal_id.showModal()">` | |
| `<DialogContent>` | `<div className="modal-box">` | |
| `<DialogHeader>` | 제거, modal-box 내부에 직접 배치 | |
| `<DialogTitle>` | `<h3 className="font-bold text-lg">` | |
| `<DialogDescription>` | `<p className="py-4">` | |
| `<DialogFooter>` | `<div className="modal-action">` | |
| `<Input>` | `<input className="input input-bordered">` | |
| `<Textarea>` | `<textarea className="textarea textarea-bordered">` | |
| `<Select>` | `<select className="select select-bordered">` | |
| `<Checkbox>` | `<input type="checkbox" className="checkbox">` | |
| `<Switch>` | `<input type="checkbox" className="toggle">` | |
| `<Tabs>` | `<div role="tablist" className="tabs tabs-bordered">` | |
| `<TabsTrigger>` | `<a role="tab" className="tab">` | |
| `<TabsContent>` | 일반 div, tab 활성화 상태로 제어 | |
| `<Accordion>` | DaisyUI collapse 또는 details/summary | |
| `<Alert>` | `<div role="alert" className="alert">` | |
| `<Avatar>` | `<div className="avatar"><div className="w-10 rounded-full">` | |
| `<DropdownMenu>` | `<div className="dropdown">` | |
| `<Tooltip>` | `<div className="tooltip" data-tip="...">` | |
| `<Progress>` | `<progress className="progress">` | |
| `<Skeleton>` | `<div className="skeleton">` | |
| `<Table>` | `<table className="table">` | |
| `<Separator>` | `<div className="divider">` | |
| `<Sheet>` | `<div className="drawer">` | |
| `<Popover>` | `<div className="dropdown">` | |

### 색상 시스템 변환

| 하드코딩 | DaisyUI 시맨틱 토큰 |
|---------|-------------------|
| `bg-black`, `bg-zinc-900`, `bg-gray-900` | `bg-base-100` (다크 테마 시) |
| `bg-white`, `bg-zinc-50` | `bg-base-100` (라이트 테마 시) |
| `bg-zinc-800`, `bg-gray-800` | `bg-base-200` |
| `bg-zinc-700`, `bg-gray-700` | `bg-base-300` |
| `text-white` | `text-base-content` |
| `text-zinc-400`, `text-gray-400` | `text-base-content/60` |
| `text-zinc-500`, `text-gray-500` | `text-base-content/50` |
| `border-zinc-700`, `border-gray-700` | `border-base-300` |
| `border-zinc-800`, `border-gray-800` | `border-base-200` |
| 프로젝트 강조색 (예: `bg-yellow-400`) | `bg-primary` |
| 프로젝트 보조색 | `bg-secondary` |

### import 제거 패턴

```typescript
// 제거 대상:
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
// ... 모든 @/components/ui/* import
```

---

## 모드 2: build (DaisyUI 컴포넌트로 새로 구축)

### DaisyUI v5 컴포넌트 카탈로그

#### Layout
- **navbar**: `<div className="navbar bg-base-100">` - 상단 네비게이션
- **drawer**: `<div className="drawer">` - 사이드 드로어
- **footer**: `<footer className="footer">` - 페이지 하단
- **hero**: `<div className="hero min-h-screen">` - 히어로 섹션
- **indicator**: `<div className="indicator">` - 배지/알림 인디케이터

#### Navigation
- **menu**: `<ul className="menu">` - 메뉴 리스트
- **tabs**: `<div role="tablist" className="tabs">` - 탭 네비게이션
- **breadcrumbs**: `<div className="breadcrumbs">` - 경로 표시
- **bottom-navigation**: `<div className="btm-nav">` - 모바일 하단 네비게이션
- **pagination**: `<div className="join">` - 페이지네이션

#### Data Display
- **card**: `<div className="card">` - 카드 컨테이너
- **table**: `<table className="table">` - 데이터 테이블
- **stat**: `<div className="stats">` - 통계 표시
- **countdown**: `<span className="countdown">` - 카운트다운
- **diff**: `<div className="diff">` - 이미지 비교
- **timeline**: `<ul className="timeline">` - 타임라인

#### Input
- **button**: `<button className="btn">` - 버튼
- **input**: `<input className="input">` - 텍스트 입력
- **select**: `<select className="select">` - 셀렉트 박스
- **textarea**: `<textarea className="textarea">` - 텍스트 영역
- **checkbox**: `<input type="checkbox" className="checkbox">` - 체크박스
- **radio**: `<input type="radio" className="radio">` - 라디오 버튼
- **toggle**: `<input type="checkbox" className="toggle">` - 토글 스위치
- **range**: `<input type="range" className="range">` - 범위 슬라이더
- **file-input**: `<input type="file" className="file-input">` - 파일 업로드

#### Feedback
- **alert**: `<div role="alert" className="alert">` - 알림 메시지
- **toast**: `<div className="toast">` - 토스트 알림
- **loading**: `<span className="loading loading-spinner">` - 로딩 표시
- **progress**: `<progress className="progress">` - 진행률 바
- **skeleton**: `<div className="skeleton">` - 스켈레톤 로딩
- **tooltip**: `<div className="tooltip" data-tip="text">` - 툴팁

#### Overlay
- **modal**: `<dialog className="modal">` - 모달 다이얼로그
- **dropdown**: `<div className="dropdown">` - 드롭다운 메뉴
- **swap**: `<label className="swap">` - 교체 애니메이션
- **collapse**: `<div className="collapse">` - 접기/펼치기

#### Typography
- **badge**: `<span className="badge">` - 뱃지/태그
- **kbd**: `<kbd className="kbd">` - 키보드 키
- **code**: DaisyUI는 prose 클래스 내에서 코드 스타일링

### 시맨틱 컬러 토큰

```
primary        - 주 강조색 (CTA 버튼, 중요 요소)
primary-content - primary 위의 텍스트
secondary      - 보조 강조색
secondary-content
accent         - 포인트 색상
accent-content
neutral        - 중립 색상 (텍스트, 아이콘)
neutral-content
base-100       - 기본 배경색
base-200       - 약간 어두운 배경
base-300       - 더 어두운 배경
base-content   - 기본 텍스트 색상
info           - 정보 색상
success        - 성공 색상
warning        - 경고 색상
error          - 오류 색상
```

### 반응형 레이아웃 패턴

```html
<!-- 2컬럼 그리드 (모바일 1열, 데스크탑 2열) -->
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

<!-- 3컬럼 카드 그리드 -->
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

<!-- 히어로 + 사이드 이미지 -->
<div className="hero min-h-screen bg-base-200">
  <div className="hero-content flex-col lg:flex-row">

<!-- 센터 정렬 카드 -->
<div className="flex justify-center">
  <div className="card w-96 bg-base-100 shadow-xl">
```

---

## 모드 3: theme (DaisyUI 테마 설정)

### globals.css 테마 정의 패턴

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark,
  custom_theme {
    primary: oklch(0.7 0.2 75);
    secondary: oklch(0.6 0.15 250);
    accent: oklch(0.8 0.18 150);
    neutral: oklch(0.3 0.01 260);
    base-100: oklch(0.15 0.01 260);
    base-200: oklch(0.12 0.01 260);
    base-300: oklch(0.1 0.01 260);
    base-content: oklch(0.9 0.01 260);
    info: oklch(0.7 0.15 220);
    success: oklch(0.7 0.18 150);
    warning: oklch(0.8 0.18 80);
    error: oklch(0.65 0.2 25);
  };
}
```

### oklch() 컬러 시스템 가이드

oklch(L C H) 형식:
- **L** (Lightness): 0~1 (0=검정, 1=흰색)
- **C** (Chroma): 0~0.4 (0=무채색, 높을수록 선명)
- **H** (Hue): 0~360 (색상 각도)

주요 Hue 값:
- 빨강: ~25
- 주황: ~60
- 노랑: ~90
- 초록: ~150
- 시안: ~190
- 파랑: ~250
- 보라: ~290
- 분홍: ~340

### 다크/라이트 모드 설정

DaisyUI v5에서는 테마 전환이 자동:
- `data-theme="light"` 또는 `data-theme="dark"` 속성으로 전환
- `--prefersdark` 플래그로 시스템 다크 모드 자동 감지
- `next-themes` 라이브러리와 통합 시 `<html data-theme={theme}>` 사용

---

## 실행 지침

1. 사용자 메시지에서 모드 파악 (migrate / build / theme)
2. 대상 파일/디렉토리 확인
3. 현재 코드 분석 (Read, Grep)
4. 변환/구축/설정 수행 (Edit, Write)
5. 결과 요약 보고 (한국어)

모든 작업 결과는 한국어로 보고하세요.
